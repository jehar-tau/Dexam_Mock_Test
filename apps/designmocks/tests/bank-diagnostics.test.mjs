import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectRuntimeQuestion,RULES_2027,runtimeQuestion} from '../scripts/question-runtime.mjs';
import {buildManifest,sha256,stableJson} from '../scripts/question-bank-import.mjs';
import {compileConversionReport,writePrivateReport} from '../scripts/bank-conversion-report.mjs';

const fixture=(changes={})=>({externalKey:'original-diagnostic-fixture',type:'MCQ',prompt:'Private original question wording.',holds:[],provenance:{exam:'uceed'},options:['A','B','C','D'].map(key=>({key,text:'Private option '+key})),assets:[],answer:{raw:'A',status:'verified'},...changes});
const inspect=q=>inspectRuntimeQuestion(q,{rule:RULES_2027[q.provenance.exam]});

test('conversion diagnostics distinguish unverified context from incomplete source without guessing a key',()=>{
 const q=fixture({provenance:{exam:'nid'},options:[{key:'A',text:'One option'}],answer:{raw:'',status:'pending'}}),before=structuredClone(q);
 const result=inspect(q);assert.equal(result.runtime,null);assert.deepEqual(new Set(result.issues.map(i=>i.code)),new Set(['context-unverified','answer-pending','answer-missing','choice-options-missing']));assert.deepEqual(q,before);
});
test('source, media and answer notation issues are independently actionable',()=>{
 const sha='a'.repeat(64),q=fixture({type:'MSQ',assets:[{sha256:sha,width:4,height:4}],options:['A','A','C','D'].map(key=>({key,text:key})),answer:{raw:'A or Z',status:'verified'}});
 assert.deepEqual(new Set(inspect(q).issues.map(i=>i.code)),new Set(['media-unverified','option-labels']));
 const fixed={...q,options:fixture().options};assert.deepEqual(new Set(inspect(fixed).issues.map(i=>i.code)),new Set(['media-unverified','answer-notation']));
 assert.deepEqual(inspect(fixture({visualDependency:true})).issues.map(i=>i.code),['visual-assets-missing']);
});
test('exact decimals, verified NIFT contexts and human-reviewed drawings retain the runtime contract',()=>{
 const nat=fixture({type:'NAT',options:[],answer:{raw:'1.234567890123456789',status:'verified'}}),nift=fixture({provenance:{exam:'nift'}});
 for(const q of[nat,nift]){const result=inspect(q);assert.deepEqual(result.issues,[]);assert.deepEqual(result.runtime,runtimeQuestion(q,{rule:RULES_2027[q.provenance.exam]}));}
 assert.deepEqual(inspect(nat).runtime.key.accepted,[{exact:'1.234567890123456789'}]);assert.deepEqual(inspect(nift).runtime.marking,{correct:1,wrong:-0.25});
 const drawing=fixture({type:'DESCRIPTIVE',options:[],answer:null,provenance:{exam:'nift'}});assert.deepEqual(inspect(drawing).issues.map(i=>i.code),['section-unmodelled']);
});
test('unverified NID contexts never inherit another exam four-choice or drawing-figure requirement',()=>{
 const objective=fixture({provenance:{exam:'nid'},options:fixture().options.slice(0,3)}),drawing=fixture({provenance:{exam:'nid'},type:'DESCRIPTIVE',options:[],answer:null});
 for(const q of[objective,drawing])assert.deepEqual(inspect(q).issues.map(i=>i.code),['context-unverified']);
 assert.deepEqual(new Set(inspect({...objective,answer:{raw:'Z',status:'verified'}}).issues.map(i=>i.code)),new Set(['context-unverified','answer-notation']));
 assert.deepEqual(new Set(inspect({...drawing,visualDependency:true}).issues.map(i=>i.code)),new Set(['context-unverified','visual-assets-missing']));
 assert.ok(inspect(fixture({options:fixture().options.slice(0,3)})).issues.some(i=>i.code==='option-count'));
 assert.ok(inspect(fixture({type:'DESCRIPTIVE',answer:null,options:[]})).issues.some(i=>i.code==='drawing-figure-missing'));
});
test('conversion reports separate MVP scope, other supported material and correction work without private content',()=>{
 const manifest=buildManifest({schemaVersion:1,questions:[fixture(),fixture({externalKey:'nift-fixture',provenance:{exam:'nift'}}),fixture({externalKey:'nid-fixture',provenance:{exam:'nid'},answer:null})]},'a'.repeat(40));
 const report=compileConversionReport(manifest,[]);assert.deepEqual(report.counts,{mvpObjective:1,otherSupported:1,blocked:1});assert.equal(report.correctionQueue.length,1);assert.equal(report.correctionQueue[0].externalKey,'nid-fixture');assert.equal(report.correctionQueue[0].contentSha256,manifest.records[2].contentSha256);assert.equal(report.hostedReadinessVerified,false);assert.equal(report.publicationOrApprovalChanges,false);
 const output=JSON.stringify(report);for(const text of['Private original question wording.','Private option A','Answer key: A','"correct"','"runtime"'])assert.equal(output.includes(text),false);
 assert.equal(compileConversionReport(manifest,[]).reportSha256,report.reportSha256);assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
});
test('reports refuse modified source hashes, held records and duplicate media before producing a correction queue',()=>{
 const manifest=buildManifest({schemaVersion:1,questions:[fixture()]},'a'.repeat(40));
 for(const mutate of[m=>m.records[0].payload.prompt='Changed without importing',m=>m.records[0].contentSha256='0'.repeat(64),m=>{m.records[0].payload.holds=['review'];m.records[0].contentSha256=sha256(stableJson(m.records[0].payload));}]){const changed=structuredClone(manifest);mutate(changed);assert.throws(()=>compileConversionReport(changed,[]));}
 assert.throws(()=>compileConversionReport(manifest,[{sha256:'a'.repeat(64)},{sha256:'a'.repeat(64)}]),/Duplicate/);
});

