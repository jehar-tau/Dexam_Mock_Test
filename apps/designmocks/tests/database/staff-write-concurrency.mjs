// This test uses separate PostgreSQL sessions on the disposable test database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { recoveryPostgresEnvironment } from "../../scripts/recovery-postgres.mjs";

const connection = recoveryPostgresEnvironment(process.env.DESIGNMOCKS_TEST_DATABASE_URL, { localOnly: true });
assert.equal(connection.PGDATABASE, "designmocks_ci", "A disposable bootstrap database is required");
const quote = value => "'" + value.replaceAll("'", "''") + "'";

function session() {
  const name = "operator-test-" + randomUUID();
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"], {
    env: connection, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const finished = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout: stdout.trim(), stderr }));
    child.stdin.on("error", reject);
  });
  void finished.catch(() => {});
  child.stdin.write(`set application_name = ${quote(name)}; set statement_timeout = '12s';
    set idle_in_transaction_session_timeout = '20s';\n`);
  return {
    name, output: () => stdout,
    write: sql => child.stdin.write(sql + "\n"),
    finish: (sql = "") => { if (!child.stdin.writableEnded) child.stdin.end(sql + "\n"); return finished; },
  };
}

async function sql(statement) {
  const result = await session().finish(statement);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}

async function waitFor(check, message) {
  for (let count = 0; count < 100; count++) {
    if (await check()) return;
    await sleep(40);
  }
  throw new Error(message);
}

const first = randomUUID(), second = randomUUID(), reporter = randomUUID();
const paper = randomUUID();
const reports = Array.from({ length: 4 }, () => randomUUID());
const actor = id => `set local role authenticated; set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = ${quote(id)};`;
const reply = (report, request, status = "fixed") => `select public.admin_reply_bug_report(
  ${quote(report)}, 0, ${quote(status)}, 'Original fictional support response.', ${quote(request)});`;
const revoke = `delete from dm_private.admins where user_id = ${quote(second)};`;
const restore = `insert into dm_private.admins(user_id) values (${quote(second)});`;
const remove = `begin;
  update public.launch_settings set sales_enabled=false, environment_mode='test', policy_version=null where singleton;
  update dm_private.registration_policy set mode='closed' where id;
  update dm_private.mvp_test_checkout_control set enabled=false, expires_at=null, actor_id=null, evidence=null where singleton;
  update dm_private.launch_gate_attestations set approved=false, actor_id=null, evidence=null;
  delete from dm_private.mvp_test_checkout_audit where actor_id in (${quote(first)}, ${quote(second)});
  delete from dm_private.launch_gate_audit where actor_id in (${quote(first)}, ${quote(second)});
  delete from dm_private.mvp_release_audit where paper_id=${quote(paper)};
  delete from dm_private.mvp_paid_releases where paper_id=${quote(paper)};
  delete from dm_private.answer_keys where question_id in (select id from dm_private.questions where paper_id=${quote(paper)});
  delete from dm_private.questions where paper_id=${quote(paper)};
  delete from dm_private.papers where id=${quote(paper)};
  delete from dm_private.bank_questions where external_key like 'mvp-original-%';
  delete from dm_private.orders where user_id=${quote(reporter)};
  delete from dm_private.bug_report_updates where actor_id in (${quote(first)}, ${quote(second)});
  delete from dm_private.bug_reports where reporter_id = ${quote(reporter)};
  delete from dm_private.account_privacy_requests where user_id = ${quote(reporter)};
  delete from auth.users where id in (${[first, second, reporter].map(quote).join(",")});
  commit;`;

