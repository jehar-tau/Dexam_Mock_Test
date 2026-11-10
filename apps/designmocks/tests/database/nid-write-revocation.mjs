// Runs only after bootstrap on the explicitly disposable localhost database.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
export async function verifyNidWriteRevocation(executor){
 const cases=[];
 async function run(source,name='nid-control'){
  const child=executor(),output={code:null,stdout:'',stderr:''};
  child.stdout.on('data',chunk=>{output.stdout+=chunk;});child.stderr.on('data',chunk=>{output.stderr+=chunk;});
  // The process can exit before psql's final SQLSTATE arrives on stderr.
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{output.code=code;resolve(output);});});
  child.stdin.end(`set application_name=${quote(name)};set statement_timeout='12s';\n`+source+'\n');return done;
 }
 async function sql(source){const result=await run(source);assert.equal(result.code,0,'Original isolated concurrency fixture command failed');return result.stdout.trim();}
 async function fence(source){
  const child=executor();let output='',resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('NID_FENCE_READY'))resolveReady();});child.stderr.resume();
  const ended=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{if(code!==0)reject(new Error('Original isolated concurrency fence failed'));else resolve();});});ended.catch(error=>rejectReady(error));
  child.stdin.write("begin;set idle_in_transaction_session_timeout='20s';"+source+";\n\\echo NID_FENCE_READY\n");
  let timer;try{await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Original isolated fence readiness timeout')),6000);})]);}finally{clearTimeout(timer);}
  return async()=>{child.stdin.end('rollback;\n\\q\n');await ended;};
 }
 async function blocked(name){
  for(let n=0;n<100;n++){
   if(await sql(`select exists(select 1 from pg_stat_activity where application_name=${quote(name)}and state='active'and wait_event_type='Lock');`)==='t')return;
   await new Promise(resolve=>setTimeout(resolve,40));
  }
  throw new Error('The authenticated NID operation did not reach its expected database fence');
 }
 assert.equal(await sql('select dm_private.mvp_profile_permissions_valid();'),'t','Apply the exact companion MVP profile before concurrency checks');
 for(const kind of['bind-request','bind-blueprint-row','bind-question-advisory','bind-question-row','bind-replay','save-request','save-blueprint-advisory','save-blueprint-row','save-replay','save-dependent-question','review-request','review-blueprint-advisory','review-version-row','review-replay','final-question-review']){
  const actor=randomUUID(),bp=randomUUID(),request=randomUUID(),key='nid-lock-'+randomUUID(),worker='nid-worker-'+randomUUID();let release,waiting;
  const payload={schemaVersion:'nid-authored-practice-v1',title:'Original fictional lock practice',purpose:'Original fictional concurrency proof with explicit authored practice settings.',durationMinutes:5,uploadGraceMinutes:0,sections:[{label:'Observation',kind:'mcq',count:1,points:2,penalty:0,rubric:[]}]};
  const source={externalKey:key,provenance:{exam:'nid'},type:'MCQ',topic:'original-observation',prompt:'Original fictional lock-fence question.',holds:[],assets:[],visualDependency:false,options:[{key:'A',text:'Original first option'},{key:'B',text:'Original second option'},{key:'C',text:'Original third option'}],answer:{status:'human-reviewed',raw:'B'}};
  const authenticated=statement=>`begin;set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub',${quote(actor)},true);${statement};commit;`;
  try{
   await sql(`begin;insert into auth.users(id)values(${quote(actor)});insert into dm_private.admins(user_id)values(${quote(actor)});insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)values(${quote(key)},repeat('a',64),'nid','MCQ','original-observation','owned',${quote(JSON.stringify(source))}::jsonb,repeat('b',40));commit;`);
   await sql(authenticated(`select public.admin_save_nid_practice_blueprint(${quote(bp)},0,${quote(JSON.stringify(payload))}::jsonb,gen_random_uuid())`));
   const sha=await sql(`select content_sha256 from dm_private.nid_practice_blueprint_versions where blueprint_id=${quote(bp)}and revision=1;`);
   const version=await sql(`select dm_private.bank_review_version(q)from dm_private.bank_questions q where external_key=${quote(key)};`);
   const review=`select public.admin_review_nid_practice_blueprint(${quote(bp)},1,${quote(sha)},'reviewed','Original fictional authored settings and exact rubric reviewed.',${quote(kind.startsWith('review-')?request:randomUUID())})`;
   if(!kind.startsWith('review-'))await sql(authenticated(review));
   const bind=`select public.admin_bind_nid_question(${quote(key)},${quote(version)},${quote(bp)},1,${quote(sha)},1,'Original fictional source and authored section inspected.',${quote(request)})`;
   const save=`select public.admin_save_nid_practice_blueprint(${quote(bp)},1,${quote(JSON.stringify({...payload,durationMinutes:6}))}::jsonb,${quote(request)})`;
   let command=kind.startsWith('bind-')?bind:kind.startsWith('review-')?review:save;
   if(['bind-replay','save-replay','review-replay'].includes(kind))await sql(authenticated(command));
   if(kind==='save-dependent-question')await sql(authenticated(bind));
   if(kind==='final-question-review')command=`select public.admin_review_bank_question(${quote(key)},false,false,'Original fictional exact-version correction decision.',${quote(version)})`;
   let held;
   if(kind.startsWith('bind-')&&(kind==='bind-request'||kind==='bind-replay'))held=`select pg_advisory_xact_lock(hashtextextended(${quote(request)},152))`;
   else if(kind.endsWith('-request')||kind.endsWith('-replay'))held=`select pg_advisory_xact_lock(hashtextextended(${quote(request)},149))`;
   else if(kind.endsWith('blueprint-advisory'))held=`select pg_advisory_xact_lock(hashtextextended(${quote(bp)},150))`;
   else if(kind.endsWith('blueprint-row'))held=`select 1 from dm_private.nid_practice_blueprints where id=${quote(bp)}for update`;
   else if(kind==='bind-question-advisory'||kind==='save-dependent-question')held=`select pg_advisory_xact_lock(hashtextextended(${quote(key)},151))`;
   else if(kind==='review-version-row')held=`select 1 from dm_private.nid_practice_blueprint_versions where blueprint_id=${quote(bp)}and revision=1 for update`;
   else held=`select 1 from dm_private.bank_questions where external_key=${quote(key)}for update`;
   const fingerprint=()=>sql(`select md5(jsonb_build_object('question',(select to_jsonb(q)from dm_private.bank_questions q where external_key=${quote(key)}),'blueprint',(select to_jsonb(b)from dm_private.nid_practice_blueprints b where id=${quote(bp)}),'versions',(select jsonb_agg(to_jsonb(v)order by revision)from dm_private.nid_practice_blueprint_versions v where blueprint_id=${quote(bp)}),'requests',(select jsonb_agg(to_jsonb(r)order by request_id)from dm_private.nid_practice_blueprint_requests r where blueprint_id=${quote(bp)}),'bindings',(select jsonb_agg(to_jsonb(x)order by id)from dm_private.nid_question_bindings x where external_key=${quote(key)}),'bindingRequests',(select jsonb_agg(to_jsonb(r)order by request_id)from dm_private.nid_question_binding_requests r where external_key=${quote(key)}),'head',(select to_jsonb(h)from dm_private.nid_question_binding_heads h where external_key=${quote(key)}),'reviews',(select jsonb_agg(to_jsonb(r)order by id)from dm_private.bank_question_reviews r where external_key=${quote(key)}))::text);`);
   const before=await fingerprint();
   release=await fence(held);waiting=run(authenticated(command),worker);await blocked(worker);
   // Revocation commits while the operation is genuinely waiting elsewhere.
   await sql(`delete from dm_private.admins where user_id=${quote(actor)};`);await release();release=null;
   const result=await waiting;waiting=null;const denied=result.code!==0&&result.stderr.includes('42501');
   const unchanged=await fingerprint()===before;
   cases.push({name:kind,deniedAfterCommittedRevocation:denied,unexpectedlyAccepted:result.code===0,sqlstate:result.stderr.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1]??null,stateUnchanged:unchanged,passed:denied&&unchanged});
  }finally{
   await release?.();if(waiting)await waiting;
   await sql(`begin;delete from dm_private.nid_question_binding_requests where actor_id=${quote(actor)};delete from dm_private.nid_question_binding_heads where external_key=${quote(key)};delete from dm_private.nid_question_bindings where external_key=${quote(key)};delete from dm_private.bank_question_reviews where external_key=${quote(key)};delete from dm_private.bank_questions where external_key=${quote(key)};delete from dm_private.nid_practice_blueprint_requests where blueprint_id=${quote(bp)};delete from dm_private.nid_practice_blueprint_versions where blueprint_id=${quote(bp)};delete from dm_private.nid_practice_blueprints where id=${quote(bp)};delete from dm_private.admins where user_id=${quote(actor)};delete from auth.users where id=${quote(actor)};commit;`);
  }
 }
 return{passed:cases.every(value=>value.passed),actualAuthenticatedDatabaseLocks:true,fictionalFixtures:true,committedRevocationWhileWaiting:true,cases};
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const address=new URL(process.env.DESIGNMOCKS_TEST_DATABASE_URL??'invalid:');
 assert.ok(['postgres:','postgresql:'].includes(address.protocol)&&['localhost','127.0.0.1','[::1]'].includes(address.hostname),'Concurrency regression permits only the disposable localhost database');
 // The URL is kept in the environment, including in child error paths.
 const connection={...process.env};for(const key of Object.keys(connection))if(key.startsWith('PG'))delete connection[key];
 Object.assign(connection,{PGHOST:address.hostname.replace(/^\[|\]$/g,''),PGPORT:address.port||'5432',PGDATABASE:decodeURIComponent(address.pathname.slice(1)),PGUSER:decodeURIComponent(address.username)||process.env.USER,PGPASSWORD:decodeURIComponent(address.password),PGCONNECT_TIMEOUT:'5'});
 const executor=()=>spawn('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env:connection,stdio:['pipe','pipe','pipe']});
 verifyNidWriteRevocation(executor).then(result=>{console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;}).catch(()=>{console.error('NID_WRITE_REVOCATION_REGRESSION_FAILED');process.exitCode=1;});
}
