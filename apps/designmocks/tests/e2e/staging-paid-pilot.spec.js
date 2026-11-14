import { realpath } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };
import { serveArtifact } from "./local-artifact-fixture.js";
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

const stage = project.staging_frontend_origin;
const actor = { id: "00000000-0000-4000-8000-000000001701", email: "pilot-fixture@example.invalid" };
const paper = "10000000-0000-4000-8000-000000001701";
const attempt = "20000000-0000-4000-8000-000000001701";
const title = "Fictional UCEED Part A rehearsal";
test.use({ serviceWorkers: "block" });

test("the private paid-paper pilot opens a released paper with checkout closed", async ({ page }) => {
  const artifact = process.env.DMOCKS_PAID_PILOT_ARTIFACT_SITE;
  const site = artifact ? await realpath(artifact) : null;
  await page.route("**/*", route => route.abort());
  await page.route(url => [stage, project.frontend_origin].includes(url.origin), async route => {
    const url = new URL(route.request().url());
    if (site) return serveArtifact(route, site, url);
    const response = await route.fetch({ url: "http://127.0.0.1:4689" + url.pathname + url.search, maxRedirects: 0 });
    return route.fulfill({ response });
  });
  let admitted = false;
  let submitted = false;
  let answer = null;
  let revision = 0;
  const deadline = new Date(Date.now() + 7200000).toISOString();
  const readAttempt = () => ({
    id: attempt, title, status: submitted ? "submitted" : "active", deadline, serverNow: new Date().toISOString(),
    questions: [{
      id: "30000000-0000-4000-8000-000000001701", ordinal: 1, kind: "mcq", topic: "observation",
      prompt: "Original fictional objective question", options: [{ id: "A", label: "First choice" }, { id: "B", label: "Second choice" }],
      marking: { correct: 4, wrong: -1, partial: false }, points: 4, negativePoints: 1,
      answer, answerRevision: revision, media: [],
      ...(submitted ? { outcome: "correct", explanation: "Fictional answer explanation." } : {}),
    }],
    score: submitted ? 4 : null, total: 4,
  });
  const provider = await stubPortalProvider(page, (name, input) => {
    switch (name) {
      case "can_enter_staging_portal": return admitted;
      case "can_review_drawings": return false;
      case "finalize_my_expired_attempts": return 0;
      case "my_attempt_history": return [];
      case "my_pass": return { active: true, expiresAt: deadline };
      case "my_overview_analytics": return {
        completed: 0, waitingForResults: 0, objectiveAccuracy: null, objectiveAnswered: 0,
        topics: [], exams: [], drawingReviews: { pending: 0, released: 0 },
      };
      case "available_papers": return [{ id: paper, title, exam: "uceed", durationSeconds: 7200, qualityHeld: false }];
      case "start_attempt": expect(input.p_paper_id).toBe(paper); return attempt;
      case "save_answer_revision":
        answer = input.p_answer;
        revision = input.p_revision;
        return { accepted: true, answer, revision };
      case "submit_attempt":
        submitted = true;
        return readAttempt();
      case "read_attempt": return readAttempt();
      default: return undefined;
    }
  }, project.project_ref);

  await page.goto(project.frontend_origin + "/account");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await page.goto(stage + "/plans");
  await expect(page.getByText("Checkout is closed in staging.", { exact: true })).toBeVisible();
  await seedPortalSession(page, actor, project.project_ref);
  await page.goto(stage + "/dashboard/mocks");
  await expect(page.getByText("Staging access is closed for this account.")).toBeVisible();
  expect(provider.calls.some(([name]) => name === "available_papers")).toBe(false);

  admitted = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose your released paper." })).toBeVisible();
  await page.getByRole("button", { name: "Start or resume", exact: true }).click();
  await expect(page).toHaveURL(stage + "/attempt/" + attempt);
  await expect(page.getByText("Original fictional objective question", { exact: true })).toBeVisible();
  await expect(page.getByText("Fictional answer explanation.")).toHaveCount(0);
  await page.getByRole("button", { name: "A First choice", exact: true }).click();
  await expect(page.getByText("Answers are saved to your account.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "A First choice", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Submit attempt", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit & view report", exact: true }).click();
  await page.getByRole("button", { name: "Open answer review", exact: true }).click();
  await expect(page.getByText("Fictional answer explanation.")).toBeVisible();
  expect(provider.calls.filter(([name]) => name === "submit_attempt")).toHaveLength(1);
  expect(provider.calls.filter(([name]) => name === "start_attempt")).toHaveLength(1);
  expect(provider.calls.some(([name]) => ["prepare_order", "my_exam_mock_session", "my_exam_mock_report"].includes(name))).toBe(false);
  expect(provider.unexpected).toEqual([]);
});