async function contend(heldSql, actorId, operation, { commit = false, whileWaiting } = {}) {
  const holder = session();
  let worker;
  try {
    holder.write("begin;\n" + heldSql + "\n\\echo OPERATOR_LOCK_HELD");
    await waitFor(() => holder.output().includes("OPERATOR_LOCK_HELD"), "The operator lock was not acquired");
    worker = session();
    const result = worker.finish("begin;\n" + actor(actorId) + operation + "\ncommit;");
    await waitFor(async () => await sql(`select exists (
      select 1 from pg_stat_activity waiting join pg_stat_activity holding on holding.pid = any(pg_blocking_pids(waiting.pid))
      where waiting.application_name = ${quote(worker.name)} and holding.application_name = ${quote(holder.name)}
    );`) === "t", "The authenticated request did not wait on the held lock");
    if (whileWaiting) await sql(whileWaiting);
    const released = await holder.finish(commit ? "commit;" : "rollback;");
    assert.equal(released.code, 0, released.stderr);
    return { worker: await result, holder: released.stdout.split("\n")[0] };
  } finally {
    await holder.finish("rollback;").catch(() => {});
    await worker?.finish().catch(() => {});
  }
}

function denied(result, code) {
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, new RegExp("ERROR:\\s+" + code));
}

async function assertState(report, revision, status, updates) {
  const current = await sql(`select reply_revision || ':' || status || ':' ||
    (select count(*) from dm_private.bug_report_updates where report_id = report.id)
    from dm_private.bug_reports report where id = ${quote(report)};`);
  assert.equal(current, `${revision}:${status}:${updates}`);
}

