// Server/operator-only canonical media import. Never import this module into src/.
import assert from 'node:assert/strict';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {loadFromGit,sha256,stableJson} from './question-bank-import.mjs';
import {bankProviderConfiguration,openPrivateBankProvider} from './private-bank-provider.mjs';

export const MEDIA_BUCKET='paper-media';
export const MAX_ASSET_BYTES=10*1024*1024;
export async function retryMediaOperation(operation,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 let result;
 for(let attempt=0;attempt<4;attempt++){
  try{result=await operation();}catch{result={error:{statusCode:0}};}
  const status=Number(result.error?.statusCode||result.status||0);
  if(!result.error||![0,429,502,503,504].includes(status)||attempt===3)return result;
  await wait([300,1000,2500][attempt]);
 }
 return result;
}
function providerFailure(code,result,asset){
 const error=new Error(code);error.code=code;
 if(asset)error.assetSha256=asset.sha256;
 error.httpStatus=Number(result?.error?.statusCode||result?.status||0);
 const providerCode=result?.error?.code;
 if(typeof providerCode==='string'&&/^[A-Z0-9]{5,12}$/.test(providerCode))error.providerCode=providerCode;
 return error;
}
export function collectCanonicalMedia(manifest){
 const assets=new Map();
 for(const record of manifest.records){
  assert.deepEqual(record.payload.holds,[], 'Media must come from explicit empty-holds records');
  for(const a of record.payload.assets||[]){
   assert.ok(typeof a.path==='string' && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.png$/.test(a.path) && !a.path.includes('..') && path.posix.normalize(a.path)===a.path,'Unsafe canonical asset path');
   assert.match(a.sha256,/^[a-f0-9]{64}$/,'Invalid canonical asset digest');
   assert.ok(Number.isInteger(a.width)&&Number.isInteger(a.height)&&a.width>0&&a.height>0&&a.width<=8192&&a.height<=8192&&a.width*a.height<=16*1024*1024,'Unsupported canonical image dimensions');
   const asset={sha256:a.sha256,relativePath:a.path,width:a.width,height:a.height,storagePath:`papers/canonical/${a.sha256}.png`};
   const previous=assets.get(a.sha256);
   if(previous) assert.ok(previous.width===a.width&&previous.height===a.height,'Digest has inconsistent dimensions');
   else assets.set(a.sha256,asset);
  }
 }
 return [...assets.values()].sort((a,b)=>a.sha256.localeCompare(b.sha256));
}
export function verifyAssetBytes(asset,bytes){
 assert.ok(bytes.length>=45&&bytes.length<=MAX_ASSET_BYTES,'Unsupported image byte size');
 assert.equal(sha256(bytes),asset.sha256,'Image does not match canonical digest');
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Canonical media must be PNG');
 assert.equal(bytes.readUInt32BE(8),13,'Invalid PNG header');
 assert.equal(bytes.subarray(12,16).toString(),'IHDR','Invalid PNG header');
 assert.equal(bytes.readUInt32BE(16),asset.width,'PNG width mismatch');
 assert.equal(bytes.readUInt32BE(20),asset.height,'PNG height mismatch');
 assert.equal(bytes.subarray(-12).toString('hex'),'0000000049454e44ae426082','Incomplete PNG');
 return bytes;
}
export async function readCanonicalAsset(root,asset){
 const canonicalRoot=await realpath(root);
 const candidate=path.resolve(canonicalRoot,asset.relativePath);
 assert.ok(candidate.startsWith(canonicalRoot+path.sep),'Asset escapes the selected media root');
 const actual=await realpath(candidate);
 assert.ok(actual.startsWith(canonicalRoot+path.sep),'Asset symlink escapes the selected media root');
 const info=await stat(actual);
 assert.ok(info.isFile()&&info.size<=MAX_ASSET_BYTES,'Unsupported image file');
 return verifyAssetBytes(asset,await readFile(actual));
}
export async function planCanonicalMedia(manifest,root){
 const assets=collectCanonicalMedia(manifest);let bytes=0;
 for(const asset of assets){const data=await readCanonicalAsset(root,asset);asset.byteSize=data.length;bytes+=data.length;}
 return {sourceCommit:manifest.sourceCommit,sourceSha256:manifest.sourceSha256,mediaSha256:sha256(stableJson(assets)),totalBytes:bytes,assets};
}
export async function uploadCanonicalMedia(plan,{root,concurrency=3,onProgress=()=>{},...config}){
 assert.ok(Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=4,'Unsupported upload concurrency');
 const provider=await openPrivateBankProvider(config);
 const client=createClient(provider.origin,config.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:provider.fetch}});
 const lookup=await retryMediaOperation(()=>client.storage.getBucket(MEDIA_BUCKET));
 if(lookup.error||!lookup.data)throw providerFailure('PRIVATE_MEDIA_BUCKET_LOOKUP_FAILED',lookup);
 const bucket=lookup.data;
 assert.equal(bucket.public,false,'Canonical media bucket must already be private');
 assert.ok(bucket.allowed_mime_types?.includes('image/png')&&bucket.file_size_limit>=MAX_ASSET_BYTES,'Unexpected private bucket constraints');
 let uploaded=0,reused=0,registered=0;
 for(let offset=0;offset<plan.assets.length;offset+=concurrency){
  const batch=plan.assets.slice(offset,offset+concurrency);
  const records=await Promise.all(batch.map(async asset=>{
   const bytes=await readCanonicalAsset(root,asset);
   const result=await retryMediaOperation(()=>client.storage.from(MEDIA_BUCKET).upload(asset.storagePath,bytes,{contentType:'image/png',upsert:false,cacheControl:'3600',metadata:{sha256:asset.sha256}}));
   // Existing objects are accepted only after authenticated download and digest verification.
   const downloadedResult=await retryMediaOperation(()=>client.storage.from(MEDIA_BUCKET).download(asset.storagePath));
   const {data:stored,error}=downloadedResult;
   if(error||!stored){const failure=providerFailure('PRIVATE_MEDIA_DOWNLOAD_FAILED',downloadedResult,asset);failure.uploadHttpStatus=Number(result.error?.statusCode||result.status||0);throw failure;}
   const downloaded=verifyAssetBytes(asset,Buffer.from(await stored.arrayBuffer()));
   assert.equal(downloaded.length,asset.byteSize,'Stored image byte size changed');
   if(result.error) reused++;else uploaded++;
   return {sha256:asset.sha256,storagePath:asset.storagePath,width:asset.width,height:asset.height,byteSize:asset.byteSize};
  }));
  const registration=await retryMediaOperation(()=>client.rpc('register_bank_media_assets',{p_records:records}));
  if(registration.error||registration.data!==records.length)throw providerFailure('PRIVATE_MEDIA_REGISTRATION_FAILED',registration,batch.length===1?batch[0]:undefined);
  registered+=records.length;onProgress({registered,total:plan.assets.length,uploaded,reused});
 }
 return {registered,uploaded,reused,totalBytes:plan.totalBytes,mediaSha256:plan.mediaSha256};
}
async function main(){
 const index=process.argv.indexOf('--ref');const manifest=loadFromGit(index>=0?process.argv[index+1]:'origin/main');
 const root=process.env.DMOCKS_MEDIA_ROOT;assert.ok(root,'Set DMOCKS_MEDIA_ROOT to the read-only canonical media directory');
 const plan=await planCanonicalMedia(manifest,root);
 const summary={sourceCommit:plan.sourceCommit,sourceSha256:plan.sourceSha256,mediaSha256:plan.mediaSha256,assets:plan.assets.length,totalBytes:plan.totalBytes};
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'dry-run',...summary},null,2));return;}
 const result=await uploadCanonicalMedia(plan,{...bankProviderConfiguration(process.env),root,onProgress:p=>{if(p.registered%150===0||p.registered===p.total)console.log(JSON.stringify(p));}});
 console.log(JSON.stringify({mode:'private-media-upload',...summary,...result},null,2));
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{
 const known=['PRIVATE_MEDIA_BUCKET_LOOKUP_FAILED','PRIVATE_MEDIA_DOWNLOAD_FAILED','PRIVATE_MEDIA_REGISTRATION_FAILED'].includes(error.code);
 console.error(JSON.stringify({code:known?error.code:'CANONICAL_MEDIA_IMPORT_FAILED',...(known?{assetSha256:error.assetSha256,httpStatus:error.httpStatus,uploadHttpStatus:error.uploadHttpStatus,providerCode:error.providerCode}:{})}));process.exitCode=1;
});
