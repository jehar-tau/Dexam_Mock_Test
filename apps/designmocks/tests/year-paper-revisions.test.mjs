import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildManifest,sha256,stableJson} from '../scripts/question-bank-import.mjs';
import {buildYearPaperRevision} from '../scripts/year-paper-revision.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5QAAAABJRU5ErkJggg==','base64');
async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'fictional-year-revision-'));
  t.after(()=>rm(root,{force:true,recursive:true}));
  await mkdir(path.join(root,'ceed-2021/figures'),{recursive:true});
  await writeFile(path.join(root,'ceed-2021/figures/one.png'),png);
  const q={externalKey:'fictional-one',type:'NAT',prompt:'Fictional count?',topic:'counting',licence:'owned',holds:[],options:[],
    assets:[{path:'ceed-2021/figures/one.png',sha256:sha256(png),width:1,height:1}],answer:{status:'reviewed',raw:'2'},
    provenance:{exam:'ceed',year:2021,paperId:'ceed-2021'}};
  const unrelated={...q,externalKey:'unrelated',assets:[{...q.assets[0],path:'nift-2025/blocks/absent.png'}],
    provenance:{exam:'nift',year:2025,paperId:'nift-2025'}};
  const canonical=buildManifest({schemaVersion:1,questions:[q,unrelated]},'c'.repeat(40));
  const plan={format:'dmocks-free-year-paper-v1',exam:'ceed',year:2021,sourcePaperId:'ceed-2021',title:'Fictional fixed paper',partLabel:'Part A',durationSeconds:1500,
    markingReference:'Fictional printed rules',questions:[{externalKey:q.externalKey,contentSha256:canonical.records[0].contentSha256,marking:{correct:2,wrong:0},explanation:'Fictional worked explanation for this item.'}]};
  const base={paperId:null,manifest:null,items:[{externalKey:q.externalKey,contentSha256:'a'.repeat(64),id:null,ordinal:null}]};
  return {plan,expected:sha256(stableJson(plan)),canonical,base,mediaRoot:root};
}
test('first staging is deterministic and resolves just the exact plan’s figures',async t=>{
  const args=await fixture(t);
  const first=await buildYearPaperRevision(args);
  assert.deepEqual(await buildYearPaperRevision(args),first);
  assert.deepEqual(first.plan,args.plan);assert.equal(first.items.length,1);
  assert.equal(first.items[0].runtime.key.accepted[0].exact,'2');
  assert.deepEqual(first.media,[{sha256:sha256(png),storagePath:'papers/canonical/'+sha256(png)+'.png',width:1,height:1,byteSize:png.length}]);
});
test('refresh preserves existing identities and rejects wrong ordinal, source group, plan digest, or bytes',async t=>{
  const args=await fixture(t);const id='00000000-0000-4000-8000-000000000001';
  args.base={paperId:id,manifest:'f'.repeat(64),items:[{...args.base.items[0],id,ordinal:1}]};
  const version=await buildYearPaperRevision(args);
  assert.equal(version.paperId,id);assert.equal(version.items[0].id,id);assert.equal(version.baseManifest,args.base.manifest);
  await assert.rejects(buildYearPaperRevision({...args,expected:'0'.repeat(64)}),/digest changed/);
  await assert.rejects(buildYearPaperRevision({...args,base:{...args.base,items:[]}}),/source group changed/);
  await assert.rejects(buildYearPaperRevision({...args,base:{...args.base,items:[{...args.base.items[0],ordinal:2}]}}),/identity changed/);
  await writeFile(path.join(args.mediaRoot,'ceed-2021/figures/one.png'),Buffer.alloc(png.length));
  await assert.rejects(buildYearPaperRevision(args),/digest/);
});
