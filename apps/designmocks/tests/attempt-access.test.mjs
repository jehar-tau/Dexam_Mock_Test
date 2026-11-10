import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttemptAccessScope,createAttemptServices} from '../src/attempt-access.js';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
function fixture(options={}){
 const state={actor:'first',token:'first-token',error:null,history:'first',calls:[],notices:[],sessions:[],verifiedTokens:[],...options};
 const auth={getSession:async()=>{
  state.sessions.push({actor:state.actor,token:state.token});
  return{data:{session:{user:{id:state.actor},access_token:state.token}}};
 },getUser:async token=>{
  state.verifiedTokens.push(token);
  if(state.held)await state.held.promise;
  return{data:{user:{id:token==='second-token'?'second':'first'}},error:state.error};
 }};
 const scope=createAttemptAccessScope({auth,actorId:'first',isCurrent:()=>state.history==='first',onChange:value=>state.notices.push(value),verificationTimeoutMs:15});
 const client={rpc(name,args){const call={name,args};return{setHeader(key,value){call[key]=value;return this;},abortSignal(signal){state.calls.push(call);return state.response??Promise.resolve({data:{accepted:true},error:null,status:200});}};},functions:{async invoke(name,options){state.calls.push({name,...options});return state.functionResponse??{data:{saved:true},error:null};}}};
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
test('a verified request dispatches with its captured bearer and discards success after the actor changes',async t=>{
 const{state,scope,services}=fixture();t.after(()=>scope.dispose());await scope.verify();const held=deferred();state.held=held;
 const pending=services.rpc('save_answer_revision',{});await new Promise(resolve=>setImmediate(resolve));state.actor='second';state.token='second-token';held.resolve();
 await assert.rejects(pending,{code:'attempt_access_ended'});
 assert.equal(state.calls.length,1);assert.equal(state.calls[0].Authorization,'Bearer first-token');
 assert.equal(scope.isCurrent(),false);assert.deepEqual(scope.snapshot(),{status:'denied',hadAccess:true});
});
test('a successful RPC response is withheld after an unannounced account change in flight', async t => {
 const reply = deferred();
 const { state, scope, services } = fixture({ response: reply.promise });
 t.after(() => scope.dispose());
 assert.equal(await scope.verify(), true);
 const request = services.rpc('read_attempt', {});
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(state.calls.length, 1);
 assert.equal(state.calls[0].Authorization, 'Bearer first-token');
 state.actor = 'second';
 state.token = 'second-token';
 reply.resolve({ data: { paper: 'fictional first actor paper' }, error: null, status: 200 });

 await assert.rejects(request, { code: 'attempt_access_ended' });
 assert.deepEqual(scope.snapshot(), { status: 'denied', hadAccess: true });
 assert.equal(scope.isCurrent(), false);
 assert.equal(scope.signal.aborted, true);
});

test('a late Auth reply for the original account cannot release a completed private Edge response', async t => {
 const reply = deferred();
 const held = deferred();
 const { state, scope, services } = fixture({ functionResponse: reply.promise });
 t.after(() => scope.dispose());
 assert.equal(await scope.verify(), true);
 const request = services.functions.invoke('attempt-media', { body: { attemptId: 'fictional-paper' } });
 let settled = false;
 void request.then(() => { settled = true; });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(state.calls.length, 1);
 assert.equal(state.calls[0].headers.Authorization, 'Bearer first-token');
 state.held = held;
 reply.resolve({ data: { media: 'fictional first actor figure' }, error: null });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(state.verifiedTokens.length, 3);
 assert.equal(state.verifiedTokens.at(-1), 'first-token');

 state.actor = 'second';
 state.token = 'second-token';
 assert.equal(settled, false);
 held.resolve();
 const result = await request;
 assert.equal(result.data, null);
 assert.equal(result.error?.code, 'attempt_access_ended');
 assert.deepEqual(state.sessions.at(-1), { actor: 'second', token: 'second-token' });
 assert.deepEqual(scope.snapshot(), { status: 'denied', hadAccess: true });
 assert.equal(scope.isCurrent(), false);
 assert.equal(scope.signal.aborted, true);
});

test('same-actor token rotation during final Auth verification withholds success and allows a verified retry', async t => {
 const reply = deferred();
 const held = deferred();
 const { state, scope, services } = fixture({ functionResponse: reply.promise });
 t.after(() => scope.dispose());
 assert.equal(await scope.verify(), true);
 const request = services.functions.invoke('drawing-media', { body: { action: 'open' } });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(state.calls.length, 1);
 assert.equal(state.calls[0].headers.Authorization, 'Bearer first-token');
 state.held = held;
 const pages = { images: [{ url: 'https://example.invalid/fictional-drawing-page' }] };
 reply.resolve({ data: pages, error: null });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(state.verifiedTokens.length, 3);
 assert.equal(state.verifiedTokens.at(-1), 'first-token');

 state.token = 'first-rotated-token';
 held.resolve();
 const result = await request;
 assert.equal(result.data, null);
 assert.equal(result.error?.code, 'attempt_identity_unavailable');
 assert.deepEqual(state.sessions.at(-1), { actor: 'first', token: 'first-rotated-token' });
 assert.deepEqual(scope.snapshot(), { status: 'waiting', hadAccess: true });
 assert.equal(scope.isCurrent(), true);
 assert.equal(scope.signal.aborted, false);

 state.held = null;
 assert.deepEqual(await services.functions.invoke('drawing-media', { body: { action: 'open' } }), { data: pages, error: null });
 assert.equal(state.calls[1].headers.Authorization, 'Bearer first-rotated-token');
 assert.equal(state.verifiedTokens.at(-1), 'first-rotated-token');
 assert.deepEqual(scope.snapshot(), { status: 'allowed', hadAccess: true });
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

test('a successful private figure reply is discarded after an unannounced account change', async () => {
 const reply = deferred();
 const { state, scope, services } = fixture({ functionResponse: reply.promise });
 assert.equal(await scope.verify(), true);
 const request = services.functions.invoke('attempt-media', { body: { attemptId: 'fictional-paper' } });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(state.calls.length, 1);
 assert.equal(state.calls[0].headers.Authorization, 'Bearer first-token');
 state.actor = 'second';
 state.token = 'second-token';
 reply.resolve({ data: { media: { figure: [{ url: 'https://example.invalid/old-account-figure' }] } }, error: null });
 const result = await request;
 assert.equal(result.data, null);
 assert.equal(result.error?.code, 'attempt_access_ended');
 assert.deepEqual(scope.snapshot(), { status: 'denied', hadAccess: true });
});

test('unavailable identity after a drawing response preserves the active attempt and withholds the reply', async () => {
 const reply = deferred();
 const { state, scope, services } = fixture({ functionResponse: reply.promise });
 assert.equal(await scope.verify(), true);
 const request = services.functions.invoke('drawing-media', { body: { action: 'open' } });
 await new Promise(resolve => setImmediate(resolve));
 state.error = Object.assign(new Error('fictional offline provider'), { status: 503 });
 const pages = { images: [{ url: 'https://example.invalid/drawing-page' }] };
 reply.resolve({ data: pages, error: null });
 const result = await request;
 assert.equal(result.data, null);
 assert.equal(result.error?.code, 'attempt_identity_unavailable');
 assert.deepEqual(scope.snapshot(), { status: 'waiting', hadAccess: true });
 assert.equal(scope.isCurrent(), true);
 state.error = null;
 assert.deepEqual(await services.functions.invoke('drawing-media', { body: { action: 'open' } }), { data: pages, error: null });
 assert.equal(scope.snapshot().status, 'allowed');
 scope.dispose();
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
