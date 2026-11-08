import React,{createContext,useContext,useLayoutEffect,useMemo,useRef,useState}from'react';
import {Link}from'react-router-dom';
import {platform}from'./platform.js';
import {createAdminAccessScope}from'./admin-access.js';
import {verifiedAccountToken}from'./account-identity.js';
import {createAccountServices}from'./account-services.js';

const AccountServices=createContext(null);
export const useAccountServices=()=>useContext(AccountServices);
const overviewCopy={label:'Overview access',checking:'Checking Overview access…',unavailable:'Overview access could not be verified. Private history and paper starts were cleared.',denied:'Overview access ended. Private history and paper starts were cleared.',retry:'Check Overview access'};
const catalogueCopy={label:'Mock access',checking:'Checking mock access…',unavailable:'Mock access could not be verified. Private choices and pending starts were cleared.',denied:'Mock access ended. Private choices and pending starts were cleared.',retry:'Check mock access'};
const purchaseCopy={label:'Purchase access',checking:'Checking purchase access…',unavailable:'Purchase access could not be verified. The payment window and purchase confirmation were cleared.',denied:'Purchase access ended. The payment window and purchase confirmation were cleared.',retry:'Check purchase access'};
const descriptions={reports:{label:'Report access',checking:'Checking report access…',unavailable:'Report access could not be verified. Private reports were cleared.',denied:'Your sign-in changed or ended. Private reports were cleared.',retry:'Check report access'},profile:{label:'Profile access',checking:'Checking profile access…',unavailable:'Profile access could not be verified. Private profile details were cleared.',denied:'Your sign-in changed or ended. Private profile details were cleared.',retry:'Check profile access'},privacy:{label:'Privacy access',checking:'Checking privacy access…',unavailable:'Privacy access could not be verified. Private requests were cleared.',denied:'Privacy access ended. Private requests were cleared.',retry:'Check privacy access'},learn:{label:'Learn access',checking:'Checking Learn access…',unavailable:'Learn access could not be verified. Private progress and open lessons were cleared.',denied:'Learn access ended. Private progress and open lessons were cleared.',retry:'Check Learn access'},community:{label:'Community access',checking:'Checking Community access…',unavailable:'Community access could not be verified. Private discussions, drafts and images were cleared.',denied:'Community access ended. Private discussions, drafts and images were cleared.',retry:'Check Community access'}};

function AccessSession({actorId,headingRef,children,onRetry,kind}){
 const copy=kind==='purchase'?purchaseCopy:kind==='overview'?overviewCopy:kind==='catalogue'?catalogueCopy:descriptions[kind];
 const [access,setAccess]=useState({status:'checking',hadAccess:false}),[scope,setScope]=useState(null);
 const privateRoot=useRef(null),recoverFocus=useRef(false);
 useLayoutEffect(()=>{
  const href=window.location.href,historyKey=window.history.state?.key;
  const value=createAdminAccessScope({check:async signal=>{
   return Boolean(await verifiedAccountToken(platform.auth,actorId,signal));
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
 const services=useMemo(()=>scope?createAccountServices(scope,platform,actorId,{targetDenials:kind==='community'}):null,[scope,actorId,kind]);
 return<section aria-label={copy.label}>
  {access.status==='checking'&&<p role="status">{copy.checking}</p>}
  {access.status==='denied'&&<p role="alert" className="error">{copy.denied}</p>}
  {access.status==='unavailable'&&<p role="alert" className="error">{copy.unavailable}</p>}
  {['denied','unavailable'].includes(access.status)&&<><button type="button" className="button quiet" onClick={onRetry}>{copy.retry}</button><p><Link to="/account">Go to your account</Link></p></>}
  {access.status==='allowed'&&services&&<AccountServices.Provider value={services}><div ref={privateRoot}>{children}</div></AccountServices.Provider>}
 </section>;
}
export function AccountAccessBoundary({actorId,headingRef,children,kind='reports'}){
 const[attempt,setAttempt]=useState(0);
 return<AccessSession key={`${kind}:${attempt}`} kind={kind} actorId={actorId} headingRef={headingRef} onRetry={()=>{headingRef.current?.focus();setAttempt(value=>value+1);}}>{children}</AccessSession>;
}
