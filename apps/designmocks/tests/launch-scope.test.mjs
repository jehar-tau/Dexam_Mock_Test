import test from 'node:test';
import assert from 'node:assert/strict';
import {allowPostLaunchPreview,launchNavigation,deferredModules,releasedModules} from '../src/launch-scope.mjs';
test('production cannot opt into deferred modules and nonproduction needs explicit opt-in',()=>{
 for(const deployment of['production',undefined,'unknown'])for(const value of[true,false,undefined])assert.equal(allowPostLaunchPreview(deployment,value),false);
 for(const deployment of['development','staging','test']){assert.equal(allowPostLaunchPreview(deployment,true),true);for(const value of[false,undefined,'true',1])assert.equal(allowPostLaunchPreview(deployment,value),false);}
});
test('the MVP navigation offers owned progress, released papers and Learn',()=>{
 assert.deepEqual(launchNavigation.map(item=>item.to),['/dashboard','/dashboard/mocks','/dashboard/learn']);
 assert.deepEqual(Object.keys(deferredModules),['all-india','practice','community','drawings']);
 assert.deepEqual(Object.keys(releasedModules),['learn']);assert.ok(Object.isFrozen(releasedModules));assert.ok(Object.isFrozen(launchNavigation));
});
