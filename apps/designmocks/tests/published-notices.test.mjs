import assert from "node:assert/strict";
import { test } from "node:test";
import fixture from "./fixtures/fictional-published-notices.json" with { type: "json" };
import { compilePublishedNotices, readPublishedNotices } from "../scripts/published-notices.mjs";

const released = { ...fixture, scope: "release" };

test("the dedicated refunds page uses the cancellation text from the approved terms", () => {
  const { pages } = compilePublishedNotices(released);
  const refundNotice = pages.terms.find(({ heading }) => heading === "Cancellation and refunds");
  assert.equal(refundNotice.paragraph, released.terms.refunds.trim());
  assert.deepEqual(pages.refunds, [refundNotice]);
});

test("the notice version identifies the exact approved text, offer and operator details", () => {
  const first = compilePublishedNotices(released);
  assert.match(first.version, /^dmocks-notices-v1-[a-f0-9]{64}$/);
  assert.match(first.pages.terms[0].paragraph, /₹1,193 for 12 calendar months/);
  assert.deepEqual(compilePublishedNotices({ ...released, terms: Object.fromEntries(Object.entries(released.terms).reverse()) }), first);
  for (const page of ["terms", "privacy"]) {
    for (const [field, paragraph] of Object.entries(released[page])) {
      const edited = { ...released, [page]: { ...released[page], [field]: paragraph + " Revised." } };
      assert.notEqual(compilePublishedNotices(edited).version, first.version);
    }
  }
});

test("notice compilation requires complete text and accepts fictional content only in the explicit fixture", () => {
  assert.equal(readPublishedNotices(undefined), null);
  assert.throws(() => compilePublishedNotices(fixture), /reviewed customer notice/);
  assert.notEqual(compilePublishedNotices(fixture, { allowFixture: true }).version, compilePublishedNotices(released).version);
  assert.throws(() => compilePublishedNotices({ ...released, privacy: {} }), /privacy notice is incomplete/);
  assert.throws(() => compilePublishedNotices({ ...released, terms: { ...released.terms, refunds: "" } }), /cancellation and refunds/);
  assert.throws(() => compilePublishedNotices({ ...released, privateReviewNote: "Fictional internal note" }), /reviewed customer notice/);
});

test("terms and privacy publish the same approved account eligibility text", () => {
  const approved = "DesignMocks is for students aged 18 or older. By creating an account you confirm that you are at least 18 years old.";
  const { pages } = compilePublishedNotices({
    ...released, privacy: { ...released.privacy, youngerStudents: approved },
  });
  assert.equal(pages.terms.find(({ heading }) => heading === "Account eligibility").paragraph, approved);
  assert.equal(pages.privacy.find(({ heading }) => heading === "Younger students").paragraph, approved);
});
