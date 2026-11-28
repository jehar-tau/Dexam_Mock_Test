import assert from "node:assert/strict";
import test from "node:test";
import { acceptNotice, ageConsentFor } from "../src/age-consent.mjs";
import { compilePublishedNotices } from "../scripts/published-notices.mjs";
import fixture from "./fixtures/fictional-published-notices.json" with { type: "json" };

const withEligibility = paragraph => compilePublishedNotices({ ...fixture, privacy: { ...fixture.privacy, youngerStudents: paragraph } }, { allowFixture: true });

test("the minimum age comes from the published eligibility text", () => {
  assert.equal(withEligibility("DMocks is for students aged 18 or older. By creating an account you confirm that you are at least 18 years old.").minimumAge, 18);
  assert.equal(withEligibility("DMocks is for students aged 16 or older. If you are under 18, a parent or guardian must agree first.").minimumAge, 16);
  assert.equal(withEligibility("Students of any age may read the sample before deciding to sign up.").minimumAge, 18);
  assert.equal(ageConsentFor(null).guardianConsent, false);
  assert.deepEqual(ageConsentFor({ minimumAge: 18 }).ageGroups, []);
  const sixteen = ageConsentFor(withEligibility("DMocks is for students aged 16 or older. If you are under 18, a parent or guardian must agree first."));
  assert.equal(sixteen.guardianConsent, true);
  assert.deepEqual(sixteen.ageGroups.map(group => group.value), ["18_plus", "16_17_guardian"]);
  assert.match(sixteen.ageGroups[1].label, /^I am 16 or 17, and a parent or guardian/);
});

test("the age group is sent only when the notice asks for it", async () => {
  const calls = [];
  const rpc = async (name, args) => { calls.push([name, args]); return { error: null }; };
  await acceptNotice(rpc, "v", { guardianConsent: false, ageGroup: "" });
  await acceptNotice(rpc, "v", { guardianConsent: true, ageGroup: "16_17_guardian" });
  assert.deepEqual(calls, [["accept_current_terms", { p_version: "v" }], ["accept_current_terms", { p_version: "v", p_age_group: "16_17_guardian" }]]);
  await assert.rejects(acceptNotice(rpc, "v", { guardianConsent: true, ageGroup: "" }), /Choose an age group/);
});

test("a backend without the age-group migration still records the acceptance", async () => {
  const calls = [];
  const rpc = async (name, args) => { calls.push(args); return args.p_age_group ? { error: { code: "PGRST202" } } : { error: null }; };
  assert.deepEqual(await acceptNotice(rpc, "v", { guardianConsent: true, ageGroup: "18_plus" }), { error: null });
  assert.deepEqual(calls, [{ p_version: "v", p_age_group: "18_plus" }, { p_version: "v" }]);
  const other = async () => ({ error: { code: "22023" } });
  assert.deepEqual(await acceptNotice(other, "v", { guardianConsent: true, ageGroup: "18_plus" }), { error: { code: "22023" } });
});
