import React,{useState}from'react';
import{postLaunchPreview}from'./launch-scope.js';
import{launchReadinessState}from'./launch-readiness.mjs';
const labels={content_rights:'Content publication rights',privacy_terms:'Privacy and terms',refund_policy:'Purchase and refund policy',child_safety:'Younger-student safeguards',drawing_operations:'Human drawing-review operation',provider_acceptance:'Login, storage and payment provider acceptance',backup_restore:'Backup and restore drill',capacity_acceptance:'Staging capacity acceptance'};
const mvpLabels={...labels,provider_acceptance:'Google and real Test-payment journey',capacity_acceptance:'Initial monitoring and capacity'};
export function LaunchReadiness({readiness,onSetGate}){
 const[evidence,setEvidence]=useState({});
 if(!readiness)return<p role="status">Loading launch gates…</p>;
 const{mvp,profileReady,ready,gates,offeringReady}=launchReadinessState(readiness,{expandedPreview:postLaunchPreview}),names=mvp?mvpLabels:labels;
 return<section className="operations-health" aria-label="Launch readiness">
  <div><span className={`status-pill health-${ready?'healthy':'degraded'}`}>{ready?'ready':'closed'}</span><small>Sales {readiness.salesEnabled?'enabled':'disabled'}</small></div>
  <p>{readiness.policyPublished?'Policy version recorded.':'Policy version is not published.'}{' '}
   {mvp?(offeringReady?'An approved paid Part A offering is ready.':'No approved paid Part A offering is released.'):
    (readiness.paperBlueprintReady?'A verified paper blueprint is ready.':'No verified paper blueprint is released.')}
  </p>
  {mvp&&<p className={profileReady?'notice':'error'} role={profileReady?'status':'alert'}>{profileReady?'MVP server API controls verified.':'MVP server API controls are not verified. Keep admission and sales closed.'}</p>}
  {mvp&&readiness.testCheckoutEnabled&&<p className="notice" role="status">Merchant Test acceptance is enabled for approved Google testers until {new Date(readiness.testCheckoutExpiresAt).toLocaleString('en-IN')}. Live sales stay closed.</p>}
  <div className="operations-metrics">{gates.map(g=><article key={g.gate}>
   <span>{names[g.gate]??g.gate}</span><b>{g.approved?'Approved':'Open'}</b>
   <input aria-label={`${names[g.gate]??g.gate} evidence`} value={evidence[g.gate]??g.evidence??''} onChange={event=>setEvidence(value=>({...value,[g.gate]:event.target.value}))} placeholder="Evidence note"/>
   <button onClick={()=>onSetGate(g.gate,!g.approved,evidence[g.gate]??g.evidence??'')}>{g.approved?'Revoke':'Approve'}</button>
  </article>)}</div>
  <p>Every approval is audited. This control does not activate registration, publish papers or enable sales by itself.</p>
 </section>;
}
export function LaunchReadinessPreview(){
 const mvp=!postLaunchPreview;
 return<section className="wrap section"><h1>Launch <em>readiness.</em></h1><LaunchReadiness readiness={{scope:mvp?'paid-mvp-v1':undefined,apiProfileReady:false,offeringReady:false,salesEnabled:false,policyPublished:false,paperBlueprintReady:true,readyForSales:false,gates:Object.keys(labels).filter(g=>!mvp||g!=='drawing_operations').map((gate,i)=>({gate,approved:i<2,evidence:i<2?'Fictional preview evidence':''}))}} onSetGate={()=>{}}/></section>;
}
