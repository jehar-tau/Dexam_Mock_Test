import React,{useEffect,useId,useLayoutEffect,useRef,useState}from'react';
import {Link,useLocation}from'react-router-dom';
import {useAuthState}from'./useAuth.js';
import {AccountAccessBoundary,useAccountServices}from'./AccountAccess.jsx';
import {appendBugReports,bugReportFailure,prepareBugReport,validateBugReportPage,validateBugReportReceipt}from'./bug-report.js';
import {environment} from './environment.js';
import {purchaseSupportContext} from './purchase-history.js';

const purchaseMode=environment.production?'live':'test';

function ReportSession({actorId,linkedOrder}){
 const{rpc,isCurrent,presentForCurrentAccount}=useAccountServices(),prefix=useId();
 const[draft,setDraft]=useState({title:'',description:''}),[errors,setErrors]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(null);
 const[purchase,setPurchase]=useState(linkedOrder);
 const[reports,setReports]=useState([]),[cursor,setCursor]=useState(null),[reading,setReading]=useState(false),[readError,setReadError]=useState('');
 const lifetime=useRef(null),readRequest=useRef(null),action=useRef(null),request=useRef(null),title=useRef(null),description=useRef(null),history=useRef(null);
 const rows=useRef([]),reportElements=useRef(new Map()),focusReport=useRef(null),focusForm=useRef(false);
 useLayoutEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();readRequest.current?.abort();action.current?.abort();};},[]);
 const active=()=>!lifetime.current?.signal.aborted&&isCurrent();
 useLayoutEffect(()=>{if(focusForm.current&&!pending&&!busy){focusForm.current=false;title.current?.focus();}},[pending,busy]);
 useLayoutEffect(()=>{if(focusReport.current){reportElements.current.get(focusReport.current)?.focus();focusReport.current=null;}},[reports]);
 const load=async(after=null,append=false)=>{
  if(!active()||append&&readRequest.current)return;
  readRequest.current?.abort();const controller=new AbortController();readRequest.current=controller;setReading(true);setReadError('');
  const opener=document.activeElement,timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);
  if(!append){rows.current=[];setReports([]);setCursor(null);}
  const current=()=>active()&&!controller.signal.aborted&&readRequest.current===controller;
  try{
   const signal=AbortSignal.any([lifetime.current.signal,controller.signal,timeout.signal]);
   const data=validateBugReportPage(await rpc('my_bug_report_page',{p_cursor:after,p_limit:25},signal),actorId);
   await presentForCurrentAccount(()=>{
    if(!current())return;
    const next=append?appendBugReports(rows.current,data.items):data.items;
    if(append&&(document.activeElement===opener||document.activeElement===document.body))focusReport.current=data.items[0]?.id??null;
    rows.current=next;setReports(next);setCursor(data.nextCursor);
   },signal);
  }catch{if(current())setReadError('Couldn’t load your reports. Try refreshing your reports.');}
  finally{clearTimeout(timer);if(current()){readRequest.current=null;setReading(false);}}
 };
 useEffect(()=>{void load();},[rpc]);
 const send=async()=>{
  if(!active()||action.current)return;
  let snapshot=request.current;
  if(!snapshot){
   const prepared=prepareBugReport({...draft,purchaseOrder:purchase?.reference},window.location.href);setErrors(prepared.errors);
   if(!prepared.request){(prepared.errors.title?title:description).current?.focus();return;}
   snapshot=prepared.request;request.current=snapshot;setPending(snapshot);
  }
  const controller=new AbortController();action.current=controller;setBusy(true);setMessage('');
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);
  const current=()=>active()&&!controller.signal.aborted&&action.current===controller&&request.current===snapshot;
  try{
   const signal=AbortSignal.any([lifetime.current.signal,controller.signal,timeout.signal]);
   const reportId=validateBugReportReceipt(await rpc('submit_bug_report',snapshot,signal));
   await presentForCurrentAccount(()=>{
    if(!current())return;
    request.current=null;setPending(null);setDraft({title:'',description:''});setPurchase(null);setErrors({});
    setMessage(<>Your report is in the review queue. Report reference <code>{reportId}</code></>);focusForm.current=true;void load();
   },signal);
  }catch(error){
   if(!current())return;const failure=bugReportFailure(error);setMessage(failure.message);
   if(failure.definitive){request.current=null;setPending(null);}
  }finally{clearTimeout(timer);if(action.current===controller){action.current=null;if(active())setBusy(false);}}
 };
 const stop=()=>{
  action.current?.abort();action.current=null;request.current=null;setPending(null);setBusy(false);setDraft({title:'',description:''});setPurchase(null);setErrors({});
  setMessage('Stopped retrying. Your earlier report may already be saved. Check Your reports before starting another.');focusForm.current=true;void load();
 };
 return<>
  <form className="admin-form" noValidate onSubmit={event=>{event.preventDefault();void send();}}>
   {purchase&&<div className="notice"><p><strong>Linked order</strong> <code>{purchase.reference}</code></p>
    <button className="button quiet" type="button" disabled={Boolean(pending)} onClick={()=>{setPurchase(null);setMessage('');title.current?.focus();}}>Remove order link</button>
   </div>}
   <label>Short title<input ref={title} name="title" value={draft.title} onChange={event=>setDraft(value=>({...value,title:event.target.value}))} disabled={Boolean(pending)} minLength={5} maxLength={140} required aria-invalid={Boolean(errors.title)} aria-describedby={errors.title?prefix+'-title-error':undefined}/></label>
   {errors.title&&<p id={prefix+'-title-error'} className="error">{errors.title}</p>}
   <label>What happened?<textarea ref={description} name="description" value={draft.description} onChange={event=>setDraft(value=>({...value,description:event.target.value}))} disabled={Boolean(pending)} minLength={10} maxLength={5000} rows={6} required aria-invalid={Boolean(errors.description)} aria-describedby={errors.description?prefix+'-description-error':undefined}/></label>
   {errors.description&&<p id={prefix+'-description-error'} className="error">{errors.description}</p>}
   <button className="button" disabled={busy}>{busy?'Sending…':pending?'Retry report':'Send report'}</button>
   {pending&&!busy&&<button className="button quiet" type="button" onClick={stop}>Stop retrying and refresh</button>}
  </form>
  {message&&<p role="status">{message}</p>}
  <section aria-label="Your support reports">
   <h2 ref={history} tabIndex={-1}>Your reports</h2>
   <button className="button quiet" type="button" onClick={()=>void load()}>Refresh your reports</button>
   {reading&&<p role="status">Loading your reports…</p>}
   {readError&&<p role="alert" className="error">{readError}</p>}
   {!reading&&!readError&&reports.length===0&&<p>No reports yet.</p>}
   <div className="admin-list">{reports.map(report=><article className="bug-report-card" key={report.id} tabIndex={-1} aria-labelledby={prefix+'-'+report.id} ref={element=>{if(element)reportElements.current.set(report.id,element);else reportElements.current.delete(report.id);}}><h3 id={prefix+'-'+report.id}>{report.title}</h3><span className="status-pill">{report.status}</span><p>Report reference <code>{report.id}</code></p>{report.purchase?.mode===purchaseMode&&<p>Linked order <code>{report.purchase.reference}</code></p>}<p>{report.description}</p>{report.adminReply&&<p><strong>Team reply:</strong> {report.adminReply}</p>}</article>)}</div>
   {cursor&&<button className="button quiet" type="button" disabled={reading} onClick={()=>void load(cursor,true)}>Load more reports</button>}
  </section>
 </>;
}
export function BugReport(){
 const{session,loading}=useAuthState(),location=useLocation(),heading=useRef(null);
 const scopeKey=`${session?.user.id??'signed-out'}:${location.key}`,previous=useRef(scopeKey);
 useLayoutEffect(()=>{if(previous.current!==scopeKey&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=scopeKey;},[scopeKey]);
 return<section className="wrap section admin-page bug-report-page"><span className="eyebrow">HELP US IMPROVE</span><h1 ref={heading} tabIndex={-1}>Report a <em>problem.</em></h1>
  {loading?<p role="status">Checking your account…</p>:!session?<p>Please <Link to="/account">sign in</Link> to continue.</p>:<AccountAccessBoundary key={scopeKey} actorId={session.user.id} headingRef={heading}>
   <ReportSession actorId={session.user.id} linkedOrder={purchaseSupportContext(location.state,session.user.id,purchaseMode)}/>
  </AccountAccessBoundary>}
 </section>;
}
