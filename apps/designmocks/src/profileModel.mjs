export const candidateExams = Object.freeze([
  ["uceed", "UCEED"], ["nid", "NID DAT"], ["nift", "NIFT"], ["ceed", "CEED"],
]);

// Owner's request, 28 Nov 2026: the profile also asks where the student is in school
// and which state they live in (migration 202611280200). A backend without that
// migration answers with the original fields only; `extended` marks the newer one.
export const studyStages = Object.freeze([
  ["class_11", "Class 11"], ["class_12", "Class 12"], ["after_class_12", "Finished Class 12 (gap year)"],
  ["college", "In college or graduated"], ["working", "Working"],
]);
export const indianStates = Object.freeze(["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Outside India"]);

export function normalizeCandidateProfile(value) {
  return {
    displayName: String(value.displayName || "").trim(),
    phone: String(value.phone || "").replace(/[\s()-]/g, ""),
    appearingYear: Number(value.appearingYear),
    city: String(value.city || "").trim(),
    exams: [...new Set(value.exams || [])].sort(),
    studyStage: String(value.studyStage || ""),
    state: String(value.state || ""),
    marketingConsent: value.marketingConsent === true,
  };
}

export function validateCandidateProfile(value, { extended = false } = {}) {
  const profile = normalizeCandidateProfile(value);
  const allowed = new Set(candidateExams.map(([key]) => key));
  const errors = {};
  if (profile.displayName.length < 2 || profile.displayName.length > 100) errors.displayName = "Enter your full name.";
  if (!/^\+[1-9][0-9]{7,14}$/.test(profile.phone)) errors.phone = "Use an international number, for example +919876543210.";
  if (!Number.isInteger(profile.appearingYear) || profile.appearingYear < 2026 || profile.appearingYear > 2040) errors.appearingYear = "Choose a valid appearing year.";
  if (profile.city.length < 2 || profile.city.length > 120) errors.city = "Enter your city.";
  if (!profile.exams.length || profile.exams.some((exam) => !allowed.has(exam))) errors.exams = "Choose at least one exam.";
  if (extended && !studyStages.some(([key]) => key === profile.studyStage)) errors.studyStage = "Choose where you are in your studies.";
  if (extended && !indianStates.includes(profile.state)) errors.state = "Choose your state.";
  return { profile, errors, valid: Object.keys(errors).length === 0 };
}

export function candidateProfileDefaults(){return{displayName:'',phone:'+91',appearingYear:Math.min(2040,Math.max(2026,new Date().getFullYear()+1)),city:'',exams:[],studyStage:'',state:'',marketingConsent:false};}
const baseKeys='appearingYear,city,completed,displayName,exams,phone,phoneVerified';
const extendedKeys='appearingYear,city,completed,displayName,exams,marketingConsent,phone,phoneVerified,state,studyStage';
export function candidateProfileResponse(value,expected,{extended:empty=false}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid profile response');
 if(Object.keys(value).length===0){if(expected)throw new Error('Unconfirmed profile save');return{values:candidateProfileDefaults(),phoneVerified:false,completed:false,extended:empty};}
 const keys=Object.keys(value).sort().join(','),extended=keys===extendedKeys;
 if(extended&&(value.studyStage!==null&&!studyStages.some(([key])=>key===value.studyStage)||value.state!==null&&!indianStates.includes(value.state)||typeof value.marketingConsent!=='boolean'))throw new Error('Invalid profile response');
 if(keys!==baseKeys&&!extended||typeof value.phoneVerified!=='boolean'||typeof value.completed!=='boolean'||
  !Array.isArray(value.exams)||value.exams.length>4||new Set(value.exams).size!==value.exams.length||value.exams.some(exam=>!candidateExams.some(([id])=>id===exam))||
  value.displayName!==null&&(typeof value.displayName!=='string'||Array.from(value.displayName).length<2||Array.from(value.displayName).length>100)||
  value.city!==null&&(typeof value.city!=='string'||Array.from(value.city).length<2||Array.from(value.city).length>120)||
  value.phone!==null&&(typeof value.phone!=='string'||!/^\+[1-9][0-9]{7,14}$/.test(value.phone))||
  value.appearingYear!==null&&(!Number.isInteger(value.appearingYear)||value.appearingYear<2026||value.appearingYear>2040))throw new Error('Invalid profile response');
 const defaults=candidateProfileDefaults(),values={...defaults,displayName:value.displayName??defaults.displayName,phone:value.phone??defaults.phone,appearingYear:value.appearingYear??defaults.appearingYear,city:value.city??defaults.city,exams:[...value.exams],
  ...(extended?{studyStage:value.studyStage??'',state:value.state??'',marketingConsent:value.marketingConsent}:{})};
 if(value.phoneVerified&&value.phone===null||value.completed&&(!value.phoneVerified||!validateCandidateProfile(values).valid))throw new Error('Invalid profile completion');
 const checked=extended?['displayName','phone','appearingYear','city','studyStage','state','marketingConsent']:['displayName','phone','appearingYear','city'];
 if(expected&&(!validateCandidateProfile(values,{extended}).valid||checked.some(key=>values[key]!==expected[key])||JSON.stringify([...values.exams].sort())!==JSON.stringify([...expected.exams].sort())))throw new Error('Unconfirmed profile save');
 return{values,phoneVerified:value.phoneVerified,completed:value.completed,extended};
}

// The details the site asks every student for (the required profile step).
export function profileDetailsComplete(response){
 return Boolean(response)&&validateCandidateProfile(response.values,{extended:response.extended}).valid;
}
export function candidateSaveFailure(error){
 if(['22023','23514','23502'].includes(error?.code)||error?.code==='P0001'&&error?.message==='Invalid candidate profile')return{uncertain:false,message:'Check your profile details, then try again.'};
 if(error?.code==='PGRST202')return{uncertain:false,message:'Profile updates are temporarily unavailable. Please try again later.'};
 return{uncertain:true,message:'Couldn’t confirm your saved profile. Reload your profile before saving again. Your earlier changes may already be saved.'};
}