assert.equal(await sql("select dm_private.mvp_profile_permissions_valid();"), "t");
assert.equal(await sql(`select
  (select not sales_enabled and environment_mode='test' and policy_version is null from public.launch_settings)
  and (select mode='closed' from dm_private.registration_policy)
  and (select not enabled and actor_id is null from dm_private.mvp_test_checkout_control)
  and not exists(select 1 from dm_private.launch_gate_attestations where approved or actor_id is not null or evidence is not null)
  and not exists(select 1 from dm_private.bank_questions where external_key like 'mvp-original-%');`), "t",
"Operator concurrency tests require the untouched disposable launch controls");
try {
  await sql(`begin; insert into auth.users(id) values (${quote(first)}), (${quote(second)}), (${quote(reporter)});
    insert into dm_private.admins(user_id) values (${quote(first)}), (${quote(second)});
    insert into dm_private.bug_reports(id, reporter_id, title, description)
      select report_id, ${quote(reporter)}, 'Original fictional report', 'Original fictional details for reply races.'
      from unnest(array[${reports.map(quote).join(",")}]::uuid[]) report_id; commit;`);

  const competing = await contend(actor(first) + reply(reports[0], randomUUID()), second,
    reply(reports[0], randomUUID(), "investigating"), { commit: true });
  denied(competing.worker, "40001");
  await assertState(reports[0], 1, "fixed", 1);

  const exact = reply(reports[1], randomUUID());
  const replay = await contend(actor(first) + exact, first, exact, { commit: true });
  assert.equal(replay.worker.code, 0, replay.worker.stderr);
  assert.deepEqual(JSON.parse(replay.worker.stdout), JSON.parse(replay.holder));
  await assertState(reports[1], 1, "fixed", 1);

  const rowLock = `select 1 from dm_private.bug_reports where id = ${quote(reports[2])} for update;`;
  const revokedReply = await contend(rowLock, second, reply(reports[2], randomUUID()), { whileWaiting: revoke });
  denied(revokedReply.worker, "42501");
  await assertState(reports[2], 0, "open", 0);
  await sql(restore);

  const request = randomUUID();
  const saved = reply(reports[3], request);
  await sql("begin;" + actor(second) + saved + "commit;");
  const requestLock = `select pg_advisory_xact_lock(hashtextextended(${quote("dmocks-support-reply:" + second + ":" + request)}, 0));`;
  const revokedReplay = await contend(requestLock, second, saved, { whileWaiting: revoke });
  denied(revokedReplay.worker, "42501");
  await assertState(reports[3], 1, "fixed", 1);
  await sql(restore);

  const revokedRead = await contend(revoke, second, "select public.admin_bug_report_page();", { commit: true });
  denied(revokedRead.worker, "42501");
  assert.equal(revokedRead.worker.stdout, "");

  const privacy = randomUUID();
  await sql(restore);
  await sql(`insert into dm_private.account_privacy_requests(id,user_id,request_type)
    values (${quote(privacy)},${quote(reporter)},'account_deletion');`);
  const review = status => `select public.admin_resolve_privacy_request(${quote(privacy)},0,${quote(status)},
    'Original fictional account review note.');`;
  const privacyState = () => sql(`select review_revision || ':' || status || ':' || (handled_by is null)::text
    from dm_private.account_privacy_requests where id = ${quote(privacy)};`);
  const privacyLock = `select 1 from dm_private.account_privacy_requests where id = ${quote(privacy)} for update;`;
  const revokedReview = await contend(privacyLock, second, review("closed"), { whileWaiting: revoke });
  denied(revokedReview.worker, "42501");
  assert.equal(await privacyState(), "0:open:true");
  await sql(restore);
  const competingReview = await contend(actor(first) + review("in_progress"), second, review("closed"), { commit: true });
  denied(competingReview.worker, "40001");
  assert.equal(await privacyState(), "1:in_progress:false");
  assert.equal(await sql(`select exists(select 1 from auth.users where id = ${quote(reporter)});`), "t");

  const seedPaper = await readFile(new URL("fixtures/mvp-objective-paper.sql", import.meta.url), "utf8");
  await sql(seedPaper + `\nselect pg_temp.seed_mvp_paper('uceed',${quote(paper)});`);
  const digest = await sql(`select dm_private.mvp_paper_manifest(${quote(paper)})->>'sha256';`);
  assert.match(digest, /^[0-9a-f]{64}$/);
  const release = `select public.admin_release_mvp_paper(${quote(paper)},${quote(digest)},'Original fictional owner review.');`;
  const withdrawal = `select public.admin_withdraw_mvp_paper(${quote(paper)},${quote(digest)},'Original fictional withdrawal.');`;
  const paperState = () => sql(`select published::text || ':' || dm_private.mvp_release_is_current(id)::text || ':' ||
    (select count(*) from dm_private.mvp_release_audit where paper_id=${quote(paper)}) from dm_private.papers where id=${quote(paper)};`);
  for (const lock of [
    `select 1 from dm_private.papers where id=${quote(paper)} for update;`,
    "select 1 from dm_private.bank_questions where external_key='mvp-original-1' for update;",
  ]) {
    denied((await contend(lock, second, release, { whileWaiting: revoke })).worker, "42501");
    assert.equal(await paperState(), "false:false:0");
    await sql(restore);
  }
  await sql("begin;" + actor(first) + release + "commit;");
  const releaseLock = `select 1 from dm_private.mvp_paid_releases where paper_id=${quote(paper)} for update;`;
  denied((await contend(releaseLock, second, withdrawal, { whileWaiting: revoke })).worker, "42501");
  assert.equal(await paperState(), "true:true:1");
  await sql(restore);

  const gateLock = "select 1 from dm_private.launch_gate_attestations where gate='backup_restore' for update;";
  denied((await contend(gateLock, second, "select public.admin_set_launch_gate('backup_restore',true,'Original fictional recovery evidence.');",
    { whileWaiting: revoke })).worker, "42501");
  assert.equal(await sql("select not approved and not exists(select 1 from dm_private.launch_gate_audit) from dm_private.launch_gate_attestations where gate='backup_restore';"), "t");
  await sql(restore);

  await sql(`update public.launch_settings set policy_version='fictional-operator-launch';
    update dm_private.registration_policy set mode='testers';
    update dm_private.launch_gate_attestations set approved=true,evidence='Original fictional reviewed gate.'
      where gate in('content_rights','privacy_terms','refund_policy','child_safety');`);
  const checkoutLock = "select 1 from dm_private.mvp_test_checkout_control where singleton for update;";
  const openWindow = "select public.admin_set_mvp_test_checkout(true,clock_timestamp()+interval'1 hour','Original fictional Test acceptance.');";
  const checkoutState = () => sql("select enabled::text || ':' || (select count(*) from dm_private.mvp_test_checkout_audit) from dm_private.mvp_test_checkout_control;");
  denied((await contend(checkoutLock, second, openWindow, { whileWaiting: revoke })).worker, "42501");
  assert.equal(await checkoutState(), "false:0");
  await sql(restore);
  denied((await contend(checkoutLock, second, openWindow, {
    whileWaiting: "update dm_private.launch_gate_attestations set approved=false where gate='privacy_terms';",
  })).worker, "P0001");
  assert.equal(await checkoutState(), "false:0");

  const oldNotices = "dmocks-notices-v1-" + "a".repeat(64);
  const currentNotices = "dmocks-notices-v1-" + "b".repeat(64);
  const noticeConsent = version => `select public.accept_current_terms(${quote(version)});`;
  const publishNotices = version => `update public.launch_settings set policy_version=${quote(version)} where singleton;`;
  const consentState = () => sql(`select terms_version || ':' || accepted_at::text from public.profiles where user_id=${quote(reporter)};`);
  await sql(publishNotices(oldNotices));
  await sql("begin;" + actor(reporter) + noticeConsent(oldNotices) + "commit;");
  const previousConsent = await consentState();
  const profileLock = `select 1 from public.profiles where user_id=${quote(reporter)} for update;`;
  denied((await contend(profileLock, reporter, noticeConsent(oldNotices), {
    whileWaiting: publishNotices(currentNotices),
  })).worker, "22023");
  assert.equal(await consentState(), previousConsent);
  assert.equal(await sql(`select count(*) from dm_private.orders where user_id=${quote(reporter)};`), "0");
  await sql("begin;" + actor(reporter) + noticeConsent(currentNotices) + "commit;");
  const currentConsent = await consentState();
  assert.ok(currentConsent.startsWith(currentNotices + ":"));
  const nextNotices = "dmocks-notices-v1-" + "c".repeat(64);
  denied((await contend(publishNotices(nextNotices), reporter, noticeConsent(currentNotices), {
    commit: true,
  })).worker, "22023");
  assert.equal(await consentState(), currentConsent);

  await sql(`update dm_private.launch_gate_attestations set approved=true,evidence='Original fictional reviewed gate.' where gate<>'drawing_operations';
    update public.launch_settings set environment_mode='live',policy_version='fictional-operator-launch';
    update public.launch_settings set sales_enabled=true;`);
  await sql("begin;" + actor(reporter) + "select public.accept_current_terms('fictional-operator-launch');commit;");
  const revokeGate = "select public.admin_set_launch_gate('privacy_terms',false,'Original fictional approval withdrawn.');";
  const order = "select public.prepare_order();";
  denied((await contend(actor(first) + revokeGate, reporter, order, { commit: true })).worker, "P0001");
  denied(await session().finish("begin;" + actor(reporter) + order + "commit;"), "P0001");
  assert.equal(await sql(`select count(*) from dm_private.orders where user_id=${quote(reporter)};`), "0");
  await sql("begin;" + actor(first) + "select public.admin_set_launch_gate('privacy_terms',true,'Original fictional current approval.');commit;");
  const authorized = JSON.parse(await sql("begin;" + actor(reporter) + order + "commit;"));
  assert.equal(authorized.mode, "live");
  assert.equal(authorized.amount, 119300);
  assert.equal(await sql(`select count(*) from dm_private.passes where user_id=${quote(reporter)};`), "0");
} finally {
  await sql(remove);
}
console.log(JSON.stringify({ passed: true, actualSupportDatabaseLocks: true, competingWriteRejected: true,
  exactConcurrentReplay: true, revokedWriteReplayAndReadDenied: true }));
console.log(JSON.stringify({ passed: true, actualPrivacyDatabaseLocks: true, revokedReviewDenied: true,
  staleCompetingReviewDenied: true, accountPreserved: true }));
console.log(JSON.stringify({ passed: true, actualMvpDecisionLocks: true, revokedReleaseWithdrawalGateAndWindowDenied: true,
  staleTestPrerequisiteDenied: true, revokedLiveGateDeniedQueuedAndNewOrders: true, currentApprovedOrderStillPrepares: true }));
console.log(JSON.stringify({ passed: true, actualNoticeAcceptanceLocks: true, publicationCommittedDuringProfileWait: true,
  supersededConsentRejected: true, previousAcceptancePreserved: true, currentAcceptanceStored: true,
  concurrentPolicyUpdateRechecked: true }));
