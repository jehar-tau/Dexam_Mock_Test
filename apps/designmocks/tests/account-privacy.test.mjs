import assert from'node:assert/strict';
import test from'node:test';
import{privacyCancelReceipt,privacyOperation,privacyRequestReceipt,privacyRequestsResponse}from'../src/account-privacy.js';
const row={id:'00000000-0000-4000-8000-000000001311',type:'account_deletion',status:'open',adminNote:null,createdAt:'2026-11-08T01:00:00.000001Z',updatedAt:'2026-11-08T01:00:00.000001Z'};
test('privacy response accepts known reviewed states and returns independent records',()=>{
 const source=[row],value=privacyRequestsResponse(source);assert.deepEqual(value,source);assert.notEqual(value,source);assert.notEqual(value[0],source[0]);
 for(const status of['open','in_progress','cancelled','closed','declined'])assert.equal(privacyRequestsResponse([{...row,status}])[0].status,status);
 assert.deepEqual(privacyRequestsResponse([]),[]);
});
test('privacy response refuses malformed records, duplicate identities and competing active states',()=>{
 for(const value of[null,{},[null],[{...row,id:'untrusted'}],[{...row,type:'delete_immediately'}],[{...row,status:'done'}],[{...row,adminNote:42}],[{...row,adminNote:'x'.repeat(2001)}],[{...row,updatedAt:'invalid'}],[{...row,handledBy:'private-operator-id'}],[row,row],[row,{...row,id:'00000000-0000-4000-8000-000000001312',status:'in_progress'}]])assert.throws(()=>privacyRequestsResponse(value),/load your privacy/);
});
test('privacy acknowledgements require the precise create and cancellation contracts',()=>{
 assert.equal(privacyRequestReceipt(row.id),row.id);assert.equal(privacyCancelReceipt(null),undefined);
 for(const value of[null,undefined,{},[],true,'not-a-request'])assert.throws(()=>privacyRequestReceipt(value),/confirm that change/);
 for(const value of[undefined,{},[],true,row.id])assert.throws(()=>privacyCancelReceipt(value),/confirm that change/);
});
test('privacy cancellation ends an unresponsive operation and discards its later response',async()=>{
 const controller=new AbortController();let finish;const later=new Promise(resolve=>{finish=resolve;}),operation=privacyOperation(()=>later,controller.signal);controller.abort(new Error('fictional request deadline'));await assert.rejects(operation,/deadline/);finish('late private response');await Promise.resolve();
});
test('privacy operation never starts after cancellation and preserves active results and errors',async()=>{
 const controller=new AbortController();controller.abort();let started=false;await assert.rejects(privacyOperation(()=>{started=true;},controller.signal));assert.equal(started,false);
 assert.equal(await privacyOperation(()=>42,new AbortController().signal),42);await assert.rejects(privacyOperation(()=>{throw new Error('fictional operation error');},new AbortController().signal),/fictional operation error/);
});
