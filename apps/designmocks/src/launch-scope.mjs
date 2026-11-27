// The owner froze the first paid release on 8 November 2026. Expanded modules
// are retained only for explicitly opted-in nonproduction regression previews.
export function allowPostLaunchPreview(deployment,optIn){
 return ['development','staging','test'].includes(deployment)&&optIn===true;
}
// Owner decision, 16 November 2026: Learn's interactive programmes are
// released to signed-in students. They run in the browser and call no
// backend function; the theory-lesson catalogue stays in the preview until
// its migrations are promoted.
export const releasedModules=Object.freeze({learn:'Learn'});
export function allowReleasedLearn(portalReady) {
 return portalReady === true && Object.hasOwn(releasedModules, 'learn');
}
export const launchNavigation=Object.freeze([
 {to:'/dashboard',label:'Overview',mark:'O',end:true},
 {to:'/dashboard/mocks',label:'Released papers',mark:'M'},
 {to:'/papers',label:'Papers',mark:'Y'},
 {to:'/dashboard/learn',label:'Learn',mark:'L'},
]);
const studentModuleItems=Object.freeze({
 mocks:{to:'/dashboard/mocks',label:'Exam-wise mocks',mark:'M'},
 'all-india':{to:'/dashboard/all-india',label:'All India mocks',mark:'A'},
 practice:{to:'/dashboard/practice',label:'Topic practice',mark:'P'},
 community:{to:'/dashboard/community',label:'Community',mark:'C'},
});
// Owner decision, 27 November 2026: teacher marking of drawing photos is
// released by name, like a student module. It adds no student navigation; it
// opens /review/drawings, the account page's "Review drawings" link and the
// Admin page's drawing queue and reviewer access.
const staffReleaseModules=Object.freeze(['drawing-review']);
export const releasableModuleNames=Object.freeze([...Object.keys(studentModuleItems),...staffReleaseModules]);
export function releasedStudentModules(value){
 if(typeof value!=='string'||!value.trim())return [];
 const names=value.split(',').map(name=>name.trim());
 if(names.some(name=>!releasableModuleNames.includes(name))||new Set(names).size!==names.length)return [];
 return names;
}
export function studentNavigation(released){
 const enabled=new Set(released);
 return Object.freeze([
  launchNavigation[0],enabled.has('mocks')?studentModuleItems.mocks:launchNavigation[1],launchNavigation[2],
  ...['all-india','practice'].filter(name=>enabled.has(name)).map(name=>studentModuleItems[name]),
  launchNavigation[3],
  ...(enabled.has('community')?[studentModuleItems.community]:[]),
 ]);
}
export const deferredModules=Object.freeze({
 'all-india':'All India mocks',practice:'Topic practice',community:'Community',drawings:'Drawing review',
});
