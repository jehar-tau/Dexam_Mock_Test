import React,{createContext,useContext,useLayoutEffect,useMemo,useRef,useState}from'react';
import {Link}from'react-router-dom';
import {platform}from'./platform.js';
import {createAdminAccessScope,isAdminAccessFailure}from'./admin-access.js';

const AccountServices=createContext(null);
export const useAccountServices=()=>useContext(AccountServices);

function AccessSession({actorId,headingRef,children,onRetry}){
 const [access,setAccess]=useState({status:'checking',hadAccess:false}),[scope,setScope]=useState(null);
 const privateRoot=useRef(null),recoverFocus=useRef(false);
 useLayoutEffect(()=>{
  const href=window.location.href,historyKey=window.history.state?.key;
  const value=createAdminAccessScope({check:async signal=>{
   signal.throwIfAborted();const{data,error}=await platform.auth.getUser();signal.throwIfAborted();if(error)throw error;return data.user?.id===actorId;
  },isCurrent:()=>window.location.href===href&&window.history.state?.key===historyKey,onChange:next=>{
   if(next.status!=='allowed')recoverFocus.current=document.activeElement===document.body||Boolean(privateRoot.current?.contains(document.activeElement));setAccess(next);
  }});
  setScope(value);void value.verify();
  const{data}=platform.auth.onAuthStateChange((_event,next)=>{if(next?.user?.id!==actorId)value.invalidate();});
  const visible=()=>{if(document.visibilityState==='visible')void value.verify();},restored=()=>void value.verify();
  window.addEventListener('focus',visible);window.addEventListener('pageshow',restored);document.addEventListener('visibilitychange',visible);const timer=setInterval(visible,60000);
  return()=>{value.dispose();data.subscription.unsubscribe();clearInterval(timer);window.removeEventListener('focus',visible);window.removeEventListener('pageshow',restored);document.removeEventListener('visibilitychange',visible);};
 },[actorId]);
 useLayoutEffect(()=>{if(['denied','unavailable'].includes(access.status)&&recoverFocus.current){recoverFocus.current=false;headingRef.current?.focus();}},[access.status,headingRef]);
 const services=useMemo(()=>scope?{isCurrent:scope.isCurrent,assertCurrent:scope.assertCurrent,rpc:(name,args,signal)=>scope.run(async active=>{
  active.throwIfAborted();const{data,error,status}=await platform.rpc(name,args).abortSignal(active);active.throwIfAborted();
  if(error){const failure=Object.assign(new Error(error.message),error,{status});if(isAdminAccessFailure(failure))scope.invalidate();throw failure;}return data;
 },signal)}:null,[scope]);
 return<section aria-label="Report access">
  {access.status==='checking'&&<p role="status">Checking report access…</p>}
  {access.status==='denied'&&<p role="alert" className="error">Your sign-in changed or ended. Private reports were cleared.</p>}
  {access.status==='unavailable'&&<p role="alert" className="error">Report access could not be verified. Private reports were cleared.</p>}
  {['denied','unavailable'].includes(access.status)&&<><button type="button" className="button quiet" onClick={onRetry}>Check report access</button><p><Link to="/account">Go to your account</Link></p></>}
  {access.status==='allowed'&&services&&<AccountServices.Provider value={services}><div ref={privateRoot}>{children}</div></AccountServices.Provider>}
 </section>;
}
export function AccountAccessBoundary({actorId,headingRef,children}){
 const[attempt,setAttempt]=useState(0);
 return<AccessSession key={attempt} actorId={actorId} headingRef={headingRef} onRetry={()=>{headingRef.current?.focus();setAttempt(value=>value+1);}}>{children}</AccessSession>;
}
