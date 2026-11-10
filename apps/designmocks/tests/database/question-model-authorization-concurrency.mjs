// Exercise the provider and completion fences on separate disposable PostgreSQL sessions.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { recoveryPostgresEnvironment } from "../../scripts/recovery-postgres.mjs";

const env = recoveryPostgresEnvironment(process.env.DESIGNMOCKS_TEST_DATABASE_URL, { localOnly: true });
assert.equal(env.PGDATABASE, "designmocks_ci", "A disposable bootstrap database is required");
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const [actor, intake, extracted, ai, queued, succeeded, savedDraft, intakeToken, aiToken] =
  Array.from({ length: 9 }, () => quote(randomUUID()));
const reference = quote("model-authorization-fixture-" + randomUUID());
const sha256 = value => createHash("sha256").update(value).digest("hex");
const sourceName = "Fictional source fence.pdf";
const sourceDigest = sha256("fictional intake source fixture");
const sourcePath = quote(`intake/${actor.slice(1, -1)}/sources/${sha256(sourceName)}-${sourceDigest}.pdf`);
const sourceRegistration = `select public.register_question_intake_source(${actor},${quote(sourceName)},'application/pdf',1200,${quote(sourceDigest)});`;

function session() {
  const name = quote("question-model-fence-" + randomUUID());
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"], {
    env, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const finished = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", code => resolve({ code, stdout: stdout.trim(), stderr }));
  });
  void finished.catch(() => {});
  child.stdin.write(`set application_name = ${name}; set statement_timeout = '12s';
    set idle_in_transaction_session_timeout = '20s';\n`);
  return {
    name, output: () => stdout,
    write: sql => child.stdin.write(sql + "\n"),
    finish: (sql = "") => {
      if (!child.stdin.writableEnded) child.stdin.end(sql + "\n");
      return finished;
    },
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
    await sleep(30);
  }
  throw new Error(message);
}

const service = "set local role service_role; set local request.jwt.claim.role = 'service_role';";
const restore = `insert into dm_private.admins(user_id) values (${actor});`;
const revoke = `delete from dm_private.admins where user_id=${actor};`;
const intakeFence = `select public.authorize_question_intake_provider(${intake},${actor},${intakeToken});`;
const draftFence = `select public.read_ai_draft_provider_basis(${ai},${actor},${aiToken});`;

async function deniedWhileWaiting(lock, action, expectedCode, { whileWaiting, commit = false } = {}) {
  const holder = session();
  let worker;
  try {
    holder.write("begin;\n" + lock + "\n\\echo MODEL_LOCK_HELD");
    await waitFor(() => holder.output().includes("MODEL_LOCK_HELD"), "The fixture lock was not acquired");
    worker = session();
    const result = worker.finish("begin;\n" + service + "\n" + action + "\ncommit;");
    await waitFor(async () => await sql(`select exists (
      select 1 from pg_stat_activity waiting join pg_stat_activity holding on holding.pid = any(pg_blocking_pids(waiting.pid))
      where waiting.application_name=${worker.name} and holding.application_name=${holder.name}
    );`) === "t", "The service RPC did not wait on the fixture lock");
    if (whileWaiting) await whileWaiting();
    const released = await holder.finish(commit ? "commit;" : "rollback;");
    assert.equal(released.code, 0, released.stderr);
    const denied = await result;
    assert.notEqual(denied.code, 0, action);
    assert.match(denied.stderr, new RegExp("ERROR:\\s+" + expectedCode), action);
  } finally {
    await holder.finish("rollback;").catch(() => {});
    await worker?.finish().catch(() => {});
  }
}

