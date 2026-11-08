// The owner froze the first paid release on 8 November 2026. Expanded modules
// are retained only for explicitly opted-in nonproduction regression previews.
export function allowPostLaunchPreview(deployment,optIn){
 return ['development','staging','test'].includes(deployment)&&optIn===true;
}
export const launchNavigation=Object.freeze([
 {to:'/dashboard',label:'Overview',mark:'O',end:true},
 {to:'/dashboard/mocks',label:'Released papers',mark:'M'},
]);
export const deferredModules=Object.freeze({
 'all-india':'All India mocks',practice:'Topic practice',learn:'Learn',community:'Community',drawings:'Drawing review',
});
