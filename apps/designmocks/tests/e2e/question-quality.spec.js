import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const editor = { id: "00000000-0000-4000-8000-000000000201", email: "quality-editor@example.invalid" };
const student = { id: "00000000-0000-4000-8000-000000000211", email: "quality-student@example.invalid" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4+vEFAAWtAs+P9YeZAAAAAElFTkSuQmCC", "base64");
const figureURL = "https://quality-figure-fixture.invalid/figure.png";
const snapshot = { prompt: `${"Fictional complete reported wording. ".repeat(24)}Retained ending.`, kind: "mcq",
  options: [{ id: "A", label: "Fictional first option" }, { id: "B", label: "Fictional second option" }],
  key: { kind: "mcq", correct: ["B"] }, marking: { correct: 3, wrong: -0.71 }, explanation: "The second option follows the intended order." };

async function adminFixture(page, { admin = true } = {}) {
  const state = { incomplete: false, report: { targetKey: `quality-fixture:version:${"a".repeat(64)}`, sourceExternalKey: "quality-fixture",
    revision: 1, bankVersion: "bank-current", status: "pending", reportCount: 10, priority: "high", quarantinesBank: true,
    sourceChanged: false, contentVersion: "a".repeat(64), prompt: snapshot.prompt.slice(0, 500), snapshot,
    media: [{ ordinal: 1, available: true }], reasons: { incorrect: 9, media: 2 }, audit: [{ action: "quarantine", reportCount: 5, note: "Threshold reached." }] } };
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return admin;
      case "admin_reported_questions": return [state.report];
      case "admin_reported_question": return input.p_expected_revision === state.report.revision ? state.report : { code: "40001", message: "Reports changed. Refresh and review this case again." };
      case "reported-question-media": return { images: state.incomplete ? [] : [{ ordinal: 1, url: figureURL }] };
      case "admin_resolve_reported_question": {
        if (input.p_expected_revision !== state.report.revision) return { code: "40001", message: "Reports changed. Refresh and review this case again." };
        if (input.p_expected_bank_version !== state.report.bankVersion) return { code: "40001", message: "Bank content changed. Refresh and review this case again." };
        state.report.status = { dismiss: "dismissed", restore: "restored", retire: "retired", fix: "retired", reopen: "pending" }[input.p_action];
        state.report.revision++;
        if (input.p_action === "fix") state.report.quarantinesBank = false;
        state.report.audit.push({ action: input.p_action, reportCount: state.report.reportCount, note: input.p_note });
        return null;
      }
      default: return emptyAdminRead(procedure);
    }
  });
  await page.route(figureURL, route => route.fulfill({ body: png, contentType: "image/png" }));
  await page.goto("/admin");
  await seedPortalSession(page, editor);
  await page.reload();
  return Object.assign(state, provider);
}

