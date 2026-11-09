import React,{useEffect,useLayoutEffect,useRef,useState}from'react';
import{useLocation}from'react-router-dom';
import{downloadAccountExport}from'./account-export.js';
import{AccountAccessBoundary,useAccountServices}from'./AccountAccess.jsx';
import{privacyCancelReceipt,privacyExportMessage,privacyOperation,privacyReadMessage,privacyRequestReceipt,privacyRequestsResponse,privacyWriteMessage}from'./account-privacy.js';
export{downloadAccountExport}from'./account-export.js';

export function AccountPrivacy({accountId,requests=[],reading=false,readError='',onRefresh,onExport,onRequestDeletion,onCancel,heading=true}){
 const[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const lifetime=useRef(null),action=useRef(null),notice=useRef(null),focusNotice=useRef(false);
 useLayoutEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();action.current?.abort();};},[accountId]);
 useLayoutEffect(()=>{if(focusNotice.current&&!busy){focusNotice.current=false;notice.current?.focus();}},[busy,message]);
 const active=requests?.find(row=>row.type==='account_deletion'&&['open','in_progress'].includes(row.status));
 const latest=requests?.[0],showDecision=!active&&['closed','declined'].includes(latest?.status);
 const run=async kind=>{
  if(action.current||lifetime.current.signal.aborted||kind!=='export'&&(uncertain||reading||requests===null))return;
  const controller=new AbortController();action.current=controller;setBusy(kind);setMessage('');
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000),signal=AbortSignal.any([lifetime.current.signal,controller.signal,timeout.signal]);
  const current=()=>!lifetime.current.signal.aborted&&!controller.signal.aborted&&action.current===controller;
  try{
   if(kind==='export'){
    const data=await privacyOperation(()=>onExport({signal}),signal);signal.throwIfAborted();if(!current())return;downloadAccountExport(data,accountId);setMessage('Your private JSON export was downloaded to this device.');
   }else{
    await privacyOperation(()=>kind==='delete'?onRequestDeletion({signal}):onCancel(active.id,{signal}),signal);
    signal.throwIfAborted();if(!current())return;
    setUncertain(false);setMessage(kind==='delete'?'Deletion request received. Your account remains active while the team verifies the request and applicable record-retention duties.':'Deletion request cancelled.');focusNotice.current=true;
    if(onRefresh)await onRefresh();
   }
  }catch(error){if(current()){
   if(kind==='export')setMessage(error.message==='Your export could not be verified. Refresh your account and try again.'?error.message:privacyExportMessage);
   else{setUncertain(true);setMessage(privacyWriteMessage);focusNotice.current=true;}
  }}finally{clearTimeout(timer);if(action.current===controller){action.current=null;if(!lifetime.current.signal.aborted)setBusy('');}}
 };
 const refresh=async()=>{if(action.current)return;const checked=await onRefresh();if(!lifetime.current.signal.aborted&&checked){setUncertain(false);setMessage('Privacy requests refreshed. Check the current status before making another change.');}};
 const locked=Boolean(busy)||reading||requests===null||uncertain;
 return<section className="account-privacy" aria-label="Your data and account">
  {heading&&<h3>Your data and account</h3>}
  <p>Download a private copy of your profile, saved answers, released results, progress, community contributions, reports and access records. Scores and teacher feedback are included after their release.</p>
  <button className="button quiet" type="button" disabled={Boolean(busy)} onClick={()=>void run('export')}>{busy==='export'?'Preparing your data…':'Download my data'}</button>
  <p>Account deletion is a reviewed request, not an instant browser action. This prevents accidental loss and allows legally required purchase records to be handled correctly.</p>
  {onRefresh&&<button className="button quiet" type="button" disabled={Boolean(busy)} onClick={()=>void refresh()}>Refresh privacy requests</button>}
  {reading&&<p role="status">Loading privacy requests…</p>}{readError&&<p role="alert" className="error">{readError}</p>}
  {showDecision&&<div className="notice"><b>Latest deletion request: {latest.status}</b>{latest.adminNote&&<p>{latest.adminNote}</p>}</div>}
  {active?<div className="notice"><b>Deletion request: {active.status.replaceAll('_',' ')}</b>{active.adminNote&&<p>{active.adminNote}</p>}{active.status==='open'&&<button type="button" className="text-button" disabled={locked} onClick={()=>void run('cancel')}>{busy==='cancel'?'Cancelling request…':'Cancel deletion request'}</button>}</div>:
   <button type="button" className="text-button" disabled={locked} onClick={()=>void run('delete')}>{busy==='delete'?'Sending deletion request…':'Request account deletion'}</button>}
  {message&&<p ref={notice} tabIndex={-1} role="status">{message}</p>}
 </section>;
}

function PrivacySession({accountId}){
 const{rpc,isCurrent}=useAccountServices(),[requests,setRequests]=useState(null),[reading,setReading]=useState(false),[error,setError]=useState('');
 const lifetime=useRef(null),read=useRef(null);
 useLayoutEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();read.current?.abort();};},[]);
 const load=async()=>{
  read.current?.abort();const controller=new AbortController();read.current=controller;setRequests(null);setReading(true);setError('');
  const timer=setTimeout(()=>controller.abort(),20000),current=()=>!lifetime.current.signal.aborted&&read.current===controller&&isCurrent();
  try{const signal=AbortSignal.any([lifetime.current.signal,controller.signal]),rows=privacyRequestsResponse(await privacyOperation(()=>rpc('my_privacy_requests',{},signal),signal));if(current()){setRequests(rows);return true;}return false;}
  catch{if(current())setError(privacyReadMessage);return false;}
  finally{clearTimeout(timer);if(current()){read.current=null;setReading(false);}}
 };
 useEffect(()=>{void load();},[rpc]);
 return<AccountPrivacy heading={false} accountId={accountId} requests={requests} reading={reading} readError={error} onRefresh={load}
  onExport={({signal})=>rpc('export_my_account_data',{},signal)}
  onRequestDeletion={async({signal})=>privacyRequestReceipt(await rpc('request_account_deletion',{},signal))}
  onCancel={async(id,{signal})=>privacyCancelReceipt(await rpc('cancel_my_privacy_request',{p_id:id},signal))}/>;
}
export function AccountPrivacyPanel({accountId}){
 const location=useLocation(),heading=useRef(null),scopeKey=accountId+':'+location.key,previous=useRef(scopeKey);
 useLayoutEffect(()=>{if(previous.current!==scopeKey&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=scopeKey;},[scopeKey]);
 return<section className="account-privacy-panel"><h3 ref={heading} tabIndex={-1}>Your data and account</h3><AccountAccessBoundary key={scopeKey} kind="privacy" actorId={accountId} headingRef={heading}><PrivacySession accountId={accountId}/></AccountAccessBoundary></section>;
}
export function AccountPrivacyPreview(){
 const[requests,setRequests]=useState([]);
 return<section className="wrap section account-card"><h1>Account privacy <em>controls.</em></h1><AccountPrivacy accountId="private-preview" requests={requests} onExport={async()=>({schemaVersion:2,drawingUploads:[],exportedAt:new Date().toISOString(),accountId:'private-preview',profile:null,attempts:[],questionReports:[],results:{examMocks:[],allIndia:[],drawingReviews:[]}})}
  onRequestDeletion={async()=>setRequests([{id:'preview',type:'account_deletion',status:'open'}])} onCancel={async()=>setRequests([])}/></section>;
}
