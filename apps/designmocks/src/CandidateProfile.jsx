import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platform } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { candidateExams, validateCandidateProfile } from "./profileModel.mjs";

export function CandidateProfileForm({ initial = {}, onSave, preview = false }) {
  const [value, setValue] = useState({ displayName: "", phone: "+91", appearingYear: new Date().getFullYear() + 1, city: "", exams: [], ...initial });
  const [errors, setErrors] = useState({}), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const change = (field, next) => setValue((current) => ({ ...current, [field]: next }));
  const submit = async (event) => {
    event.preventDefault(); const result = validateCandidateProfile(value); setErrors(result.errors); setMessage(""); if (!result.valid) return;
    setBusy(true); try { await onSave(result.profile); setValue((current) => ({ ...current, ...result.profile })); setMessage(preview ? "Preview profile saved for this session." : "Profile saved. Phone verification is still required."); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <form className="candidate-profile-form" onSubmit={submit} noValidate><label>Student name<input value={value.displayName} onChange={(e) => change("displayName",e.target.value)} autoComplete="name"/>{errors.displayName && <span>{errors.displayName}</span>}</label><label>Phone number<input value={value.phone} onChange={(e) => change("phone",e.target.value)} inputMode="tel" autoComplete="tel" aria-describedby="phone-note"/>{errors.phone && <span>{errors.phone}</span>}<small id="phone-note">Include +91 for an Indian number. Saving does not verify it.</small></label><label>Appearing year<select value={value.appearingYear} onChange={(e) => change("appearingYear",e.target.value)}>{Array.from({length: 15},(_,i)=>2026+i).map((year)=><option key={year}>{year}</option>)}</select>{errors.appearingYear && <span>{errors.appearingYear}</span>}</label><label>City<input value={value.city} onChange={(e) => change("city",e.target.value)} autoComplete="address-level2"/>{errors.city && <span>{errors.city}</span>}</label><fieldset><legend>Exams you are preparing for</legend>{candidateExams.map(([key,label])=><label className="profile-check" key={key}><input type="checkbox" checked={value.exams.includes(key)} onChange={(e)=>change("exams",e.target.checked?[...value.exams,key]:value.exams.filter((exam)=>exam!==key))}/>{label}</label>)}{errors.exams && <span>{errors.exams}</span>}</fieldset><button className="button" disabled={busy}>{busy?"Saving…":"Save profile"}</button>{message && <p role="status">{message}</p>}</form>;
}

export function CandidateProfile() {
  const { session, loading } = useAuthState(); const [profile,setProfile]=useState(null), [error,setError]=useState("");
  useEffect(()=>{ if(session&&platform) platform.rpc("my_candidate_profile").then(({data,error})=>error?setError(error.message):setProfile(data)); },[session]);
  if (loading) return <section className="wrap section"><p role="status">Checking your account…</p></section>;
  if (!session) return <section className="wrap section"><h1>Sign in to set up your profile<em>.</em></h1><Link className="button" to="/account">Student sign in</Link></section>;
  const save=async(value)=>{ const {data,error}=await platform.rpc("save_candidate_profile",{p_display_name:value.displayName,p_phone:value.phone,p_appearing_year:value.appearingYear,p_city:value.city,p_exams:value.exams}); if(error) throw error; setProfile(data); };
  return <section className="wrap section candidate-profile"><span className="eyebrow">YOUR DETAILS</span><h1>Set up your <em>profile.</em></h1><p>These details personalise papers and cohort results. Your phone remains unverified until the OTP service confirms it.</p>{error&&<p className="error" role="alert">{error}</p>}{profile!==null&&<CandidateProfileForm initial={profile} onSave={save}/>}</section>;
}

export function CandidateProfilePreview(){ return <section className="wrap section candidate-profile"><span className="eyebrow">PROFILE PREVIEW</span><h1>Set up your <em>profile.</em></h1><CandidateProfileForm preview onSave={async()=>{}}/></section>; }
