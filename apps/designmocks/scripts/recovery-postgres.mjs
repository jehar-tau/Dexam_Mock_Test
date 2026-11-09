// Read-only source capture and local-only recovery verification. No migration RPC.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {RECOVERY_PROJECT} from './recovery-bundle.mjs';
import {stableJson} from './question-bank-import.mjs';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'",identifier=value=>'"'+String(value).replaceAll('"','""')+'"';
const sha=value=>createHash('sha256').update(stableJson(value)).digest('hex');
export function recoveryPostgresEnvironment(value,{localOnly=false}={}){
 let target;try{target=new URL(value);}catch{throw new Error('Invalid recovery database configuration');}
 assert.ok(['postgres:','postgresql:'].includes(target.protocol)&&!target.hash&&!target.search&&target.pathname.length>1,'A direct or session-pooler PostgreSQL connection is required');
 const user=decodeURIComponent(target.username),hostname=target.hostname;
 if(localOnly)assert.ok(['localhost','127.0.0.1','[::1]'].includes(hostname),'Recovery verification permits only an isolated localhost database');
 else assert.ok(target.pathname==='/postgres'&&(target.port===''||target.port==='5432')&&((hostname===`db.${RECOVERY_PROJECT}.supabase.co`&&user==='postgres')||(/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(hostname)&&user===`postgres.${RECOVERY_PROJECT}`)),'Only the standalone DMocks database and session pooler are permitted');
 assert.ok(user&&target.password,'Private database credentials are required');
 const environment={...process.env};for(const key of Object.keys(environment))if(key.startsWith('PG'))delete environment[key];
 Object.assign(environment,{PGHOST:hostname.replace(/^\[|\]$/g,''),PGPORT:target.port||'5432',PGUSER:user,PGPASSWORD:decodeURIComponent(target.password),PGDATABASE:decodeURIComponent(target.pathname.slice(1)),PGCONNECT_TIMEOUT:'10',PGAPPNAME:'dmocks-recovery',PGSSLMODE:localOnly?'disable':'verify-full',...(!localOnly?{PGSSLROOTCERT:'system'}:{})});
 return environment;
}
export async function openRecoveryPostgres(url,{localOnly=false,spawnClient=(command,args,options)=>spawn(command,args,options)}={}){
 const env=recoveryPostgresEnvironment(url,{localOnly}),child=spawnClient('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-P','pager=off'],{env,stdio:['pipe','pipe','pipe']});
 let buffer='',pending=null,closed=false,code=null;
 const finished=new Promise((resolve,reject)=>{child.on('error',()=>{code=-1;pending?.reject(new Error('Recovery database client failed'));pending=null;reject(new Error('Recovery database client failed'));});child.on('close',value=>{code=value;pending?.reject(new Error('Recovery database command failed'));pending=null;resolve(value);});});finished.catch(()=>{});
 child.stdin.on('error',()=>{pending?.reject(new Error('Recovery database command failed'));pending=null;});
 child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>96*1024**2){pending?.reject(new Error('Recovery database response exceeds its supported limit'));child.kill('SIGTERM');return;}if(pending){const at=buffer.indexOf(pending.marker+'\n');if(at>=0){const value=buffer.slice(0,at);buffer=buffer.slice(at+pending.marker.length+1);const active=pending;pending=null;active.resolve(value.trim());}}});
 // PostgreSQL diagnostics can contain private row values. They are never logged.
 child.stderr.resume();
 async function query(statement){assert.ok(!closed&&code===null&&!pending,'Recovery database session is unavailable');const marker='DMOCKS_RECOVERY_'+randomUUID().replaceAll('-','');let timer;try{return await new Promise((resolve,reject)=>{pending={marker,resolve,reject};timer=setTimeout(()=>{pending=null;child.kill('SIGTERM');reject(new Error('Recovery database command timed out'));},120000);child.stdin.write(statement+';\n\\echo '+marker+'\n',error=>{if(error){pending=null;reject(new Error('Recovery database command failed'));}});});}finally{clearTimeout(timer);}}
 async function close(){if(!closed){closed=true;if(code===null)child.stdin.end('rollback;\n\\q\n');}await finished;}
 async function* dump(snapshot){assert.match(snapshot,/^[0-9A-F]+-[0-9A-F]+-[0-9A-F]+$/i,'Invalid exported recovery snapshot');
  const dumping=spawnClient('pg_dump',['--format=custom','--no-password','--snapshot='+snapshot],{env,stdio:['ignore','pipe','pipe']});dumping.stderr.resume();const completion=new Promise((resolve,reject)=>{dumping.on('error',()=>reject(new Error('Recovery database export failed')));dumping.on('close',resolve);});completion.catch(()=>{});
  try{for await(const chunk of dumping.stdout)yield chunk;assert.equal(await completion,0,'Recovery database export failed');}finally{if(dumping.exitCode===null)dumping.kill('SIGTERM');}
 }
 try{await query("begin isolation level repeatable read read only;set local timezone='UTC';set local search_path=pg_catalog;set local row_security=off;set local statement_timeout='90s';set local idle_in_transaction_session_timeout='30min'");return{query,dump,close,async exportSnapshot(){const value=await query('select pg_export_snapshot()');assert.match(value,/^[0-9A-F]+-[0-9A-F]+-[0-9A-F]+$/i);return value;}};}catch(error){await close();throw error;}
}
const schemas="('public','dm_private','auth','storage','supabase_migrations')";
export const recoverySchemaQuery=`select jsonb_build_object(
 'extensions',(select coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)order by e.extname),'[]')from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'relations',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))order by a.attnum)from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'acl',(select coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',case when x.grantee=0 then'PUBLIC'else pg_get_userbyid(x.grantee)end,'privilege',x.privilege_type,'grantable',x.is_grantable)order by x.grantee::regrole::text,x.privilege_type,x.is_grantable),'[]')from aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S'then'S'::"char"else'r'::"char"end,c.relowner)))x))order by n.nspname,c.relname),'[]')from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas}and c.relkind in('r','p','v','m','S')),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',(select jsonb_agg(r order by r)from unnest(roles)r),'command',cmd,'using',qual,'check',with_check)order by schemaname,tablename,policyname),'[]')from pg_policies where schemaname in ${schemas}),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid))order by n.nspname,c.relname,x.conname),'[]')from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas}),
 'indexes',(select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef)order by schemaname,tablename,indexname),'[]')from pg_indexes where schemaname in ${schemas}),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',(select coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',case when x.grantee=0 then'PUBLIC'else pg_get_userbyid(x.grantee)end,'privilege',x.privilege_type,'grantable',x.is_grantable)order by x.grantee::regrole::text,x.privilege_type,x.is_grantable),'[]')from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x))order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${schemas}and p.prokind in('f','p','w')),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid))order by n.nspname,c.relname,t.tgname),'[]')from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas}and not t.tgisinternal),
 'views',(select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'name',viewname,'definition',definition)order by schemaname,viewname),'[]')from pg_views where schemaname in ${schemas}),
 'defaults',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'kind',d.defaclobjtype,'acl',(select jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',case when x.grantee=0 then'PUBLIC'else pg_get_userbyid(x.grantee)end,'privilege',x.privilege_type,'grantable',x.is_grantable)order by x.grantee::regrole::text,x.privilege_type,x.is_grantable)from aclexplode(d.defaclacl)x))order by pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype),'[]')from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ${schemas}or d.defaclnamespace=0))`;
