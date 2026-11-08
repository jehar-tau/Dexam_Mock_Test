// Auth promises do not all accept AbortSignal. Settle the caller at its deadline
// and check cancellation before work starts; a late provider result is ignored.
export async function awaitAccountRequest(operation,signal){
 signal.throwIfAborted();let abort;
 const interrupted=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});});
 try{return await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return operation();}),interrupted]);}
 finally{signal.removeEventListener('abort',abort);}
}
export async function withAccountDeadline(operation,parentSignal,milliseconds=20000){
 const deadline=new AbortController(),signal=parentSignal?AbortSignal.any([parentSignal,deadline.signal]):deadline.signal,timer=setTimeout(()=>deadline.abort(),milliseconds);
 try{return await awaitAccountRequest(()=>operation(signal),signal);}finally{clearTimeout(timer);}
}
