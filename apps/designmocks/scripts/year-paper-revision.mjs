// Private operator: stage the reviewed source for one complete CEED/UCEED paper.
// Privileged database access is only used for an exact Test target and the
// private staging table. Rehearsal/release use the service RPC; approval uses
// the normal signed-in reviewer account.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import project from '../supabase/project.json' with {type:'json'};
import {loadFromGit,sha256} from './question-bank-import.mjs';
import {validateFreeYearPaperPlan} from './prepare-free-year-paper.mjs';
import {planCanonicalMedia} from './private-bank-media.mjs';
import {inspectRuntimeQuestion,RULES_2027} from './question-runtime.mjs';
import {recoveryPostgresEnvironment} from './recovery-postgres.mjs';

const hash=/^[a-f0-9]{64}$/;
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function stableId(name) {
  const hex=sha256('dmocks-year-paper-revision/'+name);
  return [hex.slice(0,8),hex.slice(8,12),'8'+hex.slice(13,16),'a'+hex.slice(17,20),hex.slice(20,32)].join('-');
}
export async function buildYearPaperRevision({plan,expected,canonical,base,mediaRoot}) {
  const reviewed=validateFreeYearPaperPlan(plan,canonical);
  assert.equal(reviewed.planSha256,expected,'Private plan digest changed');
  assert.ok(['ceed','uceed'].includes(plan.exam) && plan.sourcePaperId===plan.exam+'-'+plan.year,'Expected a CEED or UCEED year paper');
  const current=new Map(base.items.map(row=>[row.externalKey,row]));
  assert.equal(current.size,plan.questions.length,'Hosted objective source group changed');
  const byKey=new Map(canonical.records.map(row=>[row.externalKey,row]));
  const records=plan.questions.map(item=>byKey.get(item.externalKey));
  const figures=await planCanonicalMedia({...canonical,records},mediaRoot);
  const catalog=figures.assets.map(a=>({sha256:a.sha256,path:a.storagePath,width:a.width,height:a.height,byteSize:a.byteSize}));
  const items=records.map((record,index)=>{
    const prior=current.get(record.externalKey);
    assert.ok(prior && hash.test(prior.contentSha256),'Missing current source '+record.externalKey);
    if (base.paperId) assert.ok(prior.id && prior.ordinal===index+1,'Existing question identity changed at '+record.externalKey);
    const conversion=inspectRuntimeQuestion(record.payload,{rule:RULES_2027[plan.exam],mediaCatalog:catalog});
    assert.ok(conversion.runtime,'Unusable question '+record.externalKey+': '+conversion.issues.map(i=>i.code).join(', '));
    return {id:prior.id??stableId('question/'+plan.sourcePaperId+'/'+record.externalKey),previousContentSha256:prior.contentSha256,
      record:{externalKey:record.externalKey,contentSha256:record.contentSha256,exam:record.exam,type:record.type,topic:record.topic,licence:record.licence,payload:record.payload},
      runtime:conversion.runtime};
  });
  const prefix=plan.sourcePaperId+'/figures/';
  const media=figures.assets.filter(a=>a.relativePath.startsWith(prefix) && !a.relativePath.slice(prefix.length).includes('/'))
    .map(({sha256,storagePath,width,height,byteSize})=>({sha256,storagePath,width,height,byteSize}));
  return {format:'dmocks-year-revision-v1',sourceCommit:canonical.sourceCommit,planSha256:expected,
    paperId:base.paperId??stableId('paper/'+plan.sourcePaperId),baseManifest:base.manifest??null,plan,media,items};
}
const baseQuery=source=>`with released as (select paper_id,review_sha256 from dm_private.year_paper_releases where source_paper_id=${quote(source)}),
  identities as (select q.id,q.ordinal,k.key->>'sourceExternalKey' external_key from released r join dm_private.questions q on q.paper_id=r.paper_id join dm_private.answer_keys k on k.question_id=q.id)
  select jsonb_build_object('paperId',(select paper_id from released),'manifest',(select review_sha256 from released),'items',
    (select jsonb_agg(jsonb_build_object('externalKey',b.external_key,'contentSha256',b.content_sha256,'id',i.id,'ordinal',i.ordinal) order by b.external_key)
    from dm_private.bank_questions b left join identities i using(external_key) where b.active and b.payload#>>'{provenance,paperId}'=${quote(source)}
      and b.question_type<>'DESCRIPTIVE' and b.payload->'holds'='[]'::jsonb));`;
