import assert from'node:assert/strict';
import test from'node:test';
import{allIndiaExamSelection,catalogueInput,catalogueSpec,catalogueStartFailure,rankingShareReceipt,savedCatalogueAttempts,validateCatalogue,validatePublicAllIndiaResults}from'../src/catalogue-data.js';
const event='10000000-0000-4000-8000-000000001801',attempt='20000000-0000-4000-8000-000000001801';
const mock=()=>({exam:'uceed',questionCount:57,durationSeconds:7200,freeAttemptLimit:1,freeAttemptsUsed:0,enabled:true,ready:true,structureVersion:'iitb-2027-v1',sectionLabel:'Part A',sectionCounts:{nat:14,msq:15,mcq:28},privateExtra:'discard'});
const cohort=()=>({id:event,exam:'uceed',title:'Original fictional cohort',state:'open',startsAt:'2026-11-08T00:00:00Z',endsAt:'2026-11-18T00:00:00Z',lastStartAt:'2026-11-17T23:45:00Z',reviewEndsAt:'2026-11-28T00:00:00Z',durationSeconds:900,uploadGraceSeconds:0,qualityHeld:false,attemptId:null,result:null,privateExtra:'discard'});

test('the All India exam view filters verified events without changing their released result', () => {
 const uceed = { ...cohort(), state: 'released', attemptId: attempt, result: { rank: 14, cohortSize: 48, score: 27, total: 30 } };
 const nift = { ...cohort(), id: '10000000-0000-4000-8000-000000001802', exam: 'nift', state: 'review' };
 const rows = validateCatalogue('allIndia', [uceed, nift]);
 assert.deepEqual(allIndiaExamSelection(rows, 'uceed'), { selectedExam: 'uceed', visibleEvents: [rows[0]] });
 assert.deepEqual(allIndiaExamSelection(rows, 'nift'), { selectedExam: 'nift', visibleEvents: [rows[1]] });
 assert.deepEqual(allIndiaExamSelection(rows, 'nid'), { selectedExam: 'nid', visibleEvents: [] });
 for (const unknown of [null, '', 'unknown']) {
  assert.deepEqual(allIndiaExamSelection(rows, unknown), { selectedExam: '', visibleEvents: rows });
 }
});
test('exam choices preserve exact verified sections, free usage and the nullable empty API contract',()=>{assert.deepEqual(validateCatalogue('exam',null),[]);const value=validateCatalogue('exam',[mock()]);assert.deepEqual(value[0].sectionCounts,{nat:14,msq:15,mcq:28});assert.equal(value[0].privateExtra,undefined);assert.deepEqual(catalogueInput('exam',value,'uceed'),{p_exam:'uceed'});assert.throws(()=>catalogueSpec('toString'));});
test('malformed, duplicated and contradictory exam readiness cannot enable a start',()=>{for(const mutate of[row=>{row.ready=true;row.enabled=false;},row=>{row.sectionCounts.mcq=27;},row=>{row.questionCount=0;},row=>{row.freeAttemptsUsed=NaN;},row=>{delete row.enabled;}]){const row=mock();mutate(row);assert.throws(()=>validateCatalogue('exam',[row]));}assert.throws(()=>validateCatalogue('exam',[mock(),mock()]));const rows=validateCatalogue('exam',[{...mock(),ready:false}]);assert.throws(()=>catalogueInput('exam',rows,'uceed'));});
test('topic choices retain exact exam, Unicode topic and allowed counts and clocks',()=>{const topic='Space / form & रंग',rows=validateCatalogue('topic',[{exam:'uceed',topic,questions:30,privateExtra:true}]);assert.deepEqual(catalogueInput('topic',rows,{exam:'uceed',topic,count:30,duration:2700}),{p_exam:'uceed',p_topic:topic,p_count:30,p_duration_seconds:2700});assert.equal(rows[0].privateExtra,undefined);for(const input of[{exam:'ceed',topic,count:10,duration:900},{exam:'uceed',topic:topic.toLowerCase(),count:10,duration:900},{exam:'uceed',topic,count:40,duration:900},{exam:'uceed',topic,count:10,duration:1000}])assert.throws(()=>catalogueInput('topic',rows,input));assert.throws(()=>validateCatalogue('topic',[...rows,...rows]));});
test('All India choices preserve one owned attempt and expose only released coherent ranks',()=>{const open=validateCatalogue('allIndia',[cohort()]);assert.deepEqual(catalogueInput('allIndia',open,event),{p_event_id:event});const value={...cohort(),state:'released',attemptId:attempt,result:{rank:2,cohortSize:12,score:-1,total:4,privateExtra:'discard'}};const released=validateCatalogue('allIndia',[value]);assert.deepEqual(released[0].result,{rank:2,cohortSize:12,score:-1,total:4});assert.throws(()=>catalogueInput('allIndia',released,event));const existing=validateCatalogue('allIndia',[{...cohort(),attemptId:attempt}]);assert.throws(()=>catalogueInput('allIndia',existing,event));});
test('held ranks, unknown event states, unsafe links and invalid dates are rejected',()=>{for(const change of[row=>{row.result={rank:1,cohortSize:1,score:4,total:4};},row=>{row.state='other';},row=>{row.attemptId='../admin';},row=>{row.lastStartAt='invalid';},row=>{row.qualityHeld=true;},row=>{row.state='released';row.attemptId=attempt;row.result={rank:2,cohortSize:1,score:4,total:4};}]){const row=cohort();change(row);assert.throws(()=>validateCatalogue('allIndia',[row]));}assert.throws(()=>validateCatalogue('allIndia',[cohort(),cohort()]));});

