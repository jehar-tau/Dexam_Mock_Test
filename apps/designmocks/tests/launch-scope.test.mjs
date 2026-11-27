import test from 'node:test';
import assert from 'node:assert/strict';
import {allowPostLaunchPreview,launchNavigation,deferredModules,releasedModules,releasedStudentModules,releasableModuleNames,studentNavigation} from '../src/launch-scope.mjs';
test('production cannot opt into deferred modules and nonproduction needs explicit opt-in',()=>{
 for(const deployment of['production',undefined,'unknown'])for(const value of[true,false,undefined])assert.equal(allowPostLaunchPreview(deployment,value),false);
 for(const deployment of['development','staging','test']){assert.equal(allowPostLaunchPreview(deployment,true),true);for(const value of[false,undefined,'true',1])assert.equal(allowPostLaunchPreview(deployment,value),false);}
});
test('student modules open only from an exact, explicit release list',()=>{
 assert.deepEqual(releasedStudentModules(undefined),[]);
 assert.deepEqual(releasedStudentModules('all-india,practice'),['all-india','practice']);
 for(const invalid of['all-india,unknown','all-india,all-india','all-india,','admin','learn'])assert.deepEqual(releasedStudentModules(invalid),[]);
 assert.deepEqual(studentNavigation([]).map(item=>item.label),['Overview','Released papers','Papers','Learn']);
 assert.deepEqual(studentNavigation(['mocks','all-india','practice','community']).map(item=>item.label),
  ['Overview','Exam-wise mocks','Papers','All India mocks','Topic practice','Learn','Community']);
});
test('the MVP navigation offers owned progress, released papers and Learn',()=>{
 assert.deepEqual(launchNavigation.map(item=>item.to),['/dashboard','/dashboard/mocks','/papers','/dashboard/learn']);
 assert.deepEqual(Object.keys(deferredModules),['all-india','practice','community','drawings']);
 assert.deepEqual(Object.keys(releasedModules),['learn']);assert.ok(Object.isFrozen(releasedModules));assert.ok(Object.isFrozen(launchNavigation));
});
test('drawing review is released by exact name and adds no student navigation',()=>{
 assert.deepEqual(releasedStudentModules('practice,drawing-review'),['practice','drawing-review']);
 assert.deepEqual(releasedStudentModules(' drawing-review '),['drawing-review']);
 for(const invalid of['drawing-review,drawing-review','drawing_review','drawings','Drawing-Review','practice,drawing-review,'])assert.deepEqual(releasedStudentModules(invalid),[]);
 assert.ok(releasableModuleNames.includes('drawing-review'));assert.ok(Object.isFrozen(releasableModuleNames));
 assert.deepEqual(studentNavigation(['practice','drawing-review']).map(item=>item.label),['Overview','Released papers','Papers','Topic practice','Learn']);
 assert.ok(studentNavigation(['drawing-review']).every(item=>!item.to.startsWith('/review')));
});