const intakeRow = id => `select 1 from dm_private.question_intake_assets where id=${id} for update;`;
const draftRow = id => `select 1 from dm_private.ai_draft_requests where id=${id} for update;`;
try {
  await sql(`begin;
    insert into auth.users(id) values (${actor});
    ${restore}
    insert into storage.objects(bucket_id,name,metadata)
      values ('question-intake',${sourcePath},'{"mimetype":"application/pdf","size":1200}');
    insert into dm_private.question_drafts(id,created_by,source_type,source_name,payload)
      values (${savedDraft},${actor},'ai','Fictional fixture','{}');
    insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,owner_approved,rights_confirmed,active,payload,source_commit)
      values (${reference},repeat('f',64),'uceed','MCQ','fixture','owned',true,true,true,
        '{"holds":[],"prompt":"Fictional approved reference"}',repeat('e',40));
    insert into dm_private.question_intake_assets(id,storage_path,original_name,mime_type,byte_size,status,uploaded_by,
      extraction_actor_id,extraction_token,extraction_deadline,extraction_model,extraction_response_id,extraction_count,extraction_result_hash)
      values (${intake},'intake/model-fixture/'||${intake},'fixture.pdf','application/pdf',1200,'extracting',${actor},${actor},${intakeToken},
        clock_timestamp()+interval '10 minutes',null,null,null,null),
      (${extracted},'intake/model-fixture/'||${extracted},'finished.pdf','application/pdf',1200,'extracted',${actor},${actor},${intakeToken},
        null,'fictional','saved-intake',1,encode(sha256(convert_to('[]','UTF8')),'hex'));
    insert into dm_private.ai_draft_requests(id,created_by,exam,topic,question_type,instruction,basis_external_keys,status,run_token,run_deadline,
      model,response_id,draft_id)
      values (${ai},${actor},'uceed','fixture','MCQ','Fictional fixture instruction',array[${reference}],'running',${aiToken},
        clock_timestamp()+interval '10 minutes',null,null,null),
      (${queued},${actor},'uceed','fixture','MCQ','Fictional fixture instruction',array[${reference}],'queued',null,null,null,null,null),
      (${succeeded},${actor},'uceed','fixture','MCQ','Fictional fixture instruction',array[${reference}],'succeeded',${aiToken},
        null,'fictional','saved-draft',${savedDraft});
    commit;`);

  for (const [row, action] of [
    [intakeRow(intake), intakeFence],
    [intakeRow(intake), `select public.complete_question_intake_asset(${intake},'fictional','new-intake','[]',${intakeToken});`],
    [intakeRow(extracted), `select public.complete_question_intake_asset(${extracted},'fictional','saved-intake','[]',${intakeToken});`],
    [draftRow(queued), `select public.claim_ai_draft_request(${queued},${actor},false);`],
    [draftRow(ai), draftFence],
    [draftRow(ai), `select public.complete_ai_draft_request(${ai},'fictional','new-draft','{}',${aiToken});`],
    [draftRow(succeeded), `select public.complete_ai_draft_request(${succeeded},'fictional','saved-draft','{}',${aiToken});`],
  ]) {
    await deniedWhileWaiting(row, action, "42501", { whileWaiting: () => sql(revoke) });
    await sql(restore);
  }

  await deniedWhileWaiting(`select pg_advisory_xact_lock(hashtextextended('dmocks-intake-source:'||${sourcePath},0));`,
    sourceRegistration, "42501", { whileWaiting: () => sql(revoke) });
  assert.equal(await sql(`select not exists (select 1 from dm_private.question_intake_assets where storage_path=${sourcePath});`), "t");
  await sql(restore);
  await sql(`begin;${service}${sourceRegistration}commit;`);
  const sourceBeforeReplay = await sql(`select to_jsonb(a) from dm_private.question_intake_assets a where storage_path=${sourcePath};`);
  assert.ok(sourceBeforeReplay);
  await deniedWhileWaiting(`select 1 from storage.objects where bucket_id='question-intake' and name=${sourcePath} for update;`,
    sourceRegistration, "42501", { whileWaiting: () => sql(revoke) });
  assert.equal(await sql(`select to_jsonb(a) from dm_private.question_intake_assets a where storage_path=${sourcePath};`),
    sourceBeforeReplay);
  await sql(restore);

  await deniedWhileWaiting(revoke, intakeFence, "42501", { commit: true });
  await sql(restore);

  await deniedWhileWaiting(`update dm_private.bank_questions set rights_confirmed=false where external_key=${reference};`,
    draftFence, "40001", { commit: true });
  await sql(`update dm_private.bank_questions set rights_confirmed=true where external_key=${reference};`);

  // Expire through the passage of wall time while the worker transaction waits.
  await sql(`update dm_private.question_intake_assets set extraction_deadline=clock_timestamp()+interval '2 seconds' where id=${intake};`);
  await deniedWhileWaiting(intakeRow(intake), intakeFence, "40001", { whileWaiting: async () => {
    assert.equal(await sql(`select clock_timestamp()<extraction_deadline from dm_private.question_intake_assets where id=${intake};`), "t");
    await sleep(2200);
  } });
  await sql(`update dm_private.ai_draft_requests set run_deadline=clock_timestamp()+interval '2 seconds' where id=${ai};`);
  await deniedWhileWaiting(draftRow(ai), draftFence, "40001", { whileWaiting: async () => {
    assert.equal(await sql(`select clock_timestamp()<run_deadline from dm_private.ai_draft_requests where id=${ai};`), "t");
    await sleep(2200);
  } });

  assert.equal(await sql(`select
    (select status='extracting' and extraction_count is null from dm_private.question_intake_assets where id=${intake})
    and (select status='extracted' and extraction_count=1 from dm_private.question_intake_assets where id=${extracted})
    and (select status='queued' and run_token is null from dm_private.ai_draft_requests where id=${queued})
    and (select status='running' and draft_id is null from dm_private.ai_draft_requests where id=${ai})
    and (select status='succeeded' and draft_id=${savedDraft} from dm_private.ai_draft_requests where id=${succeeded});`), "t");
  console.log(JSON.stringify({ passed: true, providerAndCompletionRecheckedRevocationAfterJobLocks: true,
    revokedCompletionReplayDenied: true, currentReferenceRightsRechecked: true, deadlinesUseClockAfterWaiting: true,
    intakeRegistrationAndReplayRecheckStaffAfterSourceLocks: true }));
} finally {
  await sql(`begin;
    delete from dm_private.question_intake_assets where id in (${intake},${extracted}) or storage_path=${sourcePath};
    delete from storage.objects where bucket_id='question-intake' and name=${sourcePath};
    delete from dm_private.ai_draft_requests where id in (${ai},${queued},${succeeded});
    delete from dm_private.question_drafts where id=${savedDraft};
    delete from dm_private.bank_questions where external_key=${reference};
    delete from auth.users where id=${actor};
    commit;`);
}
