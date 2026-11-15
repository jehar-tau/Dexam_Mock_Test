import React, {createContext,useContext,useLayoutEffect,useMemo,useRef,useState} from "react";
import {platform} from "./platform.js";
import {createAdminAccessScope} from "./admin-access.js";
import {authorizationHeaders,runForVerifiedAccount,verifiedAccountToken}from'./account-identity.js';

const AdminServices=createContext(null);
export const useAdminServices=()=>useContext(AdminServices);
export const useStaffServices=useAdminServices;
export const useAdminFunctions=()=>useContext(AdminServices)?.functions;

const adminAccess=Object.freeze({region:"Administrator access",procedure:"is_dmocks_admin",checking:"Checking administrator access…",required:"This account is not an administrator.",
  ended:"Administrator access has ended. Private views were cleared.",unavailable:"Administrator access could not be verified. Private views were cleared. Try again.",check:"Check administrator access",recheck:"Recheck administrator access"});
const reviewerAccess=Object.freeze({region:"Drawing reviewer access",procedure:"can_review_drawings",checking:"Checking drawing reviewer access…",required:"Drawing reviewer access required.",
  ended:"Drawing reviewer access has ended. Private reviews were cleared.",unavailable:"Drawing reviewer access could not be verified. Private reviews were cleared. Try again.",check:"Check drawing reviewer access",recheck:"Recheck drawing reviewer access"});

async function checkedRpc(name,args,signal,token){
  signal.throwIfAborted();
  const {data,error,status}=await platform.rpc(name,args).setHeader('Authorization','Bearer '+token).abortSignal(signal);
  signal.throwIfAborted();
  if(error)throw Object.assign(new Error(error.message),error,{status});
  return data;
}

function AccessSession({actorId,headingRef,children,onRetry,config}){
  const [access,setAccess]=useState({status:"checking",hadAccess:false}),[scope,setScope]=useState(null);
  const privateRoot=useRef(null),recoverFocus=useRef(false),lifetime=useRef(null);
  useLayoutEffect(()=>{
    const href=window.location.href,historyKey=window.history.state?.key;
    const current=()=>window.location.href===href&&window.history.state?.key===historyKey;
    const value=createAdminAccessScope({check:async signal=>{
      const token=await verifiedAccountToken(platform.auth,actorId,signal);if(!token)return false;
      return checkedRpc(config.procedure,undefined,signal,token);
    },isCurrent:current,onChange:next=>{
      if(next.status!=="allowed")recoverFocus.current=document.activeElement===document.body||Boolean(privateRoot.current?.contains(document.activeElement));
      setAccess(next);
    }});
    lifetime.current=value;setScope(value);void value.verify();
    // Auth callbacks only invalidate synchronously; never await another SDK call
    // inside this callback. Abort old-account downloads before React cleanup.
    const {data}=platform.auth.onAuthStateChange((_event,next)=>{if(next?.user?.id!==actorId)value.invalidate();});
    const visible=()=>{if(document.visibilityState==="visible")void value.verify();};
    const restored=()=>void value.verify();
    window.addEventListener("focus",visible);window.addEventListener("pageshow",restored);document.addEventListener("visibilitychange",visible);
    const timer=setInterval(visible,60000);
    return()=>{value.dispose();data.subscription.unsubscribe();clearInterval(timer);window.removeEventListener("focus",visible);window.removeEventListener("pageshow",restored);document.removeEventListener("visibilitychange",visible);};
  },[actorId,config]);
  useLayoutEffect(()=>{
    if(access.status==="checking"||access.status==="allowed"||!recoverFocus.current)return;
    recoverFocus.current=false;headingRef.current?.focus();
  },[access.status,headingRef]);
  const services=useMemo(()=>scope?{
    rpc:(name,args,signal)=>runForVerifiedAccount(scope,platform.auth,actorId,(token,active)=>checkedRpc(name,args,active,token),signal),
    withVerifiedRpc:(operation,requestSignal)=>runForVerifiedAccount(scope,platform.auth,actorId,
      (token,signal)=>operation((name,args)=>checkedRpc(name,args,signal,token)),requestSignal),
    presentForCurrentStaff:(operation,requestSignal)=>runForVerifiedAccount(scope,platform.auth,actorId,async(token,signal)=>{
      if(await checkedRpc(config.procedure,undefined,signal,token)!==true){
        throw Object.assign(new Error('Staff access required'),{code:'42501'});
      }
      const{data,error}=await platform.auth.getSession();
      signal.throwIfAborted();scope.assertCurrent();
      if(error||data?.session?.user?.id!==actorId||data?.session?.access_token!==token){
        scope.invalidate();throw new Error('Account identity changed.');
      }
      return operation();
    },requestSignal),
    functions:{async invoke(name,options={}){
      try{return await runForVerifiedAccount(scope,platform.auth,actorId,async(token,signal)=>{
        const result=await platform.functions.invoke(name,{...options,signal,headers:authorizationHeaders(options.headers,token)});
        if(result.error)throw result.error;
        return result;
      },options.signal);}catch(error){return{data:null,error};}
    }},
    assertCurrent:scope.assertCurrent,isCurrent:scope.isCurrent,
  }:null,[scope,actorId,config]);
  return <section aria-label={config.region} style={{minWidth:0}}>
    {access.status==="checking"&&<p role="status">{config.checking}</p>}
    {access.status==="denied"&&<p role="alert" className="error">{access.hadAccess?config.ended:config.required}</p>}
    {access.status==="unavailable"&&<p role="alert" className="error">{config.unavailable}</p>}
    {["denied","unavailable"].includes(access.status)&&<button type="button" className="button quiet" onClick={onRetry}>{config.check}</button>}
    {access.status==="allowed"&&services&&<AdminServices.Provider value={services}>
      <div ref={privateRoot} style={{minWidth:0}}><button type="button" className="text-button" onClick={()=>void lifetime.current?.verify()}>{config.recheck}</button>{children}</div>
    </AdminServices.Provider>}
  </section>;
}

function StaffAccessBoundary({actorId,headingRef,children,config}){
  const [attempt,setAttempt]=useState(0);
  return <AccessSession key={attempt} actorId={actorId} headingRef={headingRef} config={config} onRetry={()=>{headingRef.current?.focus();setAttempt(value=>value+1);}}>{children}</AccessSession>;
}
export const AdminAccessBoundary=props=><StaffAccessBoundary {...props} config={adminAccess}/>;
export const DrawingReviewerAccessBoundary=props=><StaffAccessBoundary {...props} config={reviewerAccess}/>;