export const recoveryObjectsQuery=`select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name,'owner',coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner'),'contentType',o.metadata->>'mimetype','cacheControl',o.metadata->>'cacheControl','byteSize',(o.metadata->>'size')::bigint,'userMetadata',to_jsonb(o)->'user_metadata','version',to_jsonb(o)->>'version')order by o.bucket_id,o.name),'[]')from storage.objects o`;
export const recoveryBucketsQuery=`select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',(select jsonb_agg(t order by t)from unnest(allowed_mime_types)t))order by id),'[]')from storage.buckets`;
export async function checkRecoveryDatabaseSource(connection, {sourceStage = 'mvp', expectedVersions} = {}) {
  assert.ok(['mvp', 'pre-upgrade'].includes(sourceStage), 'Unknown recovery source stage');
  if (sourceStage === 'pre-upgrade') {
    assert.ok(Array.isArray(expectedVersions) && expectedVersions.length > 0, 'A complete reviewed migration ledger is required');
    const withoutProfile = await connection.query(`select not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dm_private' and left(c.relname, 4) = 'mvp_'
    ) and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'dm_private' and left(p.proname, 4) = 'mvp_'
    )`);
    assert.equal(withoutProfile, 't', 'Pre-upgrade recovery requires a database before the MVP profile');
  } else {
    assert.equal(await connection.query('select dm_private.mvp_profile_permissions_valid()'), 't', 'Apply the exact MVP permissions profile before backup or verification');
  }
  const hasLedger = await connection.query("select to_regclass('supabase_migrations.schema_migrations') is not null");
  const versions = hasLedger === 't'
    ? JSON.parse(await connection.query("select coalesce(jsonb_agg(version order by version),'[]') from supabase_migrations.schema_migrations"))
    : [];
  if (expectedVersions !== undefined) {
    assert.deepEqual(versions, expectedVersions, 'Installed migration history does not match the reviewed recovery ledger');
  }
  return versions;
}

