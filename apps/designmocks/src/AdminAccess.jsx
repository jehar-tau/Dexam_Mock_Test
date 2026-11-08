import React, {createContext,useContext,useLayoutEffect,useMemo,useRef,useState} from "react";
import {platform} from "./platform.js";
import {createAdminAccessScope} from "./admin-access.js";

const AdminServices=createContext(null);
export const useAdminServices=()=>useContext(AdminServices);
// Shared drawing and fictional previews also run outside the administrator desk.
export const useAdminFunctions=()=>useContext(AdminServices)?.functions??platform?.functions;

async function checkedRpc(name,args,signal){
  signal.throwIfAborted();
  const {data,error,status}=await platform.rpc(name,args).abortSignal(signal);
  signal.throwIfAborted();
  if(error)throw Object.assign(new Error(error.message),error,{status});
  return data;
}

function AccessSession({actorId,headingRef,children,onRetry}){
  const [access,setAccess]=useState({status:"checking",hadAccess:false}),[scope,setScope]=useState(null);
  const privateRoot=useRef(null),recoverFocus=useRef(false),lifetime=useRef(null);
  useLayoutEffect(()=>{
    const href=window.location.href,historyKey=window.history.state?.key;
    const current=()=>window.location.href===href&&window.history.state?.key===historyKey;
    const value=createAdminAccessScope({check:signal=>checkedRpc("is_dmocks_admin",undefined,signal),isCurrent:current,onChange:next=>{
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
  },[actorId]);
  useLayoutEffect(()=>{
    if(access.status==="checking"||access.status==="allowed"||!recoverFocus.current)return;
    recoverFocus.current=false;headingRef.current?.focus();
  },[access.status,headingRef]);
  const services=useMemo(()=>scope?{
    rpc:(name,args,signal)=>scope.run(activeSignal=>checkedRpc(name,args,activeSignal),signal),
    functions:{async invoke(name,options={}){
      try{return await scope.run(async signal=>{
        const result=await platform.functions.invoke(name,{...options,signal});
        if(result.error)throw result.error;
        return result;
      },options.signal);}catch(error){return{data:null,error};}
    }},
    assertCurrent:scope.assertCurrent,isCurrent:scope.isCurrent,
  }:null,[scope]);
  return <section aria-label="Administrator access" style={{minWidth:0}}>
    {access.status==="checking"&&<p role="status">Checking administrator access…</p>}
    {access.status==="denied"&&<p role="alert" className="error">{access.hadAccess?"Administrator access has ended. Private views were cleared.":"This account is not an administrator."}</p>}
    {access.status==="unavailable"&&<p role="alert" className="error">Administrator access could not be verified. Private views were cleared. Try again.</p>}
    {["denied","unavailable"].includes(access.status)&&<button type="button" className="button quiet" onClick={onRetry}>Check administrator access</button>}
    {access.status==="allowed"&&services&&<AdminServices.Provider value={services}>
      <div ref={privateRoot} style={{minWidth:0}}><button type="button" className="text-button" onClick={()=>void lifetime.current?.verify()}>Recheck administrator access</button>{children}</div>
    </AdminServices.Provider>}
  </section>;
}

export function AdminAccessBoundary({actorId,headingRef,children}){
  const [attempt,setAttempt]=useState(0);
  return <AccessSession key={attempt} actorId={actorId} headingRef={headingRef} onRetry={()=>setAttempt(value=>value+1)}>{children}</AccessSession>;
}
