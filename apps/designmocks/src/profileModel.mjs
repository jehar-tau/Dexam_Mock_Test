export const candidateExams = Object.freeze([
  ["uceed", "UCEED"], ["nid", "NID DAT"], ["nift", "NIFT"], ["ceed", "CEED"],
]);

export function normalizeCandidateProfile(value) {
  return {
    displayName: String(value.displayName || "").trim(),
    phone: String(value.phone || "").replace(/[\s()-]/g, ""),
    appearingYear: Number(value.appearingYear),
    city: String(value.city || "").trim(),
    exams: [...new Set(value.exams || [])].sort(),
  };
}

export function validateCandidateProfile(value) {
  const profile = normalizeCandidateProfile(value);
  const allowed = new Set(candidateExams.map(([key]) => key));
  const errors = {};
  if (profile.displayName.length < 2 || profile.displayName.length > 100) errors.displayName = "Enter your full name.";
  if (!/^\+[1-9][0-9]{7,14}$/.test(profile.phone)) errors.phone = "Use an international number, for example +919876543210.";
  if (!Number.isInteger(profile.appearingYear) || profile.appearingYear < 2026 || profile.appearingYear > 2040) errors.appearingYear = "Choose a valid appearing year.";
  if (profile.city.length < 2 || profile.city.length > 120) errors.city = "Enter your city.";
  if (!profile.exams.length || profile.exams.some((exam) => !allowed.has(exam))) errors.exams = "Choose at least one exam.";
  return { profile, errors, valid: Object.keys(errors).length === 0 };
}

export function candidateProfileDefaults(){return{displayName:'',phone:'+91',appearingYear:Math.min(2040,Math.max(2026,new Date().getFullYear()+1)),city:'',exams:[]};}
export function candidateProfileResponse(value,expected){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid profile response');
 if(Object.keys(value).length===0){if(expected)throw new Error('Unconfirmed profile save');return{values:candidateProfileDefaults(),phoneVerified:false,completed:false};}
 const keys='appearingYear,city,completed,displayName,exams,phone,phoneVerified';
 if(Object.keys(value).sort().join(',')!==keys||typeof value.phoneVerified!=='boolean'||typeof value.completed!=='boolean'||
  !Array.isArray(value.exams)||value.exams.length>4||new Set(value.exams).size!==value.exams.length||value.exams.some(exam=>!candidateExams.some(([id])=>id===exam))||
  value.displayName!==null&&(typeof value.displayName!=='string'||Array.from(value.displayName).length<2||Array.from(value.displayName).length>100)||
  value.city!==null&&(typeof value.city!=='string'||Array.from(value.city).length<2||Array.from(value.city).length>120)||
  value.phone!==null&&(typeof value.phone!=='string'||!/^\+[1-9][0-9]{7,14}$/.test(value.phone))||
  value.appearingYear!==null&&(!Number.isInteger(value.appearingYear)||value.appearingYear<2026||value.appearingYear>2040))throw new Error('Invalid profile response');
 const defaults=candidateProfileDefaults(),values={...defaults,displayName:value.displayName??defaults.displayName,phone:value.phone??defaults.phone,appearingYear:value.appearingYear??defaults.appearingYear,city:value.city??defaults.city,exams:[...value.exams]};
 if(value.phoneVerified&&value.phone===null||value.completed&&(!value.phoneVerified||!validateCandidateProfile(values).valid))throw new Error('Invalid profile completion');
 if(expected&&(!validateCandidateProfile(values).valid||['displayName','phone','appearingYear','city'].some(key=>values[key]!==expected[key])||JSON.stringify([...values.exams].sort())!==JSON.stringify([...expected.exams].sort())))throw new Error('Unconfirmed profile save');
 return{values,phoneVerified:value.phoneVerified,completed:value.completed};
}
export function candidateSaveFailure(error){
 if(['22023','23514','23502'].includes(error?.code)||error?.code==='P0001'&&error?.message==='Invalid candidate profile')return{uncertain:false,message:'Check your profile details, then try again.'};
 if(error?.code==='PGRST202')return{uncertain:false,message:'Profile updates are temporarily unavailable. Please try again later.'};
 return{uncertain:true,message:'Couldn’t confirm your saved profile. Reload your profile before saving again. Your earlier changes may already be saved.'};
}
