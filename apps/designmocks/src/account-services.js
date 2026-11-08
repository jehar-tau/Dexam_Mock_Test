import{isAdminAccessFailure}from'./admin-access.js';
import{authorizationHeaders,runForVerifiedAccount}from'./account-identity.js';

export function createAccountServices(scope,client,actorId,{targetDenials=false}={}){
 return Object.freeze({isCurrent:scope.isCurrent,assertCurrent:scope.assertCurrent,
  rpc:(name,args,signal)=>runForVerifiedAccount(scope,client.auth,actorId,async(token,active)=>{
   active.throwIfAborted();const{data,error,status}=await client.rpc(name,args).setHeader('Authorization','Bearer '+token).abortSignal(active);active.throwIfAborted();
   if(error){const failure=Object.assign(new Error(error.message),error,{status});if(!targetDenials&&isAdminAccessFailure(failure))scope.invalidate();throw failure;}return data;
  },signal),
  functions:Object.freeze({async invoke(name,options={}){
   try{return await runForVerifiedAccount(scope,client.auth,actorId,async(token,signal)=>{
    const result=await client.functions.invoke(name,{...options,signal,headers:authorizationHeaders(options.headers,token)});if(result.error)throw result.error;return result;
   },options.signal);}catch(error){if(!targetDenials&&isAdminAccessFailure(error))scope.invalidate();return{data:null,error};}
  }}),
 });
}