test('private report writes reject public paths, symlink escapes, tracked files and replacement of an existing report',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'dmocks-diagnostic-output-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});await writeFile(path.join(root,'.gitignore'),'.private/\n');await mkdir(path.join(root,'.private'));
  const report={original:'Fictional metadata only'},output=path.join(root,'.private','report.json');
  await writePrivateReport(output,report,{repositoryRoot:root});assert.deepEqual(JSON.parse(await readFile(output,'utf8')),report);assert.equal((await stat(output)).mode&0o077,0);
  await assert.rejects(()=>writePrivateReport(output,{changed:true},{repositoryRoot:root}));assert.deepEqual(JSON.parse(await readFile(output,'utf8')),report);
  await assert.rejects(()=>writePrivateReport(path.join(root,'unignored.json'),report,{repositoryRoot:root}),/untracked and ignored/);
  execFileSync('git',['add','--force','.private/report.json'],{cwd:root});await rm(output);
  await assert.rejects(()=>writePrivateReport(output,report,{repositoryRoot:root}),/untracked and ignored/);
  const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));await symlink(publicRoot,path.join(root,'escaped-public'));
  await assert.rejects(()=>writePrivateReport(path.join(root,'escaped-public','diagnostic-leak.json'),report,{repositoryRoot:root}),/public\/application/);
  await assert.rejects(()=>writePrivateReport(path.join(root,'.git','diagnostic-leak.json'),report,{repositoryRoot:root}),/Git internals/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('the correction queue distinguishes source scoring decisions, references and numeric annotations', () => {
 const cases = [
  ['MCQ', 'DROPPED (+3 marks awarded to all)', 'answer-scoring-disposition'],
  ['MSQ', 'FULL MARKS (bonus)', 'answer-scoring-disposition'],
  ['MCQ', 'Q 17', 'answer-reference'],
  ['NAT', '2.2 (2.3~2.4)', 'answer-annotated-numeric'],
  ['NAT', '2.2 (metres)', 'answer-notation'],
 ];
 const questions = cases.map(([type, raw], index) => fixture({
  externalKey: 'correction-fixture-' + index, type, answer: { raw, status: 'verified' },
 }));
 const report = compileConversionReport(buildManifest({ schemaVersion: 1, questions }, 'a'.repeat(40)), []);
 assert.equal(report.counts.blocked, cases.length);
 for (const [index, [, raw, code]] of cases.entries()) {
  const record = report.correctionQueue.find(row => row.externalKey === 'correction-fixture-' + index);
  assert.deepEqual(record.issues.map(issue => issue.code), [code]);
  assert.equal(inspect(questions[index]).runtime, null);
  assert.equal(JSON.stringify(report).includes(raw), false);
 }
});