const sharingChoice = {
 publicationId: '30000000-0000-4000-8000-000000001801', revision: 0, shared: false, alias: 'Candidate-A1B2C3',
};

test('released personal ranking exposes only an eligible and validated sharing choice', () => {
 const released = { ...cohort(), state: 'released', attemptId: attempt };
 const result = { rank: 4, cohortSize: 12, score: 7, total: 10 };
 const sharing = { ...sharingChoice, privateExtra: 'discard' };
 assert.deepEqual(validateCatalogue('allIndia', [{ ...released, result: { ...result, sharing } }])[0].result,
  { ...result, sharing: sharingChoice });
 assert.deepEqual(validateCatalogue('allIndia', [{ ...released, result: { ...result, sharing: null } }])[0].result, result);
 assert.throws(() => validateCatalogue('allIndia', [{ ...released, result: { ...result, rank: 11, sharing } }]));
 assert.throws(() => validateCatalogue('allIndia', [{ ...released, result: { ...result, sharing: { ...sharing, shared: true } } }]));
});

test('a ranking acknowledgement verifies the exact publication, alias, next revision and requested choice', () => {
 const reply = { ...sharingChoice, revision: 1, shared: true };
 assert.deepEqual(rankingShareReceipt(reply, sharingChoice, true), reply);
 for (const change of [{ publicationId: event }, { alias: 'Candidate-A1B2C4' }, { revision: 3 }, { shared: false }]) {
  assert.throws(() => rankingShareReceipt({ ...reply, ...change }, sharingChoice, true));
 }
 assert.throws(() => rankingShareReceipt({ ...reply, alias: 'Fictional display name' }, sharingChoice, true));
});

test('the public feed accepts the consent-aware response and projects only aliases and marks', () => {
 const row = { alias: sharingChoice.alias, rank: 4, score: -1, total: 10 };
 const legacy = { eventId: event, exam: 'uceed', title: 'Original fictional event',
  releasedAt: '2026-11-28T00:00:00Z', topTen: [{ ...row, privateExtra: 'discard' }] };
 const current = { ...legacy, sharingVersion: 1, privateExtra: 'discard' };
 assert.deepEqual(validatePublicAllIndiaResults([legacy]), []);
 assert.deepEqual(validatePublicAllIndiaResults([{ ...current, topTen: [] }]), []);
 assert.deepEqual(validatePublicAllIndiaResults([current]),
  [{ eventId: event, exam: 'uceed', title: legacy.title, topTen: [row] }]);
 assert.throws(() => validatePublicAllIndiaResults([{ ...current, topTen: [{ ...row, rank: 11 }] }]));
 assert.throws(() => validatePublicAllIndiaResults([{ ...current, topTen: [{ ...row, alias: 'Fictional display name' }] }]));
});
test('saved-start recovery projects at most ten current active links without private answer or score fields',()=>{const rows=Array.from({length:12},(_,index)=>({id:`20000000-0000-4000-8000-${String(1801+index).padStart(12,'0')}`,title:'Original fictional attempt '+index,status:'active',score:42,answers:['private-extra']}));const result=savedCatalogueAttempts(rows);assert.equal(result.length,10);assert.deepEqual(Object.keys(result[0]),['id','title']);assert.deepEqual(savedCatalogueAttempts([{...rows[0],status:'submitted'}]),[]);assert.throws(()=>savedCatalogueAttempts([rows[0],rows[0]]));assert.throws(()=>savedCatalogueAttempts([{...rows[0],id:'../admin'}]));});
test('only known PostgreSQL transaction rejections remain immediately retryable and diagnostics stay private',()=>{for(const message of['An active pass is required','Complete your verified profile first','Finish an active attempt before starting another','Not enough reviewed questions for this practice','This All India mock can only be attempted once','There is no full attempt window available'])assert.deepEqual(catalogueStartFailure({code:'P0001',message}),{definitive:true,message});for(const error of[null,new TypeError('private-provider-url'),{code:'P0001',message:'private-provider-url'},{code:'40001',message:'An active pass is required'}]){const value=catalogueStartFailure(error);assert.equal(value.definitive,false);assert.equal(value.message.includes('private-provider-url'),false);}assert.equal(catalogueStartFailure({code:'catalogue_selection'}).definitive,true);});