export async function captureRecoverySnapshot(connection, {sourceStage = 'mvp', expectedVersions} = {}) {
 const migrationVersions = await checkRecoveryDatabaseSource(connection, {sourceStage, expectedVersions});
 const schema=JSON.parse(await connection.query(recoverySchemaQuery)),relations=JSON.parse(await connection.query(`select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname)order by n.nspname,c.relname),'[]')from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas}and c.relkind in('r','p')`));
 const rows=[];for(const table of relations){const query=`select jsonb_build_object('schema',${quote(table.schema)},'name',${quote(table.name)},'count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),''order by encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')),''),'UTF8')),'hex'))from only ${identifier(table.schema)}.${identifier(table.name)}t`;rows.push(JSON.parse(await connection.query(query)));}
 const buckets=JSON.parse(await connection.query(recoveryBucketsQuery)),objects=JSON.parse(await connection.query(recoveryObjectsQuery));assert.ok(buckets.every(bucket=>bucket.public===false),'Every restored DMocks bucket must remain private');assert.ok(objects.every(object=>buckets.some(bucket=>bucket.id===object.bucket)),'Unbound storage object');
 const version=Number(await connection.query("select current_setting('server_version_num')"));assert.equal(Math.floor(version/10000),17,'Recovery currently requires PostgreSQL 17');
 const sequences=JSON.parse(await connection.query(`select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'name',sequencename,'value',last_value,'start',start_value,'increment',increment_by)order by schemaname,sequencename),'[]')from pg_sequences where schemaname in ${schemas}`));
 return{version:1,postgresMajor:17,sourceStage,migrationVersions,schemaSha256:sha(schema),schema,rows,dataSha256:sha(rows),sequences,buckets,objects,storageInventorySha256:sha({buckets,objects})};
}
export function compareRecoverySnapshots(expected,actual,{includeStorageRows=true}={}){
 assert.equal(actual.sourceStage ?? 'mvp', expected.sourceStage ?? 'mvp', 'Recovered source stage differs');
 assert.deepEqual(actual.migrationVersions, expected.migrationVersions, 'Recovered migration history differs');
 assert.equal(actual.schemaSha256,expected.schemaSha256,'Recovered schema, RLS or privileges differ');
 const select=rows=>rows.filter(row=>includeStorageRows||row.schema!=='storage');assert.deepEqual(select(actual.rows),select(expected.rows),'Recovered database rows differ');
 for(const sequence of expected.sequences){const recovered=actual.sequences.find(row=>row.schema===sequence.schema&&row.name===sequence.name);assert.ok(recovered&&recovered.increment===sequence.increment&&recovered.start===sequence.start&&(sequence.value==null||recovered.value>=sequence.value),'Recovered sequence can reuse an existing identifier');}
 if(includeStorageRows)assert.deepEqual(actual.buckets,expected.buckets,'Recovered private bucket configuration differs');return true;
}
