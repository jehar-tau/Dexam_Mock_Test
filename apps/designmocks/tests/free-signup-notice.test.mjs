import assert from 'node:assert/strict';
import test from 'node:test';
import {freeSignupNoticeState} from '../src/free-signup-notice.js';

test('exempt accounts proceed and required accounts are bound to the published build revision',()=>{
  const version='reviewed-test-revision';
  assert.equal(freeSignupNoticeState({required:false, accepted:false, version:null},null),'ready');
  for (const accepted of [true,false]) {
    const receipt={required:true, accepted, version};
    assert.equal(freeSignupNoticeState(receipt,version),accepted?'ready':'pending');
    assert.equal(freeSignupNoticeState(receipt,'earlier-revision'),'mismatch');
    assert.equal(freeSignupNoticeState(receipt,null),'mismatch');
    assert.equal(freeSignupNoticeState({...receipt,version:null},version),'mismatch');
  }
});

test('malformed or unavailable receipts never grant notice acceptance',()=>{
  for(const invalid of [null, {}, {required:false,accepted:null,version:null}, {required:'false',accepted:true,version:null}, {required:true,accepted:true,version:42}]) {
    assert.throws(()=>freeSignupNoticeState(invalid,'build-version'),/Invalid signup notice/);
  }
});
