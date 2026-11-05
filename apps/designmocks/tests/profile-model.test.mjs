import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCandidateProfile, validateCandidateProfile } from "../src/profileModel.mjs";

test("normalizes an Indian candidate profile without inventing verification", () => {
  assert.deepEqual(normalizeCandidateProfile({ displayName: "  Asha Rao ", phone: "+91 98765-43210", appearingYear: "2028", city: " Pune ", exams: ["nift","uceed","nift"] }), { displayName: "Asha Rao", phone: "+919876543210", appearingYear: 2028, city: "Pune", exams: ["nift","uceed"] });
});

test("accepts complete profile data and rejects invalid identity fields", () => {
  assert.equal(validateCandidateProfile({ displayName: "Asha Rao", phone: "+919876543210", appearingYear: 2028, city: "Pune", exams: ["uceed"] }).valid, true);
  const invalid = validateCandidateProfile({ displayName: "A", phone: "98765", appearingYear: 2050, city: "", exams: [] });
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), ["appearingYear","city","displayName","exams","phone"]);
});
