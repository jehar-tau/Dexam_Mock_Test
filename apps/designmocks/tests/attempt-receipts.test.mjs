import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerSyncQueue} from '../src/attempt-sync.js';
import {createAttemptAnswerJournal} from '../src/attempt-answer-journal.js';
const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),get length(){return data.size;},key:index=>[...data.keys()][index]};};
test('malformed, stale and ambiguous answer receipts never clear the device journal or claim saved',async()=>{
 for(const receipt of [null,undefined,{},true,{accepted:1,revision:100,answer:'B'},{accepted:true,revision:99,answer:'B'},{accepted:true,revision:101,answer:'B'},{accepted:true,revision:100,answer:'A'},{accepted:true,revision:100.5,answer:'B'},{accepted:true,revision:100},{accepted:false,revision:99,answer:'A'}]){
  const journal=createAttemptAnswerJournal({userId:'fictional-actor',attemptId:'fictional-attempt',deadline:900,storage:storage()}),saved=[];
  const queue=createAnswerSyncQueue({journal,revisionSeed:()=>100,send:async()=>receipt,onSaved:value=>saved.push(value)});
  assert.equal((await queue.enqueue('q1','B')).saved,false);assert.equal(queue.pendingAnswer('q1'),'B');assert.equal(journal.read('q1').revision,100);assert.deepEqual(saved,[]);
 }
});
test('a confirmed equal revision reconciles a lost commit with the canonical server answer',async()=>{
 const journal=createAttemptAnswerJournal({userId:'fictional-actor',attemptId:'fictional-attempt',deadline:900,storage:storage()}),saved=[];
 const queue=createAnswerSyncQueue({journal,revisionSeed:()=>100,send:async()=>({accepted:false,revision:100,answer:'A'}),onSaved:value=>saved.push(value)});
 assert.equal((await queue.enqueue('q1','B')).saved,true);assert.deepEqual(saved,[{questionId:'q1',revision:100,answer:'A',accepted:false}]);assert.equal(journal.read('q1'),null);
});
