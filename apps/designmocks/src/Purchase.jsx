import React,{useEffect,useRef,useState}from'react';
import{Link,useLocation}from'react-router-dom';
import{AccountAccessBoundary,useAccountServices}from'./AccountAccess.jsx';
import{createPurchaseFlow}from'./purchase.js';
import{termsVersion}from'./platform.js';
import{money,passPlans}from'./config.js';
import{DuoInvitePanel}from'./Plans.jsx';
import{Arrow}from'./Art.jsx';
import{environment}from'./environment.js';

function PurchaseSession({plan}){
 const services=useAccountServices(),flow=useRef(null),[state,setState]=useState({status:'checking',error:''}),[accepted,setAccepted]=useState(false);
 useEffect(()=>{const value=createPurchaseFlow({services,termsVersion,onChange:setState,expectedMode:environment.production?'live':'test'});flow.current=value;void value.refresh();return()=>{value.dispose();if(flow.current===value)flow.current=null;};},[services]);
 const busy=['checking','opening','checkout','verifying'].includes(state.status),canPay=state.status==='idle',price=passPlans[plan]?.price??passPlans.annual.price;
 return<>
  {!environment.production&&<p className="notice" role="status">Razorpay Test mode for approved acceptance testers. No live payment is taken.</p>}
  {state.status==='paid'?<><div className="success" role="status">Your pass is active. <Link to="/dashboard">Open your workspace →</Link></div><DuoInvitePanel rpc={services.rpc}/></>:<>
   <div className="inline-links">
    <Link to="/dashboard/mocks">View released papers</Link>
    <Link to="/refunds">Cancellation and refunds</Link>
   </div>
   <label className="terms-checkbox"><input type="checkbox" checked={accepted&&state.status!=='notices-changed'} disabled={!canPay} onChange={event=>setAccepted(event.target.checked)}/><span>I accept the <Link to="/terms">purchase terms</Link> and <Link to="/privacy">privacy notice</Link>.</span></label>
   <button type="button" className="button full" disabled={!canPay||!accepted} onClick={()=>void flow.current?.start(accepted,plan)}>
    {state.status==='verifying'?'Confirming your payment…':state.status==='opening'?'Opening Razorpay…':'Pay '+money(price)+' with Razorpay'}<Arrow/>
   </button>
  </>}
  {state.status==='checking'&&<p role="status">Checking your current pass…</p>}
  {state.status==='checkout'&&<p role="status">Complete or close the Razorpay window to continue.</p>}
  {state.status==='verifying'&&<p role="status">Waiting for the server to confirm your pass. A checkout message does not activate access.</p>}
  {state.status==='pending'&&<p role="status">Your payment is not confirmed here yet. Check your pass before trying another payment. If you paid and access remains inactive, <Link to="/contact">Contact support</Link>.</p>}
  {state.status==='paid'&&<p><Link to="/contact">Contact support</Link> with payment questions.</p>}
  {state.error&&<p className="error" role="alert">{state.error}</p>}
  {['paid','pending'].includes(state.status)&&<p><Link to="/account/purchases">Purchase history</Link></p>}
  {!busy&&state.status!=='notices-changed'&&<button type="button" className="button quiet" onClick={()=>void flow.current?.refresh()}>Check my pass</button>}
 </>;
}
export function Purchase({actorId,headingRef,plan='annual'}){
 const location=useLocation();
 return<AccountAccessBoundary key={actorId+':'+location.key} kind="purchase" actorId={actorId} headingRef={headingRef}><PurchaseSession plan={plan}/></AccountAccessBoundary>;
}
