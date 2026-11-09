// This test uses separate PostgreSQL sessions on the disposable test database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { recoveryPostgresEnvironment } from "../../scripts/recovery-postgres.mjs";

const connection = recoveryPostgresEnvironment(process.env.DESIGNMOCKS_TEST_DATABASE_URL, { localOnly: true });
assert.equal(connection.PGDATABASE, "designmocks_ci", "A disposable bootstrap database is required");
const quote = value => "'" + value.replaceAll("'", "''") + "'";

function session() {
  const name = "support-test-" + randomUUID();
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
const reports = Array.from({ length: 4 }, () => randomUUID());
const actor = id => `set local role authenticated; set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = ${quote(id)};`;
const reply = (report, request, status = "fixed") => `select public.admin_reply_bug_report(
  ${quote(report)}, 0, ${quote(status)}, 'Original fictional support response.', ${quote(request)});`;
const revoke = `delete from dm_private.admins where user_id = ${quote(second)};`;
const restore = `insert into dm_private.admins(user_id) values (${quote(second)});`;
const remove = `begin;
  delete from dm_private.bug_report_updates where actor_id in (${quote(first)}, ${quote(second)});
  delete from dm_private.bug_reports where reporter_id = ${quote(reporter)};
  delete from auth.users where id in (${[first, second, reporter].map(quote).join(",")});
  commit;`;

async function contend(heldSql, actorId, operation, { commit = false, revokeWhileWaiting = false } = {}) {
  const holder = session();
  let worker;
  try {
    holder.write("begin;\n" + heldSql + "\n\\echo SUPPORT_LOCK_HELD");
    await waitFor(() => holder.output().includes("SUPPORT_LOCK_HELD"), "The support lock was not acquired");
    worker = session();
    const result = worker.finish("begin;\n" + actor(actorId) + operation + "\ncommit;");
    await waitFor(async () => await sql(`select exists (
      select 1 from pg_stat_activity waiting join pg_stat_activity holding on holding.pid = any(pg_blocking_pids(waiting.pid))
      where waiting.application_name = ${quote(worker.name)} and holding.application_name = ${quote(holder.name)}
    );`) === "t", "The authenticated support request did not wait on the held lock");
    if (revokeWhileWaiting) await sql(revoke);
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
  const revokedReply = await contend(rowLock, second, reply(reports[2], randomUUID()), { revokeWhileWaiting: true });
  denied(revokedReply.worker, "42501");
  await assertState(reports[2], 0, "open", 0);
  await sql(restore);

  const request = randomUUID();
  const saved = reply(reports[3], request);
  await sql("begin;" + actor(second) + saved + "commit;");
  const requestLock = `select pg_advisory_xact_lock(hashtextextended(${quote("dmocks-support-reply:" + second + ":" + request)}, 0));`;
  const revokedReplay = await contend(requestLock, second, saved, { revokeWhileWaiting: true });
  denied(revokedReplay.worker, "42501");
  await assertState(reports[3], 1, "fixed", 1);
  await sql(restore);

  const revokedRead = await contend(revoke, second, "select public.admin_bug_report_page();", { commit: true });
  denied(revokedRead.worker, "42501");
  assert.equal(revokedRead.worker.stdout, "");
} finally {
  await sql(remove);
}
console.log(JSON.stringify({ passed: true, actualSupportDatabaseLocks: true, competingWriteRejected: true,
  exactConcurrentReplay: true, revokedWriteReplayAndReadDenied: true }));
