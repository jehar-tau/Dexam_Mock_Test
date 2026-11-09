import test from'node:test';import assert from'node:assert/strict';
import{runtimeQuestion,RULES_2027}from'../scripts/question-runtime.mjs';
import{buildManifest}from'../scripts/question-bank-import.mjs';
import{compileRuntimeManifest,runtimeOperator}from'../scripts/materialize-bank-runtime.mjs';
const sha='a'.repeat(64);
const figure={sha256:sha,path:'fixture/page.png',width:100,height:70};
const stored={sha256:sha,path:`papers/canonical/${sha}.png`,width:100,height:70,byteSize:100};
const fixture=(changes={})=>({externalKey:'original-fixture',type:'MCQ',prompt:'Choose the matching original shape.',holds:[],provenance:{exam:'uceed'},options:['A','B','C','D'].map(key=>({key,text:key,asset:null})),assets:[],visualDependency:false,answer:{raw:'A',status:'verified'},...changes});
const convert=q=>runtimeQuestion(q,{rule:RULES_2027[q.provenance.exam],mediaCatalog:[stored]});
test('conversion requires explicit verified rules rather than assigning default marks',()=>{
 assert.equal(runtimeQuestion(fixture()),null);
 assert.equal(runtimeQuestion(fixture(),{rule:{...RULES_2027.uceed,sections:{MCQ:{correct:1,wrong:0}}}}),null);
 assert.deepEqual(convert(fixture({provenance:{exam:'nift'},options:['1','2','3','4'].map(key=>({key,text:key,asset:null})),answer:{raw:'1',status:'verified'}})).marking,{correct:1,wrong:-0.25});
 assert.deepEqual(convert(fixture()).marking,{correct:3,wrong:-0.71});
 assert.deepEqual(convert(fixture({provenance:{exam:'ceed'}})).marking,{correct:3,wrong:-0.5});
 assert.deepEqual(convert(fixture({type:'MSQ',answer:{raw:'AC',status:'verified'}})).marking,{correct:4,wrong:-1,partial:true});
});
test('canonical image conversion needs a matching verified private path, digest and dimensions',()=>{
 const q=fixture({assets:[figure],visualDependency:true});
 assert.equal(convert(q).media[0].path,stored.path);
 for(const bad of [[],[{...stored,path:'https://tracker.invalid/x'}],[{...stored,width:99}],[{...stored,byteSize:0}]])assert.equal(runtimeQuestion(q,{rule:RULES_2027.uceed,mediaCatalog:bad}),null);
 assert.equal(convert(fixture({visualDependency:true})),null);
 assert.equal(convert({...q,holds:['review']}),null);
});
test('full question crops may supply option labels; unresolved text-only options cannot',()=>{
 const q=fixture({options:['A','B','C','D'].map(key=>({key,text:'',asset:null}))});
 assert.equal(convert(q),null);
 assert.deepEqual(convert({...q,assets:[figure],visualDependency:true}).options.map(o=>o.label),['A','B','C','D']);
 assert.equal(convert({...q,assets:[figure],options:q.options.map(o=>({...o,asset:'unmapped.png'}))}),null);
});
test('choice parsing rejects extra text, duplicates and unknown options instead of silently discarding them',()=>{
 for(const raw of ['A,Z','A,A','A or B','Answer A','A!'])assert.equal(convert(fixture({type:'MSQ',answer:{raw,status:'verified'}})),null);
 for(const raw of ['AC','A,C','A C','A;C'])assert.deepEqual(convert(fixture({type:'MSQ',answer:{raw,status:'verified'}})).key.correct,['A','C']);
 assert.equal(convert(fixture({options:[{key:'A',text:'A'},{key:'B',text:'B'}]})),null);
});
test('numeric keys preserve exact decimal text and explicit ranges without invented tolerances',()=>{
 const nat=raw=>convert(fixture({type:'NAT',options:[],answer:{raw,status:'verified'}}));
 assert.deepEqual(nat('1.234567890123456789').key.accepted,[{exact:'1.234567890123456789'}]);
 assert.deepEqual(nat('-2 to -1').key.accepted,[{range:['-2','-1']}]);
 assert.deepEqual(nat('1.95–2.05').key.accepted,[{range:['1.95','2.05']}]);
 for(const raw of ['1.000000000000000002 to 1.000000000000000001','2 to 1','1/2','1,2','2 units','Infinity',''])assert.equal(nat(raw),null);
});
test('numeric keys preserve each exact source literal in explicit or alternatives',()=>{
 const nat=raw=>convert(fixture({type:'NAT',options:[],answer:{raw,status:'verified'}}));
 assert.deepEqual(nat('1.000000000000000001 or 1.000000000000000002').key.accepted,[{exact:'1.000000000000000001'},{exact:'1.000000000000000002'}]);
 assert.deepEqual(nat('-2 OR +3 or .5').key.accepted,[{exact:'-2'},{exact:'+3'},{exact:'.5'}]);
 assert.deepEqual(nat('  2\n or\t3  ').marking,{correct:4,wrong:0});
});
test('numeric alternatives never reinterpret commas, fractions, ranges, annotations or incomplete alternatives',()=>{
 const nat=raw=>convert(fixture({type:'NAT',options:[],answer:{raw,status:'verified'}}));
 for(const raw of['1,2','1,000','1/2','1 to 2 or 3','1 or 2 units','either 1 or 2','1or2','1 or','or 1','1 or 1','1 or 2 or unknown','1 or Infinity'])assert.equal(nat(raw),null,raw);
 assert.equal(nat('1 or '+('2'.repeat(201))),null);
});
test('verified Part B tasks compile only as human-reviewed drawing runtime',()=>{
 const drawing=convert(fixture({type:'DESCRIPTIVE',options:[],answer:null,assets:[figure],visualDependency:true,topic:'drawing-product'}));
 assert.equal(drawing.kind,'drawing');assert.deepEqual(drawing.marking,{correct:50,wrong:0,humanReview:true});assert.equal(drawing.context.part,'B');assert.equal(drawing.context.durationSeconds,3600);assert.deepEqual(drawing.key,{kind:'drawing',sourceExternalKey:'original-fixture'});
 const ceed=convert(fixture({type:'DESCRIPTIVE',options:[],answer:null,assets:[figure],visualDependency:true,provenance:{exam:'ceed'}}));assert.equal(ceed.points,20);assert.equal(ceed.context.durationSeconds,7200);
 assert.equal(convert(fixture({type:'DESCRIPTIVE',options:[],answer:null,assets:[],visualDependency:false})),null);
 assert.equal(drawing.explanation.includes('Answer key'),false);
 assert.equal(convert(fixture({type:'DESCRIPTIVE',options:[],answer:null,assets:[figure],visualDependency:true,provenance:{exam:'nift'}})),null);
});
test('canonical ingestion does not silently compile or downgrade independently reviewed runtime plans',()=>{
 const manifest=buildManifest({schemaVersion:1,questions:[fixture()]});
 assert.equal(manifest.records[0].runtime,null);assert.equal(manifest.runtimeReadyTotal,0);
 const plan=compileRuntimeManifest(manifest,[stored]);assert.equal(plan.ready,1);assert.equal(plan.byExam.uceed.ready,1);
 assert.equal(compileRuntimeManifest(manifest,[stored]).planSha256,plan.planSha256);
 assert.throws(()=>compileRuntimeManifest(manifest,[stored,stored]),/Duplicate/);
});
test('runtime operator refuses foreign projects and browser credentials before network access',async()=>{
 const key=claims=>'a.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.c';
 const ref='a'.repeat(20),url='https://'+ref+'.supabase.co',config={url,allowOrigin:url,environment:'staging'};
 await assert.rejects(()=>runtimeOperator({...config,serviceRoleKey:key({role:'service_role',ref:'b'.repeat(20)})}),/different provider project/);
 await assert.rejects(()=>runtimeOperator({...config,serviceRoleKey:key({role:'anon',ref})}),/server-only/);
});