test("administrators review the frozen question and private figures before a reasoned restoration", async ({ page }) => {
  const state = await adminFixture(page);
  const queue = page.getByRole("region", { name: "Reported questions", exact: true });
  await expect(queue.getByText("pending · 10 unique students · High priority")).toBeVisible();
  await queue.getByRole("button", { name: "Review reported version quality-fixture", exact: true }).click();
  const review = queue.getByRole("region", { name: "Reported version review", exact: true });
  await expect(review.getByText(snapshot.prompt, { exact: true })).toBeVisible();
  await expect(review.locator("dd")).toHaveText(["B", "Correct 3 · Wrong -0.71"]);
  await review.getByLabel("Question review reason").fill("The complete delivered question and original key were checked.");
  await review.getByRole("checkbox").check();
  await expect(review.getByRole("button", { name: "Restore this version", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Open reported figures" }).click();
  await expect(review.getByRole("img", { name: "Reported question figure 1" })).toBeVisible();
  await expect(review.getByRole("button", { name: "Restore this version", exact: true })).toBeEnabled();
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".reported-question-queue", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  const bankReads = state.calls.filter(([name]) => name === "admin_search_bank_questions").length;
  await review.getByRole("button", { name: "Restore this version", exact: true }).press("Enter");
  await expect(queue.getByText("Review recorded. Existing attempts are unchanged; bank approval is separate.")).toBeVisible();
  await expect(review).toHaveCount(0);
  await expect.poll(() => state.calls.filter(([name]) => name === "admin_search_bank_questions").length).toBeGreaterThan(bankReads);
  expect(state.calls).toContainEqual(["admin_resolve_reported_question", { p_target_key: state.report.targetKey, p_action: "restore",
    p_note: "The complete delivered question and original key were checked.", p_expected_revision: 1, p_expected_bank_version: "bank-current" }]);
  expect(state.report.status).toBe("restored");
  expect(state.unexpected).toEqual([]);
});

test("new reports or changed bank content reject an old decision and a corrected source needs its own explicit release", async ({ page }) => {
  const state = await adminFixture(page);
  const queue = page.getByRole("region", { name: "Reported questions", exact: true });
  const open = () => queue.getByRole("button", { name: "Review reported version quality-fixture", exact: true }).click();
  const review = queue.getByRole("region", { name: "Reported version review", exact: true });
  await open();
  await review.getByLabel("Question review reason").fill("Fictional source needs human correction.");
  state.report.revision++;
  await review.getByRole("button", { name: "Retire this version", exact: true }).click();
  await expect(review.getByRole("alert")).toHaveText("Reports changed. Refresh and review this case again.");
  await queue.getByRole("button", { name: "Refresh question reports" }).click();
  await expect(review).toHaveCount(0);
  await open();
  await expect(review.getByRole("checkbox")).not.toBeChecked();
  await review.getByLabel("Question review reason").fill("Fictional source needs human correction.");
  state.report.bankVersion = "bank-corrected";
  state.report.sourceChanged = true;
  await review.getByRole("button", { name: "Retire this version", exact: true }).click();
  await expect(review.getByRole("alert")).toHaveText("Bank content changed. Refresh and review this case again.");
  await queue.getByRole("button", { name: "Refresh question reports" }).click();
  await expect(review).toHaveCount(0);
  await open();
  await review.getByLabel("Question review reason").fill("The corrected canonical source is ready for fresh bank review.");
  await review.getByRole("button", { name: "Release corrected source for review", exact: true }).click();
  await expect(review).toHaveCount(0);
  expect(state.report.status).toBe("retired");
  expect(state.report.quarantinesBank).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("missing private figures block restoration but permit an audited retirement", async ({ page }) => {
  const state = await adminFixture(page);
  state.incomplete = true;
  const queue = page.getByRole("region", { name: "Reported questions", exact: true });
  await queue.getByRole("button", { name: "Review reported version quality-fixture", exact: true }).click();
  const review = queue.getByRole("region", { name: "Reported version review", exact: true });
  await review.getByLabel("Question review reason").fill("The required private figure is incomplete.");
  const acknowledgement = review.getByRole("checkbox");
  await acknowledgement.focus();
  await expect(acknowledgement).toBeFocused();
  await acknowledgement.press("Space");
  await expect(acknowledgement).toBeChecked();
  await review.getByRole("button", { name: "Open reported figures" }).click();
  await expect(review.getByRole("alert")).toHaveText("The question figures are incomplete. Refresh the figures before approving.");
  await expect(review.getByRole("button", { name: "Restore this version", exact: true })).toBeDisabled();
  await expect(review.getByRole("button", { name: "Dismiss reports", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Retire this version", exact: true }).click();
  await expect(review).toHaveCount(0);
  expect(state.report.status).toBe("retired");
  expect(state.unexpected).toEqual([]);
});

test("students cannot open reported snapshots, staff decisions or private review figures", async ({ page }) => {
  const state = await adminFixture(page, { admin: false });
  await expect(page.getByText("This account is not an administrator.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Reported questions", exact: true })).toHaveCount(0);
  expect(state.calls.every(([name]) => name === "is_dmocks_admin")).toBe(true);
  expect(state.unexpected).toEqual([]);
});

test("a paused All India event preserves the existing runner, reporting and answer saving", async ({ page }) => {
  const deadline = new Date(Date.now() + 3600000).toISOString();
  const attemptId="20000000-0000-4000-8000-000000000211",now=Date.now(),timing={startsAt:new Date(now-86400000).toISOString(),endsAt:new Date(now+86400000).toISOString(),lastStartAt:new Date(now+82800000).toISOString(),reviewEndsAt:new Date(now+172800000).toISOString(),durationSeconds:3600,uploadGraceSeconds:0,result:null};
  const questions = [1, 2].map(n => ({ id: `quality-question-${n}`, ordinal: n, prompt: `Fictional runner question ${n}`, kind: "mcq", topic: "observation",
    options: snapshot.options, marking: snapshot.marking, points: 3, negativePoints: 0.71, media: [], answer: null, answerRevision: 0 }));
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "all_india_event_catalog": return [
        { ...timing, id: "10000000-0000-4000-8000-000000000211", exam: "uceed", title: "Fictional paused event", state: "paused", qualityHeld: true,attemptId:null },
        { ...timing, id: "10000000-0000-4000-8000-000000000212", exam: "ceed", title: "Fictional existing event", state: "paused", qualityHeld: true,attemptId },
      ];
      case "read_attempt": return { id: attemptId, title: "Fictional fixed paper", status: "active", deadline, serverNow: new Date().toISOString(), questions };
      case "my_exam_mock_session": case "my_exam_mock_report": return null;
      case "report_attempt_question": return { reportCount: 5, threshold: 5, held: true };
      case "save_answer_revision": return { accepted: true, answer: input.p_answer, revision: input.p_revision };
    }
  });
  await page.goto("/dashboard/all-india");
  await seedPortalSession(page, student);
  await page.reload();
  const held = page.getByRole("article").filter({ hasText: "Fictional paused event" });
  await expect(held.getByRole("button", { name: "Unavailable", exact: true })).toBeDisabled();
  await expect(held.getByText("New starts are paused for question review. Existing attempts keep their original paper and clock.")).toBeVisible();
  await page.getByRole("link", { name: "Open attempt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fictional runner question 1", exact: true })).toBeVisible();
  const reportToggle = page.getByRole("button", { name: "Report question", exact: true });
  await reportToggle.focus();
  await reportToggle.press("Enter");
  await expect(reportToggle).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("What is wrong?").selectOption("duplicate");
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "New attempts are held for human review" })).toBeVisible();
  await page.getByRole("button", { name: "B Fictional second option", exact: true }).click();
  await expect.poll(() => calls.filter(([name]) => name === "save_answer_revision").length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fictional runner question 2", exact: true })).toBeVisible();
  await expect(page.getByText(/Report received/)).toHaveCount(0);
  expect(calls.some(([name]) => ["start_all_india_attempt", "start_attempt"].includes(name))).toBe(false);
  expect(unexpected).toEqual([]);
});
