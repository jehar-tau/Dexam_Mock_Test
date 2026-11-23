import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { recoveryPostgresEnvironment } from "../../scripts/recovery-postgres.mjs";

const env = recoveryPostgresEnvironment(process.env.DESIGNMOCKS_TEST_DATABASE_URL, { localOnly: true });
assert.equal(env.PGDATABASE, "designmocks_ci", "A disposable bootstrap database is required");
const student = randomUUID();
const sourcePrefix = "mixed-attempt-" + student;
const topic = sourcePrefix;
const yearPaper = randomUUID();

function session() {
  const name = "mixed-attempt-" + randomUUID();
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], {
    env, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout: stdout.trim(), stderr }));
  });
  void done.catch(() => {});
  child.stdin.on("error", () => {});
  const write = statement => child.stdin.write(statement + "\n");
  write(`set application_name='${name}'; set statement_timeout='12s'; set idle_in_transaction_session_timeout='20s';`);
  return {
    name, done, output: () => stdout, write,
    finish(statement = "") {
      if (!child.stdin.writableEnded) child.stdin.end(statement + "\n");
      return done;
    },
  };
}

async function sql(statement) {
  const result = await session().finish(statement);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return true;
    await sleep(25);
  }
  return false;
}

const start = `begin;
  set local role authenticated;
  set local request.jwt.claim.sub='${student}';
  set local request.jwt.claim.role='authenticated';`;
const originallyEnabled = await sql("select enabled from dm_private.exam_mock_blueprints where exam='uceed';");
assert.match(originallyEnabled, /^[tf]$/);

