import assert from'node:assert/strict';
import test from'node:test';
import{createAccountServices}from'../src/account-services.js';
import{createAdminAccessScope}from'../src/admin-access.js';
import{withAccountDeadline}from'../src/account-request.js';
async function fixture(targetDenials=false){
 const state={token:'first-token',owner:'first',rpc:[],edge:[],failure:null,checks:0};
 const scope=createAdminAccessScope({check:async()=>{state.checks++;return state.owner==='first';}});await scope.verify();
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'first'},access_token:state.token}}}),getUser:async token=>({data:{user:{id:token==='first-token'?'first':'second'}}})},rpc(name,args){const item={name,args};state.rpc.push(item);const builder={setHeader(key,value){item[key]=value;return builder;},async abortSignal(signal){item.signal=signal;return{data:42,error:state.failure,status:state.failure?403:200};}};return builder;},functions:{async invoke(name,options){state.edge.push({name,...options});return{data:state.failure?null:'accepted',error:state.failure};}}};
 return{state,scope,services:createAccountServices(scope,client,'first',{targetDenials})};
}
test('account RPCs pin the verified actor and pass the caller cancellation signal',async()=>{
 const{state,scope,services}=await fixture(),controller=new AbortController();assert.equal(await services.rpc('fictional_rpc',{value:1},controller.signal),42);assert.equal(state.rpc[0].Authorization,'Bearer first-token');assert.equal(state.rpc[0].signal.aborted,false);assert.equal(services.isCurrent(),true);scope.dispose();
});
test('account Edge requests replace every Auth casing and retain multipart/options without mutating input',async()=>{
 const{state,scope,services}=await fixture(true),headers={authorization:'wrong',AUTHORIZATION:'also wrong','Content-Type':'image/png','x-fixture':'retained'},body=new FormData();body.set('target','fictional');const result=await services.functions.invoke('community-media',{body,method:'POST',headers});assert.equal(result.data,'accepted');assert.deepEqual(state.edge[0].headers,{'Content-Type':'image/png','x-fixture':'retained',Authorization:'Bearer first-token'});assert.equal(state.edge[0].body,body);assert.equal(state.edge[0].method,'POST');assert.equal(headers.authorization,'wrong');assert.equal(scope.isCurrent(),true);scope.dispose();
});
test('target-specific RPC and Edge denial rechecks identity and preserves the permitted scope',async()=>{
 const{state,scope,services}=await fixture(true);state.failure={code:'42501',message:'Fictional target unavailable'};await assert.rejects(services.rpc('fictional_rpc',{}),/target unavailable/);assert.equal(scope.isCurrent(),true);const error=Object.assign(new Error('Fictional private image target denied'),{context:new Response('{}',{status:403})});state.failure=error;assert.equal((await services.functions.invoke('community-media')).error,error);assert.equal(scope.isCurrent(),true);assert.equal(state.checks,3);scope.dispose();
});
test('a protected non-target read keeps its existing whole-scope denial policy',async()=>{
 const{state,scope,services}=await fixture();state.failure={code:'42501',message:'Fictional private capability denied'};await assert.rejects(services.rpc('fictional_rpc',{}));assert.equal(scope.isCurrent(),false);assert.equal(scope.snapshot().status,'unavailable');scope.dispose();
});
test('changed token identity blocks RPC and Edge dispatch without sending earlier account work',async()=>{
 for(const edge of[false,true]){const{state,scope,services}=await fixture(true);state.token='second-token';if(edge)assert.ok((await services.functions.invoke('community-media')).error);else await assert.rejects(services.rpc('fictional_rpc',{}));assert.deepEqual(state.rpc,[]);assert.deepEqual(state.edge,[]);assert.equal(scope.isCurrent(),false);scope.dispose();}
});
test('identity can be rechecked before navigation without dispatching another RPC or Edge request',async()=>{
 const{state,scope,services}=await fixture(true);assert.equal(await services.checkIdentity(new AbortController().signal),true);assert.deepEqual(state.rpc,[]);assert.deepEqual(state.edge,[]);state.token='second-token';await assert.rejects(services.checkIdentity(new AbortController().signal));assert.equal(scope.isCurrent(),false);scope.dispose();
});
test('a bounded account request ends a stalled operation and ignores its later result',async()=>{
 let finish;const late=new Promise(resolve=>{finish=resolve;}),controller=new AbortController();await assert.rejects(withAccountDeadline(()=>late,controller.signal,1),error=>error.name==='AbortError');finish('late private result');await Promise.resolve();
});
test('a bounded account request never starts after cancellation and preserves active results',async()=>{
 const controller=new AbortController();controller.abort();let started=false;await assert.rejects(withAccountDeadline(()=>{started=true;},controller.signal,10));assert.equal(started,false);assert.equal(await withAccountDeadline(()=>42,new AbortController().signal,100),42);
});
