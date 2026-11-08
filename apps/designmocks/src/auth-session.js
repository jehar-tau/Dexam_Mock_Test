export function observeAuthSession(auth,onChange,{timeoutMs=10000}={}){
 let alive=true,events=0,authoritative=false,initialClosed=false,timer;
 const publish=(session,authError='')=>{if(alive)onChange({session,loading:false,authError});};
 const{data}=auth.onAuthStateChange((event,session)=>{
  if(!alive||event==='INITIAL_SESSION'&&(authoritative||initialClosed))return;
  clearTimeout(timer);events++;if(event!=='INITIAL_SESSION')authoritative=true;publish(session);
 });
 if(events===0)timer=setTimeout(()=>{if(alive&&events===0){initialClosed=true;publish(null,'Could not check your session. Please refresh to try again.');}},timeoutMs);
 void Promise.resolve().then(()=>auth.getSession()).then(({data,error})=>{
  if(alive&&events===0&&!initialClosed){clearTimeout(timer);initialClosed=Boolean(error);publish(error?null:data.session,error?'Google sign-in could not be completed. Please try again.':'');}
 }).catch(()=>{if(alive&&events===0&&!initialClosed){clearTimeout(timer);initialClosed=true;publish(null,'Could not check your session. Please refresh to try again.');}});
 return()=>{alive=false;clearTimeout(timer);data.subscription.unsubscribe();};
}
