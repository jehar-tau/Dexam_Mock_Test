import test from 'node:test';
import assert from 'node:assert/strict';
import {allowPostLaunchPreview,launchNavigation,deferredModules} from '../src/launch-scope.mjs';
test('production cannot opt into deferred modules and nonproduction needs explicit opt-in',()=>{
 for(const deployment of['production',undefined,'unknown'])for(const value of[true,false,undefined])assert.equal(allowPostLaunchPreview(deployment,value),false);
 for(const deployment of['development','staging','test']){assert.equal(allowPostLaunchPreview(deployment,true),true);for(const value of[false,undefined,'true',1])assert.equal(allowPostLaunchPreview(deployment,value),false);}
});
test('the MVP navigation offers only owned progress and released papers',()=>{
 assert.deepEqual(launchNavigation.map(item=>item.to),['/dashboard','/dashboard/mocks']);
 assert.deepEqual(Object.keys(deferredModules),['all-india','practice','learn','community','drawings']);assert.ok(Object.isFrozen(launchNavigation));
});
