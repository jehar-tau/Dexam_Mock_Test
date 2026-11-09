import React,{useEffect,useId,useLayoutEffect,useRef,useState}from'react';
import {Link,useLocation}from'react-router-dom';
import {useAuthState}from'./useAuth.js';
import {AccountAccessBoundary,useAccountServices}from'./AccountAccess.jsx';
import {candidateExams,candidateProfileDefaults,candidateProfileResponse,candidateSaveFailure,normalizeCandidateProfile,validateCandidateProfile}from'./profileModel.mjs';

export function CandidateProfileForm({initial={},initialPhoneVerified=false,onSave,preview=false}){
 const[value,setValue]=useState(()=>({...candidateProfileDefaults(),...initial,exams:[...(initial.exams??[])]}));
 const[savedPhone,setSavedPhone]=useState(()=>({number:initial.phone,verified:initialPhoneVerified}));
 const[errors,setErrors]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const prefix=useId(),lifetime=useRef(null),action=useRef(null),fields=useRef({}),invalidFocus=useRef(false);
 useLayoutEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();action.current?.abort();};},[]);
 useLayoutEffect(()=>{if(invalidFocus.current){invalidFocus.current=false;fields.current[Object.keys(errors)[0]]?.focus();}},[errors]);
 const change=(field,next)=>setValue(current=>({...current,[field]:next}));
 const submit=async event=>{
  event.preventDefault();if(action.current||uncertain||lifetime.current.signal.aborted)return;
  const result=validateCandidateProfile(value);setErrors(result.errors);setMessage('');if(!result.valid){invalidFocus.current=true;return;}
  const snapshot=Object.freeze({...result.profile,exams:Object.freeze([...result.profile.exams])}),controller=new AbortController();action.current=controller;setBusy(true);
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000),signal=AbortSignal.any([controller.signal,lifetime.current.signal,timeout.signal]);
  const current=()=>!controller.signal.aborted&&!lifetime.current.signal.aborted&&action.current===controller;
  try{
   const saved=await onSave(snapshot,{signal});signal.throwIfAborted();if(!current())return;
   setValue({...snapshot,exams:[...snapshot.exams]});
   if(!preview)setSavedPhone({number:saved.values.phone,verified:saved.phoneVerified});
   setMessage(preview?'Preview profile saved for this session.':'Profile saved.');
  }catch(error){if(current()){const failure=candidateSaveFailure(error);setUncertain(failure.uncertain);setMessage(failure.message);}}
  finally{clearTimeout(timer);if(action.current===controller){action.current=null;if(!lifetime.current.signal.aborted)setBusy(false);}}
 };
 const locked=busy||uncertain;
 let phoneNote='Include +91 for an Indian number.';
 if(!preview){
  if(uncertain)phoneNote='Reload your profile to confirm the saved phone status.';
  else if(!savedPhone.verified)phoneNote='Include +91 for an Indian number. Phone verification is currently unavailable in this workspace.';
  else if(normalizeCandidateProfile(value).phone===savedPhone.number)phoneNote='Your saved phone number is verified.';
  else phoneNote='Saving a different number clears the previous phone verification.';
 }
 const attributes=field=>({ref:node=>{fields.current[field]=node;},'aria-invalid':Boolean(errors[field]),'aria-describedby':errors[field]?prefix+'-'+field+'-error':undefined});
 const error=field=>errors[field]&&<span className="profile-error" id={prefix+'-'+field+'-error'}>{errors[field]}</span>;
 return<form className="candidate-profile-form" onSubmit={submit} noValidate>
  <div className="profile-field"><label htmlFor={prefix+'-name'}>Student name</label><input id={prefix+'-name'} {...attributes('displayName')} value={value.displayName} onChange={event=>change('displayName',event.target.value)} autoComplete="name" disabled={locked}/>{error('displayName')}</div>
  <div className="profile-field"><label htmlFor={prefix+'-phone'}>Phone number</label><input id={prefix+'-phone'} {...attributes('phone')} aria-describedby={[errors.phone?prefix+'-phone-error':null,prefix+'-phone-note'].filter(Boolean).join(' ')} value={value.phone} onChange={event=>change('phone',event.target.value)} inputMode="tel" autoComplete="tel" disabled={locked}/>{error('phone')}<small id={prefix+'-phone-note'}>{phoneNote}</small></div>
  <div className="profile-field"><label htmlFor={prefix+'-year'}>Appearing year</label><select id={prefix+'-year'} {...attributes('appearingYear')} value={value.appearingYear} onChange={event=>change('appearingYear',event.target.value)} disabled={locked}>{Array.from({length:15},(_,n)=>2026+n).map(year=><option key={year}>{year}</option>)}</select>{error('appearingYear')}</div>
  <div className="profile-field"><label htmlFor={prefix+'-city'}>City</label><input id={prefix+'-city'} {...attributes('city')} value={value.city} onChange={event=>change('city',event.target.value)} autoComplete="address-level2" disabled={locked}/>{error('city')}</div>
  <fieldset aria-describedby={errors.exams?prefix+'-exams-error':undefined} disabled={locked}><legend>Exams you are preparing for</legend>{candidateExams.map(([id,label],index)=><label className="profile-check" key={id}><input ref={index===0?node=>{fields.current.exams=node;}:undefined} type="checkbox" checked={value.exams.includes(id)} onChange={event=>change('exams',event.target.checked?[...value.exams,id]:value.exams.filter(exam=>exam!==id))}/>{label}</label>)}{error('exams')}</fieldset>
  <button className="button" disabled={locked}>{busy?'Saving…':'Save profile'}</button>{message&&<p role="status">{message}</p>}
 </form>;
}
function ProfileSession(){
 const{rpc,isCurrent}=useAccountServices(),[profile,setProfile]=useState(null),[reading,setReading]=useState(false),[error,setError]=useState(''),[generation,setGeneration]=useState(0);
 const lifetime=useRef(null),request=useRef(null);
 useLayoutEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();request.current?.abort();};},[]);
 const load=async()=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;setProfile(null);setReading(true);setError('');
  const timer=setTimeout(()=>controller.abort(),20000),current=()=>!lifetime.current.signal.aborted&&request.current===controller&&isCurrent();
  try{const next=candidateProfileResponse(await rpc('my_candidate_profile',{},AbortSignal.any([lifetime.current.signal,controller.signal])));if(current()){setProfile(next);setGeneration(value=>value+1);}}
  catch{if(current())setError('Couldn’t load your profile. Reload your profile to try again.');}
  finally{clearTimeout(timer);if(current()){request.current=null;setReading(false);}}
 };
 useEffect(()=>{void load();},[rpc]);
 const save=async(value,{signal})=>candidateProfileResponse(await rpc('save_candidate_profile',{p_display_name:value.displayName,p_phone:value.phone,p_appearing_year:value.appearingYear,p_city:value.city,p_exams:value.exams},signal),value);
 return<><p>These details personalise papers and cohort results.</p>
  <button type="button" className="button quiet" onClick={()=>void load()}>Reload profile</button><p>Reloading replaces the current draft with saved details.</p>
  {reading&&<p role="status">Loading your profile…</p>}{error&&<p role="alert" className="error">{error}</p>}
  {profile&&<CandidateProfileForm key={generation} initial={profile.values} initialPhoneVerified={profile.phoneVerified} onSave={save}/>}</>;
}
export function CandidateProfile(){
 const{session,loading}=useAuthState(),location=useLocation(),heading=useRef(null),scopeKey=(session?.user.id??'signed-out')+':'+location.key,previous=useRef(scopeKey);
 useLayoutEffect(()=>{if(previous.current!==scopeKey&&(document.activeElement===document.body||heading.current?.parentElement.contains(document.activeElement)))heading.current?.focus();previous.current=scopeKey;},[scopeKey]);
 return<section className="wrap section candidate-profile"><span className="eyebrow">YOUR DETAILS</span><h1 ref={heading} tabIndex={-1}>Set up your <em>profile.</em></h1>
  {loading?<p role="status">Checking your account…</p>:!session?<p>Please <Link to="/account">sign in</Link> to set up your profile.</p>:<AccountAccessBoundary key={session.user.id+':'+location.key} actorId={session.user.id} headingRef={heading} kind="profile"><ProfileSession/></AccountAccessBoundary>}
 </section>;
}
export function CandidateProfilePreview(){return<section className="wrap section candidate-profile"><span className="eyebrow">PROFILE PREVIEW</span><h1>Set up your <em>profile.</em></h1><CandidateProfileForm preview onSave={async()=>{}}/></section>;}
