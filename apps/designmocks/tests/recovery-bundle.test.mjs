import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,stat,readdir,symlink,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import test from 'node:test';
import {createRecoveryBundle,verifyRecoveryBundle,RECOVERY_PROJECT,RECOVERY_VERSION} from '../scripts/recovery-bundle.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const source={projectRef:RECOVERY_PROJECT,releaseSha:'a'.repeat(40)},snapshot={schemaSha256:'b'.repeat(64),rows:[{table:'original_fictional_attempt',count:1,digest:'c'.repeat(64)}]},database=Buffer.concat([Buffer.from('PGDMP'),randomBytes(4096)]),image=Buffer.from('Original fictional byte payload, never an actual question or account.');
async function fixture(run){const folder=await mkdtemp(path.join(os.tmpdir(),'dmocks-recovery-test-'));try{await run(folder);}finally{await rm(folder,{recursive:true,force:true});}}
async function capture(folder,overrides={}){
 const key=randomBytes(32).toString('hex'),output=path.join(folder,'backup'),objects=[{bucket:'paper-media',name:'papers/original-fictional.png',owner:null,contentType:'image/png',byteSize:image.length,sha256:sha(image),userMetadata:{fictional:true}}];
 const input={output,key,source,snapshot,database:Readable.from([database]),objects,readObject:async()=>Readable.from([image]),assertUnchanged:async()=>true,...overrides};
 return{key,input,summary:await createRecoveryBundle(input)};
}
test('encrypted bundles round-trip the exact database and private bytes with authenticated source metadata',()=>fixture(async folder=>{
 const {key,summary}=await capture(folder),extractTo=path.join(folder,'verified'),result=await verifyRecoveryBundle({directory:path.join(folder,'backup'),key,extractTo});
 assert.equal(summary.version,RECOVERY_VERSION);assert.equal(result.privateObjects,1);assert.equal(result.manifestSha256,summary.manifestSha256);assert.deepEqual(result.snapshot,snapshot);assert.deepEqual(result.source,source);
 assert.deepEqual(await readFile(path.join(extractTo,'payload-000000.bin')),database);assert.deepEqual(await readFile(path.join(extractTo,'payload-000001.bin')),image);
 assert.equal((await stat(path.join(folder,'backup'))).mode&0o777,0o700);for(const file of await readdir(path.join(folder,'backup')))assert.equal((await stat(path.join(folder,'backup',file))).mode&0o777,0o600);
 const publicHeader=await readFile(path.join(folder,'backup/recovery.json'),'utf8');assert.ok(!publicHeader.includes('original-fictional')&&!publicHeader.includes('schemaSha256'));
 for(const file of['payload-000000.enc','payload-000001.enc','manifest.enc'])assert.ok(!(await readFile(path.join(folder,'backup',file))).includes(image));
}));
test('verification streams payloads without returning their data and handles empty objects',()=>fixture(async folder=>{
 const {key}=await capture(folder,{objects:[{bucket:'paper-media',name:'original-empty',owner:null,contentType:'application/octet-stream',byteSize:0}],readObject:async()=>Readable.from([])});
 const result=await verifyRecoveryBundle({directory:path.join(folder,'backup'),key});assert.equal(result.entries[1].byteSize,0);assert.equal(result.extractedDirectory,undefined);assert.equal(result.entries[0].bytes,undefined);
}));
test('a wrong key and a changed authenticated manifest cannot produce extracted files',()=>fixture(async folder=>{
 const {key}=await capture(folder);await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key:randomBytes(32).toString('hex'),extractTo:path.join(folder,'wrong-key')}));assert.equal(await stat(path.join(folder,'wrong-key')).catch(()=>null),null);
 const file=path.join(folder,'backup/manifest.enc'),bytes=await readFile(file);bytes[25]^=1;await writeFile(file,bytes);await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key,extractTo:path.join(folder,'bad-manifest')}));assert.equal(await stat(path.join(folder,'bad-manifest')).catch(()=>null),null);
}));
test('truncated, bit-flipped and swapped encrypted payloads are rejected and extraction is removed',()=>fixture(async folder=>{
 const {key}=await capture(folder),file=path.join(folder,'backup/payload-000001.enc'),original=await readFile(file);
 for(const bytes of[original.subarray(0,-1),Buffer.concat([original.subarray(0,20),Buffer.from([original[20]^1]),original.subarray(21)]),await readFile(path.join(folder,'backup/payload-000000.enc'))]){
  await writeFile(file,bytes);await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key,extractTo:path.join(folder,'extracted')}));assert.equal(await stat(path.join(folder,'extracted')).catch(()=>null),null);
 }
}));
test('header tampering, unexpected files and missing encrypted files fail closed',()=>fixture(async folder=>{
 const {key}=await capture(folder),headerFile=path.join(folder,'backup/recovery.json'),header=JSON.parse(await readFile(headerFile));await writeFile(headerFile,JSON.stringify({...header,id:'11111111-1111-4111-8111-111111111111'}));await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key}));
 await writeFile(headerFile,JSON.stringify(header));await writeFile(path.join(folder,'backup/unexpected'),'original');await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key}),/unexpected recovery payload/);await rm(path.join(folder,'backup/unexpected'));await rm(path.join(folder,'backup/payload-000001.enc'));await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key}),/unexpected recovery payload/);
}));
test('changed source bytes or a changed inventory leave no ready or partial bundle',()=>fixture(async folder=>{
 for(const overrides of[{readObject:async()=>Readable.from([Buffer.from('changed')])},{assertUnchanged:async()=>false},{database:Readable.from([Buffer.from('plain SQL is not this archive format')])}]){
  await assert.rejects(capture(folder,overrides));assert.equal(await stat(path.join(folder,'backup')).catch(()=>null),null);
 }
}));
test('an oversized private object stops capture before consuming the rest of its stream', () => fixture(async folder => {
 let consumedRemainder = false;
 let closed = false;
 async function* oversized() {
  try {
   yield Buffer.alloc(image.length + 1);
   consumedRemainder = true;
   yield image;
  } finally {
   closed = true;
  }
 }
 await assert.rejects(capture(folder, {readObject: async () => oversized()}), /payload exceeds/);
 assert.equal(consumedRemainder, false);
 assert.equal(closed, true);
 assert.equal(await stat(path.join(folder, 'backup')).catch(() => null), null);
}));
test('capture rejects an ambiguous source, bad keys and duplicate or unsafe object identities',()=>fixture(async folder=>{
 for(const overrides of[{source:{...source,projectRef:'another-project'}},{source:{...source,releaseSha:'main'}},{key:'a password'},{objects:[{bucket:'paper-media',name:'../escape',contentType:'image/png',byteSize:0}]},{objects:[{bucket:'paper-media',name:'one',contentType:'image/png',byteSize:0},{bucket:'paper-media',name:'one',contentType:'image/png',byteSize:0}]}])await assert.rejects(capture(folder,overrides));assert.equal(await stat(path.join(folder,'backup')).catch(()=>null),null);
}));
test('neither capture nor extraction overwrites an existing directory',()=>fixture(async folder=>{
 const {key}=await capture(folder);await assert.rejects(capture(folder));await mkdir(path.join(folder,'extract'));await writeFile(path.join(folder,'extract/keep'),'original');await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key,extractTo:path.join(folder,'extract')}));assert.equal(await readFile(path.join(folder,'extract/keep'),'utf8'),'original');
}));
test('symlinked payloads and symlinked bundle directories are never trusted',()=>fixture(async folder=>{
 const {key}=await capture(folder),file=path.join(folder,'backup/payload-000001.enc');await writeFile(path.join(folder,'copy'),await readFile(file));await rm(file);await symlink(path.join(folder,'copy'),file);await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key}));await symlink(path.join(folder,'backup'),path.join(folder,'alias'));await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'alias'),key}));
}));
test('capture and extraction refuse app public/source/build and unignored repository paths',()=>fixture(async folder=>{
 const app=fileURLToPath(new URL('..',import.meta.url)),publicDirectory=path.join(app,'public');for(const name of['public','src','dist'])await assert.rejects(capture(folder,{output:path.join(app,name,'recovery-probe')}));await assert.rejects(capture(folder,{output:path.join(app,'recovery-probe')}));await symlink(publicDirectory,path.join(folder,'public-alias'));await assert.rejects(capture(folder,{output:path.join(folder,'public-alias/recovery-probe')}));
 const {key}=await capture(folder);await assert.rejects(verifyRecoveryBundle({directory:path.join(folder,'backup'),key,extractTo:path.join(publicDirectory,'recovery-probe')}));
}));