async function main() {
  const {values}=parseArgs({options:{plan:{type:'string'},expect:{type:'string'},stage:{type:'boolean'},rehearse:{type:'string'},publish:{type:'string'},'review-manifest':{type:'string'}}});
  const cfg=process.env;
  const origin='https://'+project.project_ref+'.supabase.co';
  assert.equal(cfg.DMOCKS_SUPABASE_URL?.replace(/\/$/,''),origin,'Expected the approved DMocks Test project');
  if (values.rehearse||values.publish) {
    assert.ok(!values.stage&&!values.plan&&!values.expect&&!(values.rehearse&&values.publish),'Choose one operation');
    const digest=values.rehearse??values.publish,manifest=values['review-manifest']??null;
    assert.ok(hash.test(digest)&&(values.publish?hash.test(manifest):manifest===null),'Exact revision or review digest required');
    const client=createClient(origin,cfg.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data,error}=await client.rpc('publish_year_paper_revision',{p_digest:digest,p_manifest:manifest});
    if (error) throw Error('Year-paper revision failed ('+error.code+'): '+error.message);
    assert.ok(hash.test(data) && (!manifest||data===manifest),'Unexpected manifest receipt');
    console.log(JSON.stringify({action:values.publish?'released':'rehearsed',digest,manifestSha256:data}));return;
  }
  assert.ok(values.plan && hash.test(values.expect) && !values['review-manifest'],'Specify a private plan and expected digest');
  const plan=JSON.parse(await readFile(values.plan,'utf8'));
  const canonical=loadFromGit('origin/main');
  const summary=validateFreeYearPaperPlan(plan,canonical);assert.equal(summary.planSha256,values.expect);
  const env=recoveryPostgresEnvironment(cfg.DMOCKS_RECOVERY_DATABASE_URL,{databaseCaFile:cfg.DMOCKS_RECOVERY_DATABASE_CA_FILE});
  const sql=query=>{
    try {return execFileSync('psql',['-XqAt','-v','ON_ERROR_STOP=1'],{env,input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024}).trim();}
    catch(error) {throw Error('Year-paper database operation failed: '+(error.stderr?.split('\n').find(line=>line.startsWith('ERROR:'))??'connection failed'));} };
  assert.equal(sql("select environment_mode||'|'||sales_enabled::text from public.launch_settings where singleton"),'test|false','Expected closed sales on the designated Test project');
  const base=JSON.parse(sql(baseQuery(plan.sourcePaperId)));
  const doc=await buildYearPaperRevision({plan,expected:values.expect,canonical,base,mediaRoot:cfg.DMOCKS_MEDIA_ROOT});
  const json=quote(JSON.stringify(doc));
  const input=`with revision as (select ${json}::jsonb as doc), staged as (select doc,encode(sha256(convert_to(doc::text,'UTF8')),'hex') as sha from revision)`;
  const digest=values.stage?sql(input+' insert into dm_private.year_paper_revisions(digest,document) select sha,doc from staged on conflict(digest) do update set digest=excluded.digest returning digest;'):
    sql(input+' select sha from staged;');
  assert.ok(hash.test(digest),'Invalid revision receipt');
  console.log(JSON.stringify({...summary,action:values.stage?'staged':'dry-run',digest,paperId:doc.paperId,crops:doc.media.length}));
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
