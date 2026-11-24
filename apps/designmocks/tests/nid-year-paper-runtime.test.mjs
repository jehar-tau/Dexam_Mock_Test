import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,stableJson} from '../scripts/question-bank-import.mjs';
import {compileNidYearPaperRuntime} from '../scripts/nid-year-paper-runtime.mjs';
import {materializeNidYearPaper} from '../scripts/materialize-nid-year-paper.mjs';
import {runtimeQuestion,RULES_2027} from '../scripts/question-runtime.mjs';

const question={externalKey:'nid-bdes-2019-q1',type:'MCQ',prompt:'Choose the matching shape.',
 options:['A','B','C','D'].map(key=>({key,text:key,asset:null})),assets:[],visualDependency:false,
 holds:[],answer:{raw:'B or C',status:'independently-solved'},topic:'visual-reasoning',
 provenance:{exam:'nid',paperId:'nid-bdes-2019',year:2019}};
const contentSha256=sha256(stableJson(question));
const canonical={records:[{externalKey:question.externalKey,type:'MCQ',exam:'nid',contentSha256,payload:question}]};
const plan={format:'dmocks-free-year-paper-v1',exam:'nid',year:2019,sourcePaperId:'nid-bdes-2019',
 partLabel:'Part I',title:'NID B.Des 2019 Part I',durationSeconds:3600,
 markingReference:'Historical rules printed in the NID 2019 booklet',
 questions:[{externalKey:question.externalKey,contentSha256,marking:{correct:2,wrong:0},
  explanation:'Both labelled options are accepted by this historical answer key.'}]};

test('NID historical plan supplies the exact clock, marks and alternative key without a 2027 rule',()=>{
 assert.equal(runtimeQuestion(question,{rule:RULES_2027.nid}),null);
 const compiled=compileNidYearPaperRuntime(plan,canonical,[]);
 assert.equal(compiled.questionCount,1);
 assert.deepEqual(compiled.records[0].runtime.key,{kind:'mcq',correct:['B','C'],sourceExternalKey:question.externalKey});
 assert.deepEqual(compiled.records[0].runtime.marking,{correct:2,wrong:0});
 assert.equal(compiled.records[0].runtime.context.durationSeconds,3600);
 assert.equal(compiled.records[0].runtime.context.scope,'historical-year-paper');
 assert.equal(compiled.records[0].runtime.explanation,plan.questions[0].explanation);
});

test('NID year runtime rejects altered source, unresolved holds and descriptive items',()=>{
 assert.throws(()=>compileNidYearPaperRuntime({...plan,questions:[{...plan.questions[0],contentSha256:'a'.repeat(64)}]},canonical,[]),/hold-free source group/);
 const held={...question,holds:['review']};
 assert.throws(()=>compileNidYearPaperRuntime(plan,{records:[{...canonical.records[0],payload:held}]},[]),/hold-free source group/);
 const drawing={...question,type:'DESCRIPTIVE'};
 assert.throws(()=>compileNidYearPaperRuntime(plan,{records:[{...canonical.records[0],type:'DESCRIPTIVE',payload:drawing}]},[]),/hold-free source group/);
});

test('NID historical runtime uses only the stored key and does not invent partial marks',()=>{
 const result=compileNidYearPaperRuntime({...plan,questions:[{...plan.questions[0],marking:{correct:1.5,wrong:-0.25}}]},canonical,[]);
 assert.deepEqual(result.records[0].runtime.marking,{correct:1.5,wrong:-0.25});
 assert.equal(Object.hasOwn(result.records[0].runtime.marking,'partial'),false);
 assert.deepEqual(result.records[0].runtime.key.correct,['B','C']);
});

test('NID operator checks the exact plan digest before any runtime write',async()=>{
 const calls=[];
 const provider={rpc:async(name,args)=>{calls.push(name);return name==='canonical_bank_media_manifest'?[]:args.p_records.length}};
 await assert.rejects(()=>materializeNidYearPaper(plan,canonical,provider,{apply:true,expect:'a'.repeat(64)}),/changed after its review/);
 assert.deepEqual(calls,['canonical_bank_media_manifest']);
 const expect=compileNidYearPaperRuntime(plan,canonical,[]).planSha256;
 const result=await materializeNidYearPaper(plan,canonical,provider,{apply:true,expect});
 assert.equal(result.recorded,1);
 assert.deepEqual(calls,['canonical_bank_media_manifest','canonical_bank_media_manifest','upsert_nid_year_runtime_batch']);
});
