import {readFile, stat} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {loadFromGit, sha256, stableJson} from './question-bank-import.mjs';
import {bankProviderConfiguration,openPrivateBankProvider} from './private-bank-provider.mjs';

const digest = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const exams = new Set(['uceed','ceed','nift','nid']);
const fail = () => {throw new Error('The private year-paper plan does not match the current hold-free source group');};

export function validateFreeYearPaperPlan(plan,canonical) {
  if (!plan || plan.format !== 'dmocks-free-year-paper-v1' || !exams.has(plan.exam)
    || !Number.isInteger(plan.year) || plan.year < 2000 || plan.year > 2100
    || typeof plan.sourcePaperId !== 'string' || !/^[a-z0-9-]{4,100}$/.test(plan.sourcePaperId)
    || typeof plan.partLabel !== 'string' || plan.partLabel.trim().length < 2 || plan.partLabel.length > 40
    || typeof plan.title !== 'string' || plan.title.trim().length < 2 || plan.title.length > 180
    || !Number.isInteger(plan.durationSeconds) || plan.durationSeconds < 60 || plan.durationSeconds > 21600
    || typeof plan.markingReference !== 'string' || plan.markingReference.trim().length < 8
    || plan.markingReference.length > 2000 || !Array.isArray(plan.questions)
    || plan.questions.length < 1 || plan.questions.length > 200 || !Array.isArray(canonical?.records)) fail();
  const source = canonical.records.filter(record => record.exam === plan.exam
    && record.payload?.provenance?.year === plan.year
    && record.payload?.provenance?.paperId === plan.sourcePaperId
    && record.type !== 'DESCRIPTIVE' && Array.isArray(record.payload?.holds)
    && record.payload.holds.length === 0);
  if (source.length !== plan.questions.length) fail();
  if (plan.exam === 'uceed' && plan.year >= 2024 && plan.year <= 2026 && source.length !== 57) fail();
  const sourceByKey = new Map(source.map(record => [record.externalKey,record]));
  if (sourceByKey.size !== source.length) fail();
  const seen = new Set();
  for (const item of plan.questions) {
    const record = sourceByKey.get(item?.externalKey);
    const marking = item?.marking;
    if (!record || seen.has(item.externalKey) || item.contentSha256 !== record.contentSha256
      || typeof item.explanation !== 'string' || item.explanation.trim().length < 20
      || item.explanation.length > 10000 || !marking || typeof marking !== 'object'
      || Array.isArray(marking) || typeof marking.correct !== 'number' || !Number.isFinite(marking.correct)
      || marking.correct <= 0 || marking.correct > 100 || typeof marking.wrong !== 'number'
      || !Number.isFinite(marking.wrong) || marking.wrong > 0 || marking.wrong < -100) fail();
    seen.add(item.externalKey);
  }
  return {planSha256:sha256(stableJson(plan)),exam:plan.exam,year:plan.year,
    sourcePaperId:plan.sourcePaperId,partLabel:plan.partLabel,questionCount:source.length};
}

export function freeYearPaperProviderConfiguration(env) {
  const bank=bankProviderConfiguration(env);
  return {url:env.DMOCKS_SUPABASE_URL,serviceRoleKey:env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin:env.DMOCKS_PAPER_ALLOW_ORIGIN,environment:env.DMOCKS_PAPER_ENVIRONMENT,
    productionAck:env.DMOCKS_PAPER_PRODUCTION_ACK,
    expandedStagingProfile:bank.expandedStagingProfile,
    auditDatabaseUrl:bank.auditDatabaseUrl,auditDatabaseCaFile:bank.auditDatabaseCaFile};
}

async function main() {
  const {values}=parseArgs({options:{plan:{type:'string'},expect:{type:'string'},apply:{type:'boolean'},digest:{type:'boolean'},
    release:{type:'boolean'},'review-manifest':{type:'string'}}});
  if (!values.plan || ((values.apply || values.release) && !digest.test(values.expect??''))
    || (values.digest && (values.apply || values.release)) || (values.apply && values.release)
    || (values.release && !digest.test(values['review-manifest']??'')))
    throw new Error('Provide --plan; preparation requires --expect, and release also requires --review-manifest');
  let plan;
  try {const info=await stat(values.plan);if(!info.isFile()||info.size>2*1024*1024)throw new Error();
    plan=JSON.parse(await readFile(values.plan,'utf8'));}
  catch {throw new Error('The private year-paper plan is unreadable or too large');}
  const canonical=loadFromGit('origin/main');
  const summary=validateFreeYearPaperPlan(plan,canonical);
  if (values.digest) {console.log(JSON.stringify({mode:'review-digest',...summary}));return;}
  if (summary.planSha256!==values.expect) throw new Error('The plan changed after its review SHA-256 was recorded');
  if (!values.apply && !values.release) {console.log(JSON.stringify({mode:'dry-run',...summary}));return;}
  const provider=await openPrivateBankProvider(freeYearPaperProviderConfiguration(process.env),
  {acknowledgement:values.release?'RELEASE_FREE_YEAR_PAPER_ON':'PREPARE_FREE_YEAR_PAPER_ON'});
  const receipt=await provider.rpc('prepare_free_year_paper',{p_plan:plan});
  if (!uuid.test(receipt?.paperId??'') || !digest.test(receipt?.manifestSha256??'')
    || receipt.questionCount!==summary.questionCount || typeof receipt.created!=='boolean')
    throw new Error('The private target returned an invalid preparation receipt');
  if (values.release) {
    if (receipt.manifestSha256!==values['review-manifest'])
      throw new Error('The prepared paper differs from the separately reviewed manifest');
    const released=await provider.rpc('register_free_year_paper',{
      p_paper_id:receipt.paperId,p_exam:summary.exam,p_year:summary.year,
      p_source_paper_id:summary.sourcePaperId,p_part_label:summary.partLabel,
      p_question_count:summary.questionCount,p_review_sha256:receipt.manifestSha256,
    });
    if (released?.paperId!==receipt.paperId || released?.questionCount!==summary.questionCount)
      throw new Error('The private target returned an invalid release receipt');
    console.log(JSON.stringify({mode:'released-free-year-paper',...summary,paperId:receipt.paperId,
      manifestSha256:receipt.manifestSha256,questionCount:receipt.questionCount}));
    return;
  }
  console.log(JSON.stringify({mode:'prepared-for-review',...summary,...receipt}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
