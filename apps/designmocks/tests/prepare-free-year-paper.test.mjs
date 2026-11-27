import test from 'node:test';
import assert from 'node:assert/strict';
import {freeYearPaperProviderConfiguration,validateFreeYearPaperPlan} from '../scripts/prepare-free-year-paper.mjs';

import {objectiveYearSources} from '../scripts/stage-free-year-sources.mjs';

const canonical={records:[{exam:'uceed',type:'MCQ',externalKey:'uceed-fixture-q1',contentSha256:'a'.repeat(64),
  payload:{holds:[],provenance:{year:2023,paperId:'uceed-fixture'}}},
  {exam:'uceed',type:'DESCRIPTIVE',externalKey:'uceed-fixture-q2',contentSha256:'b'.repeat(64),
    payload:{holds:[],provenance:{year:2023,paperId:'uceed-fixture'}}}]};
const plan={format:'dmocks-free-year-paper-v1',markingReference:'Fictional historic instructions',
  exam:'uceed',year:2023,sourcePaperId:'uceed-fixture',partLabel:'Part A',title:'Fictional UCEED paper',
  durationSeconds:7200,questions:[{externalKey:'uceed-fixture-q1',contentSha256:'a'.repeat(64),
    marking:{correct:3,wrong:-1},explanation:'Fictional worked reasoning for the answer.'}]};

test('private plan selects the complete hold-free objective group and binds a review digest',()=>{
  const result=validateFreeYearPaperPlan(plan,canonical);
  assert.equal(result.questionCount,1);
  assert.match(result.planSha256,/^[a-f0-9]{64}$/);
  assert.equal(validateFreeYearPaperPlan(structuredClone(plan),canonical).planSha256,result.planSha256);
});

test('private plan rejects stale, partial, duplicate, and unexplained content',()=>{
  const item=plan.questions[0];
  for (const changed of [
    {...plan,questions:[]},
    {...plan,questions:[item,item]},
    {...plan,questions:[{...item,contentSha256:'f'.repeat(64)}]},
    {...plan,questions:[{...item,explanation:'Unreviewed'}]},
    {...plan,questions:[{...item,marking:{correct:0,wrong:0}}]},
    {...plan,year:2024},
  ]) assert.throws(()=>validateFreeYearPaperPlan(changed,canonical),/plan does not match/);
  assert.throws(()=>validateFreeYearPaperPlan(plan,{records:[...canonical.records,
    {...canonical.records[0],externalKey:'uceed-fixture-q3'}]}),/plan does not match/);
  const incomplete2025={...plan,year:2025};
  const incomplete2025Source={records:canonical.records.map(record=>({...record,
    payload:{...record.payload,provenance:{...record.payload.provenance,year:2025}}}))};
  assert.throws(()=>validateFreeYearPaperPlan(incomplete2025,incomplete2025Source),/plan does not match/);
});

test('private paper preparation carries the audited expanded Test profile without changing its paper origin gate',()=>{
  const env={DMOCKS_SUPABASE_URL:'https://fictional.supabase.co',
    DMOCKS_SUPABASE_SERVICE_ROLE_KEY:'server-only-fixture',
    DMOCKS_PAPER_ALLOW_ORIGIN:'https://fictional.supabase.co',
    DMOCKS_PAPER_ENVIRONMENT:'staging',DMOCKS_BANK_PROFILE:'expanded-staging',
    DMOCKS_BANK_AUDIT_DATABASE_URL:'postgresql://fictional.invalid/postgres',
    DMOCKS_BANK_AUDIT_DATABASE_CA_FILE:'/private/fictional-ca.pem'};
  const config=freeYearPaperProviderConfiguration(env);
  assert.equal(config.expandedStagingProfile,true);
  assert.equal(config.auditDatabaseUrl,env.DMOCKS_BANK_AUDIT_DATABASE_URL);
  assert.equal(config.auditDatabaseCaFile,env.DMOCKS_BANK_AUDIT_DATABASE_CA_FILE);
  assert.equal(config.allowOrigin,env.DMOCKS_PAPER_ALLOW_ORIGIN);
  assert.equal(config.environment,'staging');
  assert.equal(freeYearPaperProviderConfiguration({...env,DMOCKS_BANK_PROFILE:'disabled'}).expandedStagingProfile,false);
});

test('source staging sends only the exact plan’s objective records',()=>{
  const {planSha256}=validateFreeYearPaperPlan(plan,canonical);
  assert.deepEqual(objectiveYearSources(plan,canonical,planSha256).records,[canonical.records[0]]);
  assert.throws(()=>objectiveYearSources(plan,canonical,'b'.repeat(64)),/changed/);
});
