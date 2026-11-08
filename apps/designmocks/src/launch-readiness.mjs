export const mvpLaunchGates=Object.freeze(['content_rights','privacy_terms','refund_policy','child_safety','provider_acceptance','backup_restore','capacity_acceptance']);
export function launchReadinessState(value,{expandedPreview=false}={}){
 const data=value&&typeof value==='object'?value:{},mvp=!expandedPreview||data.scope==='paid-mvp-v1',raw=Array.isArray(data.gates)?data.gates:[],gates=raw.filter(g=>g&&typeof g.gate==='string'&&(!mvp||mvpLaunchGates.includes(g.gate))),
  profileReady=data.scope==='paid-mvp-v1'&&data.apiProfileReady===true,offeringReady=data.offeringReady===true,
  complete=raw.length===mvpLaunchGates.length&&new Set(gates.map(g=>g.gate)).size===mvpLaunchGates.length&&gates.every(g=>g.approved===true&&typeof g.evidence==='string'&&g.evidence.trim().length>=8),
  ready=data.readyForSales===true&&(!mvp||profileReady&&offeringReady&&data.environmentMode==='live'&&data.testCheckoutEnabled===false&&data.policyPublished===true&&data.allAttestationsApproved===true&&complete);
 return{mvp,gates,profileReady,offeringReady,ready};
}