try {
  await sql(`begin;
    update dm_private.exam_mock_blueprints set enabled=true where exam='uceed';
    insert into auth.users(id) values ('${student}');
    insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
    values ('${student}','Fictional mixed-start student','+919990051622',now(),2027,'Mumbai',array['uceed'],now());
    with paid as (
      insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)
      values ('${student}','annual',119300,'INR','test','paid') returning id
    )
    insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
    select '${student}',id,'test',now(),now()+interval '1 year' from paid;
    insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,
      objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
    select external_key, encode(sha256(convert_to(external_key,'UTF8')),'hex'),'uceed',upper(kind),'${topic}','owned',
      true,true,true,true,'{"holds":[],"assets":[]}',
      jsonb_build_object('prompt','Fictional question '||n,'kind',kind,
        'options',case when kind='nat' then '[]'::jsonb else
          '[{"id":"A","label":"First"},{"id":"B","label":"Second"},{"id":"C","label":"Third"},{"id":"D","label":"Fourth"}]'::jsonb end,
        'marking',case kind when 'nat' then '{"correct":4,"wrong":0}'::jsonb when 'msq' then '{"correct":4,"wrong":-1,"partial":true}'::jsonb
          else '{"correct":3,"wrong":-0.71}'::jsonb end,
        'points',case when kind='mcq' then 3 else 4 end,
        'negativePoints',case kind when 'nat' then 0 when 'msq' then 1 else 0.71 end,
        'media','[]'::jsonb,'explanation','Fictional explanation.',
        'key', jsonb_build_object('kind',kind,'sourceExternalKey',external_key) || case kind
          when 'nat' then '{"accepted":[{"exact":"1"}]}'::jsonb when 'msq' then '{"correct":["A","B"]}'::jsonb
          else '{"correct":["A"]}'::jsonb end),
      repeat('a',40)
    from (values ('mcq',28),('msq',15),('nat',14)) as section(kind, total)
    cross join lateral generate_series(1,total) n
    cross join lateral (select '${sourcePrefix}-'||kind||'-'||n as external_key) fixture;
    commit;`);
  // Only a complete reviewed year paper may feed the topic pool.
  await sql(`begin;
    update dm_private.bank_questions set payload=jsonb_set(payload,'{provenance}',
      '{"exam":"uceed","paperId":"mixed-start-2023","year":2023}'::jsonb)
      where topic='${topic}';
    insert into dm_private.papers(id,title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind)
      values('${yearPaper}','Fictional UCEED 2023','uceed',3600,true,true,true,'year');
    insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
    select md5('${yearPaper}'||external_key)::uuid,'${yearPaper}',row_number()over(order by external_key),
      runtime_payload->>'prompt',runtime_payload->'options',runtime_payload->>'kind',runtime_payload->'marking',
      runtime_payload->'media',(runtime_payload->>'points')::numeric,(runtime_payload->>'negativePoints')::numeric,
      topic,true from dm_private.bank_questions where topic='${topic}';
    insert into dm_private.answer_keys(question_id,key,explanation)
    select md5('${yearPaper}'||external_key)::uuid,runtime_payload->'key',runtime_payload->>'explanation'
      from dm_private.bank_questions where topic='${topic}';
    insert into dm_private.year_paper_releases(paper_id,exam,paper_year,source_paper_id,part_label,question_count,review_sha256)
      values('${yearPaper}','uceed',2023,'mixed-start-2023','Part A',57,dm_private.year_paper_manifest('${yearPaper}'));
    select dm_private.year_paper_ready('${yearPaper}');
    commit;`);
  await sql(`${start}
    select public.start_topic_practice('${topic}','uceed',10,900);
    select public.start_topic_practice('${topic}','uceed',10,900);
    commit;`);

  const topicStart = session();
  let examStart;
  try {
    topicStart.write(`${start} select public.start_topic_practice('${topic}','uceed',10,900);
      \\echo THIRD_ATTEMPT_CREATED`);
    assert.ok(await waitFor(() => topicStart.output().includes("THIRD_ATTEMPT_CREATED")), "Topic practice did not create the third attempt");

    examStart = session();
    let examResult;
    const examDone = examStart.finish(`${start} select public.start_exam_mock('uceed'); commit;`);
    void examDone.then(result => { examResult = result; }, () => {});
    let waiting = false;
    await waitFor(async () => {
      if (examResult) return true;
      waiting = await sql(`select exists (
        select 1 from pg_stat_activity a join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid))
        where a.application_name='${examStart.name}' and b.application_name='${topicStart.name}'
      );`) === "t";
      return waiting;
    });
    assert.ok(waiting, `Exam mock bypassed the in-flight topic practice: ${examResult?.stderr || examResult?.stdout || "no lock"}`);

    const committed = await topicStart.finish("commit;");
    assert.equal(committed.code, 0, committed.stderr);
    const denied = await examDone;
    assert.equal(await sql(`select count(*) from dm_private.attempts where user_id='${student}' and status='active';`), "3",
      "The mixed starts must leave exactly three active attempts");
    assert.notEqual(denied.code, 0);
    assert.match(denied.stderr, /Finish an active attempt before starting another/);
    assert.equal(await sql(`select count(*) from dm_private.papers where owner_user_id='${student}' and source_kind='exam';`), "0");
  } finally {
    await topicStart.finish("rollback;").catch(() => {});
    await examStart?.finish().catch(() => {});
  }
} finally {
  await sql(`begin;
    delete from dm_private.year_paper_releases where paper_id='${yearPaper}';
    delete from dm_private.answer_keys where question_id in
      (select id from dm_private.questions where paper_id='${yearPaper}');
    delete from dm_private.questions where paper_id='${yearPaper}';
    delete from dm_private.papers where id='${yearPaper}';
    delete from dm_private.attempt_items where attempt_id in (select id from dm_private.attempts where user_id='${student}');
    delete from dm_private.attempts where user_id='${student}';
    delete from dm_private.answer_keys where question_id in (select q.id from dm_private.questions q join dm_private.papers p on p.id=q.paper_id where p.owner_user_id='${student}');
    delete from dm_private.questions where paper_id in (select id from dm_private.papers where owner_user_id='${student}');
    delete from dm_private.papers where owner_user_id='${student}';
    delete from dm_private.passes where user_id='${student}';
    delete from dm_private.orders where user_id='${student}';
    delete from dm_private.bank_questions where topic='${topic}';
    delete from auth.users where id='${student}';
    update dm_private.exam_mock_blueprints set enabled=${originallyEnabled === "t"} where exam='uceed';
    commit;`);
}
console.log("PASS: concurrent topic practice and exam mock share the three-active-attempt limit.");
