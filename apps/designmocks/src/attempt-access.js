import {verifiedAccountToken,authorizationHeaders} from './account-identity.js';
import {withAccountDeadline} from './account-request.js';
import {questionReportFailure} from './question-quality.js';

const ended=()=>Object.assign(new Error('Attempt access ended.'),{name:'AbortError',code:'attempt_access_ended'});
const unavailable=()=>Object.assign(new Error('Could not verify your exam account. Reconnect and try again.'),{code:'attempt_identity_unavailable'});
function identityEnded(error){
 return [401,403].includes(error?.status)||['AuthSessionMissingError','AuthInvalidTokenResponseError'].includes(error?.name)||
  ['session_not_found','user_not_found','bad_jwt','refresh_token_not_found','refresh_token_already_used'].includes(error?.code);
}

// A trusted, already opened paper can remain usable during an Auth outage. No
// server request is sent without fresh verification; confirmed identity loss
// permanently closes this scope. The original actor's device journal survives.
export function createAttemptAccessScope({auth,actorId,isCurrent=()=>true,onChange=()=>{},verificationTimeoutMs=10000}){
 const controller=new AbortController();let disposed=false,status='checking',hadAccess=false,verification=0;
 const current=()=>!disposed&&!controller.signal.aborted&&isCurrent();
 const snapshot=()=>({status,hadAccess});
 function assertCurrent(){if(!current())throw ended();}
 function publish(next){if(!current())return;status=next;onChange(snapshot());}
 function invalidate(){if(!current())return;status='denied';controller.abort();onChange(snapshot());}
 async function identity(signal,sequence,confirmSession=false){
  assertCurrent();let token;
  try{
   token=await verifiedAccountToken(auth,actorId,signal);
   if(token&&confirmSession){
    const{data,error}=await auth.getSession();
    signal.throwIfAborted();assertCurrent();
    if(error)throw error;
    const session=data?.session;
    if(session?.user?.id!==actorId)token=null;
    else if(session.access_token!==token)throw unavailable();
   }
  }
  catch(error){if(!current()||signal.aborted)throw error;if(identityEnded(error))invalidate();else if(sequence===verification)publish(hadAccess?'waiting':'unavailable');throw unavailable();}
  assertCurrent();signal.throwIfAborted();
  if(!token){invalidate();throw ended();}
  if(sequence===verification){hadAccess=true;publish('allowed');}return token;
 }
 async function run(operation, requestSignal, { milliseconds = 20000, recheckIdentity = false } = {}) {
  assertCurrent();const sequence=++verification,signal=requestSignal?AbortSignal.any([controller.signal,requestSignal]):controller.signal;
  try{return await withAccountDeadline(async active=>{
   const token=await identity(active,sequence);active.throwIfAborted();assertCurrent();
   const value = await operation(token, active);
   if (recheckIdentity) await identity(active, sequence, true);
   active.throwIfAborted();assertCurrent();return value;
  },signal,milliseconds);}
  catch(error){
   if(!current())throw ended();
   if(sequence===verification&&!requestSignal?.aborted&&(error?.name==='TimeoutError'||error?.name==='AbortError'))publish(hadAccess?'waiting':'unavailable');
   throw error;
  }
 }
 async function verify(){try{await run(()=>true,undefined,{milliseconds:verificationTimeoutMs});return true;}catch{return false;}}
 return Object.freeze({run,verify,invalidate,assertCurrent,isCurrent:current,snapshot,signal:controller.signal,dispose(){disposed=true;controller.abort();}});
}

export function createAttemptServices(scope,client){
 const verifiedRpc=(name,args,signal)=>scope.run(async(token,active)=>{
  const{data,error,status}=await client.rpc(name,args).setHeader('Authorization','Bearer '+token).abortSignal(active);
  if(error){
   const reportFailure=name==='report_attempt_question'?questionReportFailure(error):null;
   if(reportFailure)return{reportFailure};
   throw Object.assign(new Error('Could not confirm this exam request.'),{code:error.code,status});
  }
  return{data,receivedAt:Date.now()};
 },signal,{recheckIdentity:true});
 return Object.freeze({isCurrent:scope.isCurrent,signal:scope.signal,
  async rpc(name,args,signal){
   const result=await verifiedRpc(name,args,signal);
   if(result.reportFailure==='duplicate')return {alreadyReported:true};
   if(result.reportFailure==='limited')throw Object.assign(new Error('Question report limit reached.'),{code:'question_report_limit'});
   return result.data;
  },
  readAttempt:(id,signal)=>verifiedRpc('read_attempt',{p_id:id},signal),
  functions:Object.freeze({async invoke(name,options={}){
   try{return await scope.run(async(token,signal)=>{
    const result=await client.functions.invoke(name,{...options,signal,headers:authorizationHeaders(options.headers,token)});if(result.error)throw result.error;return result;
   }, options.signal, {
    milliseconds: options.body instanceof FormData ? 60000 : 20000,
    // Successful replies can contain private signed links or drawing page state.
    recheckIdentity: true,
   });}catch(error){return{data:null,error};}
  }}),
 });
}
