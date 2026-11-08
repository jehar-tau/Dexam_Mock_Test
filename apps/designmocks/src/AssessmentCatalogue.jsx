import React,{useEffect,useLayoutEffect,useRef,useState}from'react';
import{Link,useLocation,useNavigate}from'react-router-dom';
import{useAuthState}from'./useAuth.js';
import{PortalShell}from'./PortalShell.jsx';
import{AccountAccessBoundary,useAccountServices}from'./AccountAccess.jsx';
import{withAccountDeadline}from'./account-request.js';
import{overviewStartId}from'./overview-data.js';
import{catalogueInput,catalogueSpec,catalogueStartFailure,savedCatalogueAttempts,validateCatalogue}from'./catalogue-data.js';

function CatalogueSession({kind,View,viewProps,headingRef}){
 const services=useAccountServices(),navigate=useNavigate(),spec=catalogueSpec(kind),scope=useRef(null),read=useRef(null),inFlight=useRef(false),inspectSaved=useRef(false);
 const[catalog,setCatalog]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false),[saved,setSaved]=useState([]);
 const current=()=>Boolean(scope.current&&!scope.current.signal.aborted&&services.isCurrent());
 async function load(){
  if(!current()||inFlight.current)return;read.current?.abort();const request=new AbortController();read.current=request;const signal=AbortSignal.any([scope.current.signal,request.signal]),active=()=>current()&&!request.signal.aborted&&read.current===request;
  setCatalog(null);setSaved([]);setError('');setLoading(true);
  try{const value=await withAccountDeadline(async active=>{const rows=validateCatalogue(kind,await services.rpc(spec.read,undefined,active));const attempts=inspectSaved.current?savedCatalogueAttempts(await services.rpc('my_attempt_history',undefined,active)):[];return{rows,attempts};},signal);if(active()){setCatalog(value.rows);setSaved(value.attempts);setUnknown(false);}}
  catch{if(active())setError('Couldn’t load these mock choices. Refresh them to try again.');}
  finally{if(active())setLoading(false);}
 }
 useEffect(()=>{const controller=new AbortController();scope.current=controller;void load();return()=>{controller.abort();read.current?.abort();};},[]);
 async function start(selection){
  if(!current()||inFlight.current||loading||unknown||!catalog)return;
  const input=catalogueInput(kind,catalog,selection),address=window.location.href,historyKey=window.history.state?.key;inFlight.current=true;setBusy(true);
  try{const attempt=await withAccountDeadline(async signal=>{const value=overviewStartId(await services.rpc(spec.start,input,signal));await services.checkIdentity(signal);return value;},scope.current.signal);if(current()&&window.location.href===address&&window.history.state?.key===historyKey)navigate('/attempt/'+attempt);}
  catch(error){if(current()){const failure=catalogueStartFailure(error);if(!failure.definitive){inspectSaved.current=true;setUnknown(true);}throw new Error(failure.message);}}
  finally{inFlight.current=false;if(current())setBusy(false);}
 }
 return<>
  {loading&&<p role="status">Loading your mock choices…</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  <button type="button" className="button quiet" disabled={loading||busy} onClick={()=>{headingRef.current?.focus();void load();}}>{spec.refresh}</button>
  {unknown&&<p className="notice">This attempt may already be saved. Refresh these choices to check your active attempts.</p>}
  {saved.length>0&&<section aria-label="Saved active attempts"><h2>Your saved active attempts.</h2><ul>{saved.map(item=><li key={item.id}><Link to={'/attempt/'+item.id}>{item.title}</Link></li>)}</ul></section>}
  {(unknown||saved.length>0)&&<p><Link to="/dashboard">Check all your saved attempts →</Link></p>}
  {catalog&&<View {...viewProps} heading={false} embedded blocked={unknown||busy} onStart={start} {...(kind==='allIndia'?{events:catalog}:{catalog})}/>}
 </>;
}
export function AssessmentCatalogue({kind,View,Heading,viewProps={}}){
 const{session,loading}=useAuthState(),location=useLocation(),heading=useRef(null),key=JSON.stringify([kind,session?.user.id,location.key,location.search]),previous=useRef(key),spec=catalogueSpec(kind);
 useLayoutEffect(()=>{if(previous.current!==key&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=key;},[key]);
 if(loading)return<section className="wrap section"><p role="status">Checking your account…</p></section>;
 if(!session)return<section className="wrap section"><h1>{spec.signIn}<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;
 return<PortalShell><section className={'section portal-module '+spec.className}><Heading headingRef={heading}/><AccountAccessBoundary key={key} kind="catalogue" actorId={session.user.id} headingRef={heading}><CatalogueSession kind={kind} View={View} viewProps={viewProps} headingRef={heading}/></AccountAccessBoundary></section></PortalShell>;
}
