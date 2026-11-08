// The SDK may read a changed token before its account event reaches the page.
// Verify the captured token, then pin it on the request rather than allowing a
// later SDK token lookup to send an earlier account's draft as somebody else.
export async function verifiedAccountToken(auth,actorId,signal){
 signal.throwIfAborted();const{data,error}=await auth.getSession();signal.throwIfAborted();if(error)throw error;
 const session=data?.session;if(session?.user?.id!==actorId||typeof session.access_token!=='string'||!session.access_token)return null;
 const token=session.access_token,{data:current,error:failure}=await auth.getUser(token);signal.throwIfAborted();if(failure)throw failure;
 return current.user?.id===actorId?token:null;
}

export function runForVerifiedAccount(scope,auth,actorId,operation,requestSignal){
 return scope.run(async signal=>{
  let token;try{token=await verifiedAccountToken(auth,actorId,signal);}catch(error){if(!signal.aborted&&scope.isCurrent())scope.invalidate();throw error;}
  if(!token){scope.invalidate();throw new Error('Account identity changed.');}
  signal.throwIfAborted();return operation(token,signal);
 },requestSignal);
}
export function authorizationHeaders(headers,token){
 const result=Object.fromEntries(Object.entries(headers??{}).filter(([key])=>key.toLowerCase()!=='authorization'));
 return{...result,Authorization:'Bearer '+token};
}
