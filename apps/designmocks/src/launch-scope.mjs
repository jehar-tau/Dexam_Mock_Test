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
export const launchNavigation=Object.freeze([
 {to:'/dashboard',label:'Overview',mark:'O',end:true},
 {to:'/dashboard/mocks',label:'Released papers',mark:'M'},
 {to:'/dashboard/learn',label:'Learn',mark:'L'},
]);
export const deferredModules=Object.freeze({
 'all-india':'All India mocks',practice:'Topic practice',community:'Community',drawings:'Drawing review',
});
