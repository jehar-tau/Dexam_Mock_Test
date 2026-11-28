import assert from "node:assert/strict";
import test from "node:test";
import { candidateProfileResponse, profileDetailsComplete, validateCandidateProfile } from "../src/profileModel.mjs";
import { profileGateAfterMs, profileGateDue, recordActiveTime } from "../src/profile-gate.mjs";
import { studentContactsCsv } from "../src/student-contacts.mjs";

const base = { displayName: "Asha Rao", phone: "+919876543210", phoneVerified: false, appearingYear: 2027, city: "Pune", exams: ["uceed"], completed: false };
const extended = { ...base, studyStage: "class_12", state: "Maharashtra", marketingConsent: false };

test("profiles from both backends are read, and completeness follows what the backend asks", () => {
  const old = candidateProfileResponse(base);
  assert.equal(old.extended, false);
  assert.equal(profileDetailsComplete(old), true);
  const newer = candidateProfileResponse(extended);
  assert.equal(newer.extended, true);
  assert.equal(profileDetailsComplete(newer), true);
  assert.equal(profileDetailsComplete(candidateProfileResponse({ ...extended, studyStage: null })), false);
  assert.equal(profileDetailsComplete(candidateProfileResponse({ ...base, phone: null })), false);
  assert.equal(profileDetailsComplete(candidateProfileResponse({})), false);
  assert.throws(() => candidateProfileResponse({ ...extended, state: "Atlantis" }), /Invalid profile response/);
  assert.throws(() => candidateProfileResponse({ ...extended, marketingConsent: "yes" }), /Invalid profile response/);
  assert.throws(() => candidateProfileResponse({ ...base, extra: 1 }), /Invalid profile response/);
  assert.deepEqual(Object.keys(validateCandidateProfile({ ...extended, studyStage: "", state: "" }, { extended: true }).errors).sort(), ["state", "studyStage"]);
  assert.equal(validateCandidateProfile({ ...extended, studyStage: "", state: "" }).valid, true);
});

test("the required step is due after ten minutes of visible use per account", () => {
  const data = new Map(), store = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(profileGateDue(store, "a"), false);
  let due = false;
  for (let elapsed = 0; elapsed < profileGateAfterMs; elapsed += 15000) due = recordActiveTime(store, "a", 15000);
  assert.equal(due, true);
  assert.equal(profileGateDue(store, "a"), true);
  assert.equal(profileGateDue(store, "b"), false);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(recordActiveTime(broken, "c", profileGateAfterMs), true);
});

test("the contacts CSV quotes text and neutralises spreadsheet formulas", () => {
  const csv = studentContactsCsv([{ name: '=HYPERLINK("x")', phone: "+919876543210", exams: ["uceed", "nid"], appearingYear: 2027,
    studyStage: "class_12", city: "Pune, MH", state: "Maharashtra", permissionSince: "2026-11-28T10:00:00Z" }]);
  const [header, row] = csv.trim().split("\r\n");
  assert.equal(header, "Name,Phone,Exams,Appearing year,Stage,City,State,Permission given");
  assert.ok(row.startsWith(`"'=HYPERLINK(""x"")",'+919876543210,UCEED NID,2027,class_12,"Pune, MH",Maharashtra,`));
  assert.equal(studentContactsCsv([]), "Name,Phone,Exams,Appearing year,Stage,City,State,Permission given\r\n");
});
