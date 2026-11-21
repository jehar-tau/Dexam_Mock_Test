import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import {RECOVERY_PROJECT,createRecoveryBundle,verifyRecoveryBundle} from '../scripts/recovery-bundle.mjs';
import {recoveryPostgresEnvironment,compareRecoverySnapshots,normalizeRecoverySchema} from '../scripts/recovery-postgres.mjs';
import {validateRecoveryCaptureConfiguration,restoreLocalRecoveryObjects,verifyPrivateRecovery} from '../scripts/private-recovery.mjs';
const token=claims=>'x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.x',owner='10000000-0000-4000-8000-000000002450';
const config=()=>({url:`https://${RECOVERY_PROJECT}.supabase.co`,key:token({role:'service_role',ref:RECOVERY_PROJECT}),databaseUrl:`postgresql://postgres:fictional%40password@db.${RECOVERY_PROJECT}.supabase.co:5432/postgres`,recoveryKey:randomBytes(32).toString('hex'),releaseSha:'a'.repeat(40)});
async function fixture(run){const folder=await mkdtemp(path.join(os.tmpdir(),'dmocks-private-recovery-'));try{const key=randomBytes(32).toString('hex'),bytes=Buffer.from('Original fictional recovery object.'),objects=[{bucket:'paper-media',name:'original/null-owner',owner:null,byteSize:bytes.length,contentType:'image/png',cacheControl:'max-age=3600',userMetadata:{originalFictional:true}},{bucket:'paper-media',name:'original/owned',owner,byteSize:bytes.length,contentType:'image/png',cacheControl:'max-age=3600',userMetadata:{originalFictional:true}}];await createRecoveryBundle({output:path.join(folder,'backup'),key,source:{projectRef:RECOVERY_PROJECT,releaseSha:'a'.repeat(40)},snapshot:{original:true},database:Readable.from([Buffer.from('PGDMP-original-fictional')]),objects,readObject:async()=>Readable.from([bytes]),assertUnchanged:async()=>true});const verified=await verifyRecoveryBundle({directory:path.join(folder,'backup'),key,extractTo:path.join(folder,'extracted')});await run({folder,key,verified,bytes});}finally{await rm(folder,{recursive:true,force:true});}}
const restoration=verified=>({verified,url:'http://127.0.0.1:64321',key:token({role:'service_role'}),ownerKey:async sub=>token({role:'service_role',sub}),assertDatabaseRestored:async()=>true,assertStorageRestored:async()=>true});
test('recovery capture pins both Storage and PostgreSQL to the standalone project',()=>{
 assert.equal(validateRecoveryCaptureConfiguration(config()),true);const pooler=config();pooler.databaseUrl=`postgresql://postgres.${RECOVERY_PROJECT}:fictional@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;assert.equal(validateRecoveryCaptureConfiguration(pooler),true);
 for(const change of[{url:'https://another-project.supabase.co'},{databaseUrl:'postgresql://postgres:fictional@127.0.0.1:5432/postgres'},{databaseUrl:'postgresql://postgres:fictional@db.another-project.supabase.co:5432/postgres'},{key:token({role:'anon',ref:RECOVERY_PROJECT})},{key:token({role:'service_role',ref:'another-project'})},{recoveryKey:'a human password'},{releaseSha:'main'}])assert.throws(()=>validateRecoveryCaptureConfiguration({...config(),...change}));
});
test('PostgreSQL uses decoded private environment fields and refuses transaction poolers or URI options',()=>{
 const env=recoveryPostgresEnvironment(config().databaseUrl);assert.equal(env.PGPASSWORD,'fictional@password');assert.equal(env.PGHOST,`db.${RECOVERY_PROJECT}.supabase.co`);assert.equal(env.PGSSLMODE,'verify-full');assert.equal(env.PGSSLROOTCERT,'system');
 for(const value of[`postgresql://postgres.${RECOVERY_PROJECT}:fictional@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`,config().databaseUrl+'?options=malformed',config().databaseUrl.replace('/postgres','/another'),config().databaseUrl.replace('postgres:','other:')])assert.throws(()=>recoveryPostgresEnvironment(value));
 assert.equal(recoveryPostgresEnvironment('postgresql://postgres:fictional@127.0.0.1:64322/recovery',{localOnly:true}).PGDATABASE,'recovery');assert.throws(()=>recoveryPostgresEnvironment(config().databaseUrl,{localOnly:true}));
});
test('hosted recovery uses a project CA file with hostname verification', async () => {
 const directory = await mkdtemp(path.join(os.tmpdir(), 'dmocks-recovery-ca-'));
 try {
   const databaseCaFile = path.join(directory, 'project-root.crt');
   await writeFile(databaseCaFile, 'Certificate fixture for path validation.');
   const directUrl = config().databaseUrl;
   const poolerUrl = `postgresql://postgres.${RECOVERY_PROJECT}:fictional@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
   for (const databaseUrl of [directUrl, poolerUrl]) {
     const env = recoveryPostgresEnvironment(databaseUrl, {databaseCaFile});
     assert.equal(env.PGSSLMODE, 'verify-full');
     assert.equal(env.PGSSLROOTCERT, databaseCaFile);
   }
   const emptyFile = path.join(directory, 'empty.crt');
   const linkedFile = path.join(directory, 'linked.crt');
   await writeFile(emptyFile, '');
   await symlink(databaseCaFile, linkedFile);
   for (const invalidPath of ['', 'project-root.crt', directory, emptyFile, linkedFile, path.join(directory, 'missing.crt')]) {
     assert.throws(() => recoveryPostgresEnvironment(directUrl, {databaseCaFile: invalidPath}), /database CA certificate/);
   }
   const local = recoveryPostgresEnvironment('postgresql://postgres:fictional@127.0.0.1:64322/recovery',
     {localOnly: true, databaseCaFile});
   assert.equal(local.PGSSLMODE, 'disable');
   assert.equal(local.PGSSLROOTCERT, undefined);
 } finally {
   await rm(directory, {recursive: true, force: true});
 }
});
test('integrity verification explicitly cannot approve database restoration or a hosted release',()=>fixture(async({folder,key})=>{const result=await verifyPrivateRecovery({directory:path.join(folder,'backup'),key});assert.equal(result.databaseRestoreAccepted,false);assert.equal(result.hostedWritesPerformed,false);assert.equal(result.privateObjects,2);assert.equal(result.source,undefined);assert.equal(result.snapshot,undefined);}));
test('media restoration refuses a hosted target or unmatched database before sending any bytes',()=>fixture(async({verified})=>{let calls=0;const fetchImpl=async()=>{calls++;throw new Error('Unexpected mutation');};await assert.rejects(restoreLocalRecoveryObjects({...restoration(verified),url:'https://tiodqzvvujxvxssvjdis.supabase.co'},{fetchImpl}),/isolated loopback/);await assert.rejects(restoreLocalRecoveryObjects({...restoration(verified),assertDatabaseRestored:async()=>false},{fetchImpl}),/matching database snapshot/);assert.equal(calls,0);}));
test('every owner credential is checked before any file is restored',()=>fixture(async({verified})=>{let calls=0;for(const ownerKey of[undefined,async()=>token({role:'authenticated',sub:owner}),async()=>token({role:'service_role',sub:'another-owner'})])await assert.rejects(restoreLocalRecoveryObjects({...restoration(verified),ownerKey},{fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);}));
test('a changed extracted object cannot be uploaded',()=>fixture(async({verified})=>{let calls=0;await writeFile(path.join(verified.extractedDirectory,'payload-000002.bin'),'changed');await assert.rejects(restoreLocalRecoveryObjects(restoration(verified),{fetchImpl:async()=>{calls++;}}),/payload/);assert.equal(calls,0);}));
test('local restoration preserves raw cache headers, ownership and user metadata and checks downloaded bytes',()=>fixture(async({verified,bytes})=>{
 const uploads=[];const fetchImpl=async(address,options)=>{assert.ok(address.startsWith('http://127.0.0.1:64321/storage/v1/object/paper-media/'));assert.equal(options.redirect,'error');if(options.method==='POST'){const parts=[];for await(const part of options.body)parts.push(part);assert.deepEqual(Buffer.concat(parts),bytes);assert.equal(options.headers['content-length'],String(bytes.length),'Actual Storage rejects streaming uploads without their exact content length');assert.equal(options.headers['cache-control'],'max-age=3600');assert.deepEqual(JSON.parse(Buffer.from(options.headers['x-metadata'],'base64')), {originalFictional:true});uploads.push(options.headers);return Response.json({originalFictional:true});}return new Response(bytes);};
 const result=await restoreLocalRecoveryObjects(restoration(verified),{fetchImpl});assert.equal(result.restoredObjects,2);assert.equal(result.hostedWritesPerformed,false);assert.equal(uploads.length,2);assert.equal(JSON.parse(Buffer.from(uploads[1].authorization.split('.')[1],'base64url')).sub,owner);
}));
test('a byte or metadata mismatch never becomes accepted restoration',()=>fixture(async({verified,bytes})=>{const fetchImpl=async(address,options)=>options.method==='POST'?Response.json({}):new Response(bytes);await assert.rejects(restoreLocalRecoveryObjects({...restoration(verified),assertStorageRestored:async()=>false},{fetchImpl}),/ownership or metadata/);await assert.rejects(restoreLocalRecoveryObjects(restoration(verified),{fetchImpl:async(address,options)=>options.method==='POST'?Response.json({}):new Response('wrong bytes')}),/size|bytes/);}));
test('restored row/schema differences and identifier reuse remain failures',()=>{
 const expected={schemaSha256:'a'.repeat(64),rows:[{schema:'dm_private',name:'original_attempt',count:1,sha256:'b'.repeat(64)}],buckets:[],sequences:[{schema:'dm_private',name:'original_audit',value:8,start:1,increment:1}]};assert.equal(compareRecoverySnapshots(expected,structuredClone(expected)),true);
 for(const actual of[{...expected,schemaSha256:'c'.repeat(64)},{...expected,rows:[{...expected.rows[0],count:0}]},{...expected,sequences:[{...expected.sequences[0],value:7}]}])assert.throws(()=>compareRecoverySnapshots(expected,actual));
});
test('recovery normalizes only the known PostgreSQL 17 check grouping',()=>{
 const original='CHECK ((((char_length(name) >= 1) AND (char_length(name) <= 60)) AND (name = btrim(name))))';
 const restored='CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60) AND (name = btrim(name))))';
 const constraint={schema:'dm_private',table:'community_folders',name:'community_folders_name_check',definition:original};
 const schema={constraints:[constraint,{...constraint,name:'another_check'}]};
 assert.deepEqual(normalizeRecoverySchema(schema).constraints,[
   {...constraint,definition:restored},
   {...constraint,name:'another_check'},
 ]);
});
