// Operator-only encrypted recovery artifacts. Never import from the application.
import assert from 'node:assert/strict';
import {createHash,createCipheriv,createDecipheriv,hkdfSync,randomBytes,randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {constants,createReadStream,createWriteStream} from 'node:fs';
import {lstat,mkdir,open,readFile,readdir,realpath,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {stableJson} from './question-bank-import.mjs';
export const RECOVERY_VERSION='dmocks-recovery-v1',RECOVERY_PROJECT='tiodqzvvujxvxssvjdis';
const digest=value=>createHash('sha256').update(value).digest('hex'),hash=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const maxFileBytes=16*1024**3,maxManifestBytes=64*1024**2,maxEntries=100000;
function keyBytes(key){assert.ok(typeof key==='string'&&hash.test(key),'A private random 32-byte hexadecimal recovery key is required');return Buffer.from(key,'hex');}
function derive(key,header){return Buffer.from(hkdfSync('sha256',keyBytes(key),Buffer.from(header.salt,'hex'),Buffer.from(RECOVERY_VERSION+':'+header.id),32));}
function aad(header,slot){return Buffer.from(stableJson({version:RECOVERY_VERSION,id:header.id,slot}));}
async function regular(file){const info=await lstat(file);assert.ok(info.isFile()&&!info.isSymbolicLink(),'Recovery payload must be a regular file');return info;}
async function syncFile(file){const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{await fd.sync();}finally{await fd.close();}}
export async function privateRecoveryPath(output,{repositoryRoot}={}){
 const app=await realpath(fileURLToPath(new URL('..',import.meta.url))),absolute=path.resolve(output),parent=await realpath(path.dirname(absolute)),actual=path.join(parent,path.basename(absolute));
 const root=await realpath(repositoryRoot??execFileSync('git',['rev-parse','--show-toplevel'],{cwd:app,encoding:'utf8'}).trim());
 for(const base of[app,root])for(const name of['public','src','dist','.git'])for(const target of[absolute,actual])assert.ok(target!==path.join(base,name)&&!target.startsWith(path.join(base,name)+path.sep),'Recovery artifacts cannot enter public/source/build/Git directories');
 if(actual.startsWith(root+path.sep))assert.equal(spawnSync('git',['check-ignore','--quiet','--',actual],{cwd:root}).status,0,'Repository recovery artifacts must be untracked and ignored');
 return actual;
}
async function ownedDirectory(output,options){const target=await privateRecoveryPath(output,options);await mkdir(target,{mode:0o700});const info=await lstat(target);return{target,ino:info.ino};}
async function removeOwned(owned){const info=await lstat(owned.target).catch(()=>null);if(info&&info.ino===owned.ino&&!info.isSymbolicLink())await rm(owned.target,{recursive:true});}
function sourceValid(source){assert.ok(source?.projectRef===RECOVERY_PROJECT&&/^[a-f0-9]{40}$/.test(source.releaseSha??''),'Exact standalone project and full source release SHA required');}
function objectValid(object){
 assert.ok(object&&/^[a-z0-9][a-z0-9_-]{0,99}$/.test(object.bucket??'')&&typeof object.name==='string'&&object.name.length<=1024&&object.name.split('/').every(piece=>piece&&piece!=='.'&&piece!=='..')&&!object.name.includes('\\')&&!/[\u0000-\u001f]/.test(object.name),'Invalid private object identity');
 assert.ok(object.owner==null||typeof object.owner==='string'&&uuid.test(object.owner),'Invalid private object owner');
 assert.ok(typeof object.contentType==='string'&&object.contentType.length<=200&&!/[\u0000-\u001f]/.test(object.contentType)&&Number.isSafeInteger(object.byteSize)&&object.byteSize>=0&&object.byteSize<=maxFileBytes,'Invalid private object metadata');
 if(object.sha256!=null)assert.match(object.sha256,hash);
}
async function sealStream(stream,file,key,header,slot,{database=false,maxBytes=maxFileBytes}={}){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(header,slot));const plain=createHash('sha256'),sealed=createHash('sha256');let size=0,sealedSize=0,magic=Buffer.alloc(0);
 async function* encrypted(){yield Buffer.concat([Buffer.from('DMR1'),iv]);for await(const chunk of stream){const bytes=Buffer.from(chunk);size+=bytes.length;assert.ok(size<=maxBytes,'Recovery payload exceeds its supported limit');if(database&&magic.length<5)magic=Buffer.concat([magic,bytes.subarray(0,5-magic.length)]);plain.update(bytes);yield cipher.update(bytes);}if(database)assert.equal(magic.toString(),'PGDMP','A PostgreSQL custom-format archive is required');yield cipher.final();yield cipher.getAuthTag();}
 const count=new Transform({transform(chunk,encoding,callback){sealed.update(chunk);sealedSize+=chunk.length;callback(null,chunk);}});
 await pipeline(Readable.from(encrypted()),count,createWriteStream(file,{flags:'wx',mode:0o600}));await syncFile(file);
 return{slot,sha256:plain.digest('hex'),byteSize:size,sealedSha256:sealed.digest('hex'),sealedByteSize:sealedSize};
}
async function openStream(file,key,header,entry,{output,maxBytes=maxFileBytes,collect=false}={}){
 const info=await regular(file);assert.ok(info.size>=32&&info.size<=maxBytes+32,'Invalid encrypted recovery payload length');
 if(entry?.sealedByteSize!=null)assert.equal(info.size,entry.sealedByteSize,'Encrypted recovery payload length changed');
 const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);let iv,tag;
 try{const prefix=Buffer.alloc(16);await fd.read(prefix,0,16,0);assert.equal(prefix.subarray(0,4).toString(),'DMR1');iv=prefix.subarray(4);tag=Buffer.alloc(16);await fd.read(tag,0,16,info.size-16);}finally{await fd.close();}
 const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(aad(header,entry.slot));decipher.setAuthTag(tag);const plain=createHash('sha256'),sealed=createHash('sha256');let size=0,magic=Buffer.alloc(0);const chunks=[];
 // Verify the entire encrypted file digest as well as the authenticated content.
 for await(const chunk of createReadStream(file))sealed.update(chunk);
 if(entry.sealedSha256)assert.equal(sealed.digest('hex'),entry.sealedSha256,'Encrypted recovery payload digest changed');
 const sink=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>maxBytes)return callback(new Error('Recovery payload exceeds its supported limit'));plain.update(chunk);if(entry.kind==='database'&&magic.length<5)magic=Buffer.concat([magic,chunk.subarray(0,5-magic.length)]);if(collect)chunks.push(Buffer.from(chunk));callback(null,chunk);}});
 const destination=output?createWriteStream(output,{flags:'wx',mode:0o600}):new Transform({transform(chunk,encoding,callback){callback();}});
 if(info.size===32){await pipeline(Readable.from([]),decipher,sink,destination);}else await pipeline(createReadStream(file,{start:16,end:info.size-17}),decipher,sink,destination);
 const plainSha=plain.digest('hex');if(entry.sha256)assert.equal(plainSha,entry.sha256,'Recovered payload digest changed');if(entry.byteSize!=null)assert.equal(size,entry.byteSize,'Recovered payload length changed');
 if(entry.kind==='database')assert.equal(magic.toString(),'PGDMP','Recovered database archive is invalid');
 if(output)await syncFile(output);return{sha256:plainSha,byteSize:size,...(collect?{bytes:Buffer.concat(chunks)}:{})};
}
export async function createRecoveryBundle({output,key,source,snapshot,database,objects,readObject,assertUnchanged,repositoryRoot}){
 keyBytes(key);sourceValid(source);assert.ok(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)&&Array.isArray(objects)&&objects.length<maxEntries&&typeof readObject==='function'&&typeof assertUnchanged==='function','Complete snapshot, private object inventory and consistency check required');
 const seen=new Set();for(const object of objects){objectValid(object);const identity=stableJson([object.bucket,object.name]);assert.ok(!seen.has(identity),'Duplicate private object');seen.add(identity);}
 const owned=await ownedDirectory(output,{repositoryRoot}),header={version:RECOVERY_VERSION,id:randomUUID(),salt:randomBytes(16).toString('hex'),createdAt:new Date().toISOString(),projectRef:RECOVERY_PROJECT,entries:objects.length+1},derived=derive(key,header),entries=[];
 try{
  entries.push({...await sealStream(database,path.join(owned.target,'payload-000000.enc'),derived,header,'payload-000000.enc',{database:true}),kind:'database'});
  for(const object of objects){const slot='payload-'+String(entries.length).padStart(6,'0')+'.enc',entry=await sealStream(await readObject(object),path.join(owned.target,slot),derived,header,slot);assert.equal(entry.byteSize,object.byteSize,'Private object changed during capture');if(object.sha256)assert.equal(entry.sha256,object.sha256,'Private object digest disagrees with its source');entries.push({...entry,kind:'object',object});}
  assert.equal(await assertUnchanged(),true,'Private storage changed during capture; discard and retry from a new database snapshot');
  const manifest={version:RECOVERY_VERSION,id:header.id,createdAt:header.createdAt,source,snapshot,entries},bytes=Buffer.from(stableJson(manifest));assert.ok(bytes.length<=maxManifestBytes,'Recovery manifest exceeds its supported limit');
  await sealStream(Readable.from([bytes]),path.join(owned.target,'manifest.enc'),derived,header,'manifest.enc',{maxBytes:maxManifestBytes});
  // This is the only readiness marker. It is written after every payload and the
  // encrypted manifest have finished and synced. No path, user or key is public.
  await writeFile(path.join(owned.target,'recovery.json'),JSON.stringify(header)+'\n',{flag:'wx',mode:0o600});await syncFile(path.join(owned.target,'recovery.json'));await syncFile(owned.target);
  return{version:RECOVERY_VERSION,bundleId:header.id,databaseArchives:1,privateObjects:objects.length,plaintextBytes:entries.reduce((sum,row)=>sum+row.byteSize,0),manifestSha256:digest(bytes),providerWritesPerformed:false};
 }catch(error){await removeOwned(owned);throw error;}finally{derived.fill(0);}
}
export async function verifyRecoveryBundle({directory,key,extractTo,repositoryRoot}){
 keyBytes(key);const target=await privateRecoveryPath(directory,{repositoryRoot}),info=await lstat(target);assert.ok(info.isDirectory()&&!info.isSymbolicLink(),'Recovery bundle must be a private directory');
 const headerFile=path.join(target,'recovery.json');assert.ok((await regular(headerFile)).size<4096,'Invalid recovery header');const header=JSON.parse(await readFile(headerFile,'utf8'));
 assert.ok(header?.version===RECOVERY_VERSION&&uuid.test(header.id??'')&&/^[a-f0-9]{32}$/.test(header.salt??'')&&header.projectRef===RECOVERY_PROJECT&&Number.isInteger(header.entries)&&header.entries>=1&&header.entries<=maxEntries&&Number.isFinite(Date.parse(header.createdAt)),'Invalid recovery bundle header');
 const derived=derive(key,header);let owned;
 try{
  const opened=await openStream(path.join(target,'manifest.enc'),derived,header,{slot:'manifest.enc'},{maxBytes:maxManifestBytes,collect:true}),manifest=JSON.parse(opened.bytes.toString('utf8'));sourceValid(manifest.source);
  assert.ok(manifest.version===RECOVERY_VERSION&&manifest.id===header.id&&manifest.createdAt===header.createdAt&&Array.isArray(manifest.entries)&&manifest.entries.length===header.entries&&manifest.snapshot&&typeof manifest.snapshot==='object','Invalid authenticated recovery manifest');
  const slots=new Set(),identities=new Set();for(let index=0;index<manifest.entries.length;index++){
   const row=manifest.entries[index],slot='payload-'+String(index).padStart(6,'0')+'.enc';assert.ok(row.slot===slot&&hash.test(row.sha256??'')&&hash.test(row.sealedSha256??'')&&Number.isSafeInteger(row.byteSize)&&row.byteSize>=0&&row.byteSize<=maxFileBytes&&row.sealedByteSize===row.byteSize+32&&row.kind===(index===0?'database':'object'),'Invalid authenticated recovery entry');slots.add(slot);
   if(index){objectValid(row.object);assert.equal(row.object.byteSize,row.byteSize);const identity=stableJson([row.object.bucket,row.object.name]);assert.ok(!identities.has(identity),'Duplicate recovered object');identities.add(identity);}
  }
  assert.deepEqual((await readdir(target)).sort(),['recovery.json','manifest.enc',...slots].sort(),'Missing or unexpected recovery payload');
  if(extractTo)owned=await ownedDirectory(extractTo,{repositoryRoot});
  for(const row of manifest.entries)await openStream(path.join(target,row.slot),derived,header,row,{output:owned?path.join(owned.target,row.slot.replace('.enc','.bin')):undefined,...(!owned?{maxBytes:row.kind==='database'?maxFileBytes:row.byteSize}:{})});
  return{version:RECOVERY_VERSION,bundleId:header.id,source:manifest.source,snapshot:manifest.snapshot,entries:manifest.entries,privateObjects:manifest.entries.length-1,plaintextBytes:manifest.entries.reduce((sum,row)=>sum+row.byteSize,0),manifestSha256:opened.sha256,...(owned?{extractedDirectory:owned.target}:{})};
 }catch(error){if(owned)await removeOwned(owned);throw error;}finally{derived.fill(0);}
}
