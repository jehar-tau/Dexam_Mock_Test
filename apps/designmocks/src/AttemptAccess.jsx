import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {platform} from './platform.js';
import {createAttemptAccessScope,createAttemptServices} from './attempt-access.js';

function AccessSession({actorId,children,onRetry}){
 const[access,setAccess]=useState({status:'checking',hadAccess:false}),[scope,setScope]=useState(null);
 const heading=useRef(null),privateRoot=useRef(null),recoverFocus=useRef(false);
 useLayoutEffect(()=>{
  const href=window.location.href,key=window.history.state?.key;
  const value=createAttemptAccessScope({auth:platform.auth,actorId,isCurrent:()=>window.location.href===href&&window.history.state?.key===key,onChange:next=>{
   if(next.status==='denied')recoverFocus.current=document.activeElement===document.body||Boolean(privateRoot.current?.contains(document.activeElement));setAccess(next);
  }});setScope(value);void value.verify();
  const{data}=platform.auth.onAuthStateChange((_event,next)=>{if(next?.user?.id!==actorId)value.invalidate();});
  const visible=()=>{if(document.visibilityState==='visible')void value.verify();};
  window.addEventListener('focus',visible);window.addEventListener('pageshow',visible);document.addEventListener('visibilitychange',visible);const timer=setInterval(visible,60000);
  return()=>{value.dispose();data.subscription.unsubscribe();clearInterval(timer);window.removeEventListener('focus',visible);window.removeEventListener('pageshow',visible);document.removeEventListener('visibilitychange',visible);};
 },[actorId]);
 useLayoutEffect(()=>{if(access.status==='denied'&&recoverFocus.current){recoverFocus.current=false;heading.current?.focus();}},[access.status]);
 const services=useMemo(()=>scope?createAttemptServices(scope,platform):null,[scope]);
 const opened=access.hadAccess&&access.status!=='denied';
 return<section aria-label="Attempt access">
  {!opened&&<div className="wrap page-intro"><h1 ref={heading} tabIndex={-1}>Your practice <em>space.</em></h1>
   {access.status==='checking'?<p role="status">Checking attempt access…</p>:<>
    <p className="error" role="alert">{access.status==='denied'?'Attempt access ended. Private questions, reports and image previews were cleared.':'Attempt access could not be verified. Reconnect and check access to open your paper.'}</p>
    <button type="button" className="button quiet" onClick={onRetry}>Check attempt access</button><p><Link to="/account">Go to your account</Link></p>
   </>}<Link to="/dashboard">← Back to workspace</Link></div>}
  {opened&&services&&<div ref={privateRoot}>
   {access.status==='waiting'&&<p className="wrap notice" role="status">Waiting to verify your exam account. Keep working on this device; the timer continues. Reconnect before the deadline to sync answers.</p>}
   {children(services)}
  </div>}
 </section>;
}
export function AttemptAccessBoundary(props){const[retry,setRetry]=useState(0);return<AccessSession key={retry} {...props} onRetry={()=>setRetry(value=>value+1)}/>;}
