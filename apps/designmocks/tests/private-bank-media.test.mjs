import test from 'node:test';import assert from 'node:assert/strict';
import{mkdtemp,mkdir,writeFile,symlink,rm}from'node:fs/promises';import os from'node:os';import path from'node:path';
import{sha256}from'../scripts/question-bank-import.mjs';
import{collectCanonicalMedia,verifyAssetBytes,readCanonicalAsset,planCanonicalMedia,uploadCanonicalMedia,retryMediaOperation}from'../scripts/private-bank-media.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4+vEFAAWtAs+P9YeZAAAAAElFTkSuQmCC','base64');
const asset=(changes={})=>({path:'fixture/page.png',sha256:sha256(png),width:1,height:1,...changes});
const manifest=(assets=[asset()],holds=[])=>({sourceCommit:'a'.repeat(40),sourceSha256:'b'.repeat(64),records:[{payload:{holds,assets}}]});
test('canonical media deduplicates by digest and uses content-addressed private paths',()=>{
 const result=collectCanonicalMedia(manifest([asset(),asset({path:'other/page.png'})]));assert.equal(result.length,1);assert.equal(result[0].storagePath,`papers/canonical/${sha256(png)}.png`);
 assert.throws(()=>collectCanonicalMedia(manifest([asset(),asset({width:2})])),/inconsistent dimensions/);
});
test('held records, traversal, external paths and oversized dimensions cannot enter the media plan',()=>{
 assert.throws(()=>collectCanonicalMedia(manifest([asset()],['review'])));
 for(const changes of [{path:'../secret.png'},{path:'/tmp/secret.png'},{path:'https://tracker.test/a.png'},{path:'fixture/../a.png'},{path:'fixture/a.svg'},{path:'fixture/%2e%2e/a.png'},{sha256:'invalid'},{width:0},{width:8192,height:8192}])assert.throws(()=>collectCanonicalMedia(manifest([asset(changes)])));
});
test('PNG validation rejects mismatched content, dimensions, type and incomplete files',()=>{
 const a=collectCanonicalMedia(manifest())[0];assert.deepEqual(verifyAssetBytes(a,png),png);
 assert.throws(()=>verifyAssetBytes({...a,sha256:'f'.repeat(64)},png));
 assert.throws(()=>verifyAssetBytes({...a,width:2},png));
 const wrongType=Buffer.from(png);wrongType[0]=0;assert.throws(()=>verifyAssetBytes({...a,sha256:sha256(wrongType)},wrongType));
 const truncated=png.subarray(0,-12);assert.throws(()=>verifyAssetBytes({...a,sha256:sha256(truncated)},truncated));
});
test('local verification rejects escaping symlinks and files changed after planning',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'dmocks-media-test-'));const root=path.join(directory,'assets');
 try{await mkdir(path.join(root,'fixture'),{recursive:true});await writeFile(path.join(root,'fixture/page.png'),png);await writeFile(path.join(directory,'outside.png'),png);
  const plan=await planCanonicalMedia(manifest(),root);assert.equal(plan.totalBytes,png.length);assert.equal(plan.assets.length,1);
  await symlink(path.join(directory,'outside.png'),path.join(root,'escape.png'));
  await assert.rejects(()=>readCanonicalAsset(root,{...plan.assets[0],relativePath:'escape.png'}),/symlink escapes/);
  await writeFile(path.join(root,'fixture/page.png'),Buffer.concat([png,Buffer.from('changed')]));await assert.rejects(()=>readCanonicalAsset(root,plan.assets[0]),/digest/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('upload rejects other projects and non-server credentials before contacting Storage',async()=>{
 const key=claims=>'a.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.c';
 const base={root:'/unused-fixture',url:'https://tiodqzvvujxvxssvjdis.supabase.co',serviceRoleKey:key({role:'service_role',ref:'tiodqzvvujxvxssvjdis'})};
 for(const changes of [{url:'https://another-project.supabase.co'},{serviceRoleKey:key({role:'anon',ref:'tiodqzvvujxvxssvjdis'})},{serviceRoleKey:key({role:'service_role',ref:'another-project'})},{concurrency:8}])await assert.rejects(()=>uploadCanonicalMedia({assets:[]},{...base,...changes}));
});
test('temporary provider failures retry within a bound while permission failures stop immediately',async()=>{
 let calls=0;const pauses=[];
 const success=await retryMediaOperation(async()=>++calls<3?{error:{statusCode:503}}:{data:'verified'},async n=>pauses.push(n));
 assert.equal(success.data,'verified');assert.equal(calls,3);assert.equal(pauses.length,2);
 calls=0;await retryMediaOperation(async()=>{calls++;return{error:{statusCode:403}};},async()=>{});assert.equal(calls,1);
 calls=0;await retryMediaOperation(async()=>{calls++;return{error:{statusCode:429}};},async()=>{});assert.equal(calls,4);
});
