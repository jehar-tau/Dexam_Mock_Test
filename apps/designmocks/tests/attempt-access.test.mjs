import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttemptAccessScope,createAttemptServices} from '../src/attempt-access.js';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
function fixture(options={}){
 const state={actor:'first',token:'first-token',error:null,history:'first',calls:[],notices:[],...options};
 const auth={getSession:async()=>({data:{session:{user:{id:state.actor},access_token:state.token}}}),getUser:async token=>{
  if(state.held)await state.held.promise;
  return{data:{user:{id:token==='first-token'?'first':'second'}},error:state.error};
 }};
 const scope=createAttemptAccessScope({auth,actorId:'first',isCurrent:()=>state.history==='first',onChange:value=>state.notices.push(value),verificationTimeoutMs:15});
 const client={rpc(name,args){const call={name,args};return{setHeader(key,value){call[key]=value;return this;},abortSignal(signal){state.calls.push(call);return state.response??Promise.resolve({data:{accepted:true},error:null,status:200});}};},functions:{async invoke(name,options){state.calls.push({name,...options});return{data:{saved:true},error:null};}}};
 return{state,scope,services:createAttemptServices(scope,client)};
}
test('initial identity outage dispatches nothing and can recover only after fresh verification',async()=>{
 const{state,scope,services}=fixture({error:Object.assign(new Error('private diagnostic'),{status:503})});
 assert.equal(await scope.verify(),false);assert.deepEqual(scope.snapshot(),{status:'unavailable',hadAccess:false});
 await assert.rejects(()=>services.rpc('read_attempt',{}));assert.deepEqual(state.calls,[]);
 state.error=null;assert.equal(await scope.verify(),true);await services.rpc('read_attempt',{});assert.equal(state.calls.length,1);scope.dispose();
});
test('a trusted Auth outage retains its scope while blocking unchecked dispatch; verified identity loss closes it',async()=>{
 const{state,scope,services}=fixture();assert.equal(await scope.verify(),true);
 state.error=Object.assign(new Error('private diagnostic'),{status:503});await assert.rejects(()=>services.rpc('save_answer_revision',{}));
 assert.equal(scope.isCurrent(),true);assert.deepEqual(scope.snapshot(),{status:'waiting',hadAccess:true});assert.deepEqual(state.calls,[]);
 state.error=null;await services.rpc('save_answer_revision',{});assert.equal(scope.snapshot().status,'allowed');
 state.error=Object.assign(new Error('expired'),{status:401});await assert.rejects(()=>services.rpc('save_answer_revision',{}));assert.equal(scope.isCurrent(),false);assert.equal(scope.snapshot().status,'denied');
 state.error=null;assert.equal(await scope.verify(),false);assert.equal(state.calls.length,1);
});
test('an unannounced cached actor change prevents RPC dispatch',async()=>{
 const{state,scope,services}=fixture();await scope.verify();state.actor='second';state.token='second-token';
 await assert.rejects(()=>services.rpc('report_attempt_question',{details:'fictional first actor draft'}));assert.deepEqual(state.calls,[]);assert.equal(scope.snapshot().status,'denied');
});
test('a verified request pins its captured bearer instead of a later SDK token',async()=>{
 const{state,scope,services}=fixture();await scope.verify();const held=deferred();state.held=held;
 const pending=services.rpc('save_answer_revision',{});await new Promise(resolve=>setImmediate(resolve));state.actor='second';state.token='second-token';held.resolve();
 await pending;assert.equal(state.calls[0].Authorization,'Bearer first-token');assert.equal(await scope.verify(),false);assert.equal(scope.isCurrent(),false);
});
test('cancelled verification and a late provider result cannot dispatch a request',async()=>{
 const{state,scope,services}=fixture();await scope.verify();const held=deferred(),cancel=new AbortController();state.held=held;
 const pending=services.rpc('read_attempt',{},cancel.signal);await new Promise(resolve=>setImmediate(resolve));cancel.abort();await assert.rejects(()=>pending);
 held.resolve();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(state.calls,[]);assert.equal(scope.isCurrent(),true);scope.dispose();
});
test('a bounded initial check never reopens from a late successful provider response',async()=>{
 const{state,scope}=fixture();const held=deferred();state.held=held;assert.equal(await scope.verify(),false);
 assert.equal(scope.snapshot().status,'unavailable');held.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(scope.snapshot().status,'unavailable');assert.deepEqual(state.calls,[]);scope.dispose();
});
test('a request ending across history cannot return a stale acknowledgement',async()=>{
 const{state,scope,services}=fixture();await scope.verify();const held=deferred();state.response=held.promise;const pending=services.rpc('save_answer_revision',{});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(state.calls.length,1);state.history='second';held.resolve({data:{accepted:true},error:null,status:200});await assert.rejects(()=>pending);scope.dispose();
});
test('attempt multipart transport preserves the FormData body and replaces every Authorization spelling',async()=>{
 const{state,scope,services}=fixture();await scope.verify();const body=new FormData();body.set('file',new Blob(['fictional']), 'fictional.png');
 const result=await services.functions.invoke('drawing-media',{body,headers:{authorization:'Bearer unverified','X-Correlation':'fictional'}});
 assert.equal(result.error,null);assert.equal(state.calls[0].body,body);assert.equal(state.calls[0].headers.Authorization,'Bearer first-token');assert.equal(state.calls[0].headers.authorization,undefined);assert.equal(state.calls[0].headers['X-Correlation'],'fictional');scope.dispose();
});
test('an earlier successful identity check cannot hide a newer verified-network outage',async()=>{
 const held=deferred();let count=0;
 const auth={getSession:async()=>({data:{session:{user:{id:'first'},access_token:'first-token'}}}),getUser:async()=>{
  count++;if(count===2)return held.promise;
  return count===3?{data:{user:null},error:Object.assign(new Error('offline'),{status:503})}:{data:{user:{id:'first'}},error:null};
 }};
 const scope=createAttemptAccessScope({auth,actorId:'first'});assert.equal(await scope.verify(),true);
 const earlier=scope.verify();await new Promise(resolve=>setImmediate(resolve));assert.equal(await scope.verify(),false);assert.equal(scope.snapshot().status,'waiting');
 held.resolve({data:{user:{id:'first'}},error:null});await earlier;assert.equal(scope.snapshot().status,'waiting');assert.equal(scope.isCurrent(),true);scope.dispose();
});
