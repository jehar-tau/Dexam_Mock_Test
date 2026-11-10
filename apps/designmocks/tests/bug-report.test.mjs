import test from 'node:test';
import assert from 'node:assert/strict';
import {appendBugReports,bugReportContext,bugReportFailure,prepareBugReport,validateBugReportPage,validateBugReportReceipt}from'../src/bug-report.js';

const owner='00000000-0000-4000-8000-000000001101',requestId='00000000-0000-4000-8000-000000001102';
const row=(n=1)=>({id:'91000000-0000-4000-8000-'+String(n).padStart(12,'0'),title:'Original fictional report '+n,description:'An original fictional support description.',status:'open',adminReply:null,createdAt:'2026-01-01T12:00:00.123456Z',updatedAt:'2026-01-01T12:00:00.123456Z'});
const cursor=item=>({ownerId:owner,snapshotAt:'2026-01-02T12:00:00.123456Z',createdAt:item.createdAt,id:item.id});

test('report context excludes query, fragment and embedded credentials without collecting other pages',()=>{
 assert.equal(bugReportContext('https://person:fictional@dmocks.com/report?token=private#private'),'https://dmocks.com/report');
 assert.equal(bugReportContext('http://127.0.0.1:4192/report?email=private'),'http://127.0.0.1:4192/report');
 for(const value of['javascript:fictional','file:///private/fictional','not a URL',null])assert.equal(bugReportContext(value),null);
});
test('invalid input never allocates a submission key and preserves the server character boundaries',()=>{
 let keys=0;const create=()=>{keys++;return requestId;};
 for(const value of[{title:'four',description:'A complete original description.'},{title:'Valid title',description:'too short'},{title:'x'.repeat(141),description:'A complete original description.'},{title:'Valid title',description:'x'.repeat(5001)},{title:null,description:null}]){
  const result=prepareBugReport(value,'https://dmocks.com/report',create);assert.equal(result.request,null);assert.ok(Object.keys(result.errors).length);
 }
 assert.equal(keys,0);assert.ok(prepareBugReport({title:'🔶'.repeat(140),description:'x'.repeat(5000)},'https://dmocks.com/report',create).request);assert.equal(keys,1);
});
test('a retry retains the exact normalized immutable request while the original draft changes',()=>{
 const draft={title:'  An original title  ',description:'  A complete original reproduction description.  '};
 const{request,errors}=prepareBugReport(draft,'https://dmocks.com/report?private=1',()=>requestId);
 assert.deepEqual(errors,{});draft.title='A different later draft';draft.description='A different later description.';
 assert.equal(request.p_title,'An original title');assert.equal(request.p_description,'A complete original reproduction description.');assert.equal(request.p_page_url,'https://dmocks.com/report');assert.equal(request.p_request_id,requestId);
 assert.throws(()=>{request.p_title='An accidental retry mutation';},TypeError);
});
test('only a complete UUID acknowledgement confirms the saved report',()=>{
 assert.equal(validateBugReportReceipt(requestId),requestId);
 for(const value of[null,true,{},[],{id:requestId},'saved',requestId+'extra'])assert.throws(()=>validateBugReportReceipt(value));
});
test('known rejected submissions remain editable while uncertain acknowledgements preserve retry identity',()=>{
 assert.equal(bugReportFailure({details:'bug_report_limit'}).definitive,true);
 assert.equal(bugReportFailure({details:'bug_report_conflict'}).definitive,true);
 assert.equal(bugReportFailure({code:'22023'}).definitive,true);assert.equal(bugReportFailure({code:'PGRST202'}).definitive,true);
 for(const error of[{status:503,message:'Private provider diagnostic'},{name:'AbortError'},{code:'P0001',message:'Private provider diagnostic'},new Error('Private provider diagnostic')]){
  const result=bugReportFailure(error);assert.equal(result.definitive,false);assert.doesNotMatch(result.message,/Private provider/);
 }
});
test('bounded pages retain raw microseconds and exact owner-bound cursor identity',()=>{
 const first=row(),input={items:[first],nextCursor:cursor(first)};const result=validateBugReportPage(input,owner);
 assert.equal(result.nextCursor.createdAt,'2026-01-01T12:00:00.123456Z');assert.deepEqual(result,input);
 result.items[0].title='A changed local view';result.nextCursor.id=row(2).id;assert.equal(input.items[0].title,first.title);assert.equal(input.nextCursor.id,first.id);
});
test('malformed, overfull, duplicate or mixed-owner report pages never reach the history',()=>{
 const first=row(),valid={items:[first],nextCursor:cursor(first)};
 for(const change of[null,{items:[]},{items:Array.from({length:26},(_,n)=>row(n+1)),nextCursor:null},{items:[first,first],nextCursor:null},
  {items:[{...first,status:'unknown'}],nextCursor:null},{items:[{...first,adminReply:{private:true}}],nextCursor:null},{items:[{...first,description:'x'.repeat(5001)}],nextCursor:null},
  {items:[{...first,createdAt:'2026-02-31T12:00:00.123456Z'}],nextCursor:null},
  {...valid,nextCursor:{...valid.nextCursor,ownerId:requestId}},{...valid,nextCursor:{...valid.nextCursor,id:row(2).id}},
  {...valid,nextCursor:{...valid.nextCursor,createdAt:'2026-01-01T12:00:00.123457Z'}},{...valid,nextCursor:{...valid.nextCursor,extra:true}},
  {items:[],nextCursor:valid.nextCursor}])assert.throws(()=>validateBugReportPage(change,owner));
});
test('continuations preserve existing reports and reject overlap without mutating the current view',()=>{
 const current=[row(1)],next=[row(2)];assert.deepEqual(appendBugReports(current,next),[...current,...next]);assert.equal(current.length,1);
 assert.throws(()=>appendBugReports(current,[row(1)]));assert.equal(current.length,1);
});

test('a linked order is frozen in the request while a general report keeps its original signature',()=>{
 const draft={title:'A purchase question',description:'A complete original description.'};
 const source='https://dmocks.com/report', create=()=>requestId, purchaseOrder=row(2).id;
 const general=prepareBugReport(draft,source,create).request;
 const linked=prepareBugReport({...draft,purchaseOrder},source,create).request;
 assert.deepEqual(linked,{...general,p_purchase_order_id:purchaseOrder});
 assert.ok(Object.isFrozen(linked));assert.equal(Object.hasOwn(general,'p_purchase_order_id'),false);
 assert.throws(()=>prepareBugReport({...draft,purchaseOrder:'missing'},source,create),/Invalid linked order/);
 assert.deepEqual(bugReportFailure({code:'22023',details:'purchase_order_unavailable'}),{
  definitive:true,message:'This order is unavailable for your account. Remove the order link to send a general report.',
 });
});

test('owned support history projects only the linked order reference and mode',()=>{
 const report=row(), purchase={reference:row(2).id,mode:'test'};
 const item={...report,purchase:{...purchase,amountMinor:119300,providerPaymentId:'private-id'},reporterId:owner};
 assert.deepEqual(validateBugReportPage({items:[item],nextCursor:null},owner).items,[{...report,purchase}]);
 assert.throws(()=>validateBugReportPage({items:[{...report,purchase:{...purchase,mode:'unknown'}}],nextCursor:null},owner),/Invalid linked purchase/);
});
