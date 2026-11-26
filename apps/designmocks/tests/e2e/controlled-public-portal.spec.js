import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

const site = project.frontend_origin;
const artifact = "http://127.0.0.1:4797";
const tester = { id: "00000000-0000-4000-8000-000000000097", email: "owner-test@example.invalid" };
test.use({ baseURL: site, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.route(url => [site, "https://www.dmocks.com"].includes(url.origin), async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: artifact + url.pathname + url.search, maxRedirects: 0 });
    return route.fulfill({ response });
  });
});

test("the controlled public build opens only approved Google tester access and no checkout", async ({ page }) => {
  let admitted = true;
  const { calls, unexpected } = await stubPortalProvider(page, procedure => {
    if (procedure === "can_enter_staging_portal") return admitted;
    if (procedure === "my_privacy_requests" || procedure === "available_papers" ||
        procedure === "my_attempt_history" || procedure === "learning_catalog" || procedure === "learning_progress") return [];
    if (procedure === "my_pass") return { active: false, expiresAt: null };
    if (procedure === "finalize_my_expired_attempts") return 0;
    if (procedure === "my_overview_analytics") return { completed: 0, waitingForResults: 0,
      objectiveAccuracy: null, objectiveAnswered: 0, topics: [], exams: [],
      drawingReviews: { pending: 0, released: 0 } };
  }, project.project_ref);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your workspace." })).toBeVisible();
  await expect(page.getByText("Sign in with Google to open your free workspace.")).toBeVisible();
  expect(calls).toEqual([]);

  await page.goto("/account");
  await expect(page.getByText("Sign in with Google to take free past papers. The annual pass is not on sale yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to test with Google" })).toBeEnabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await seedPortalSession(page, tester, project.project_ref);
  await page.reload();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toBeVisible();
  expect(calls.some(([name]) => name === "can_enter_staging_portal")).toBe(true);

  admitted = false;
  await page.reload();
  await expect(page.getByText("Sign-up is not open for this account yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toHaveCount(0);
  await page.goto("/plans");
  await expect(page.getByText("Checkout is closed during controlled testing.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay .* with Razorpay/ })).toBeDisabled();
  expect(unexpected).toEqual([]);
});

test("a copied controlled public build is inert on another host", async ({ page }) => {
  const { calls } = await stubPortalProvider(page, () => undefined, project.project_ref);
  await page.goto("https://www.dmocks.com/account");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("https://www.dmocks.com/dashboard");
  await expect(page.getByRole("heading", { name: "Your workspace." })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("an admitted tester can reopen saved pending and drawing attempts without opening checkout", async ({ page }) => {
  const drawingId = "00000000-0000-4000-8000-000000000098";
  const pendingId = "00000000-0000-4000-8000-000000000099";
  const now = new Date().toISOString();
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    if (procedure === "can_enter_staging_portal") return true;
    if (procedure === "finalize_my_expired_attempts") return 0;
    if (procedure === "my_pass") return { active: false, expiresAt: null };
    if (procedure === "available_papers") return [];
    if (procedure === "my_attempt_history") return [
      { id: drawingId, title: "Original fictional drawing result", status: "submitted", resultsPending: false, score: 20, total: 100 },
      { id: pendingId, title: "Original fictional pending result", status: "submitted", resultsPending: true, score: null, total: null },
    ];
    if (procedure === "my_overview_analytics") return { completed: 2, waitingForResults: 1,
      objectiveAccuracy: null, objectiveAnswered: 0, topics: [], exams: [],
      drawingReviews: { pending: 0, released: 1 } };
    if (procedure === "my_exam_mock_session") return input.p_attempt_id === drawingId ? {
      exam: "ceed", partAAttemptId: "00000000-0000-4000-8000-000000000097",
      partBAttemptId: drawingId, partBState: "started", partBOpensAt: now,
    } : null;
    if (procedure === "my_exam_mock_report") return null;
    if (procedure === "read_attempt") return input.p_id === drawingId ? {
      id: drawingId, title: "Original fictional drawing result", status: "submitted", deadline: now,
      serverNow: now, resultsPending: false, scoreKind: "drawing", score: 20, total: 100,
      questions: [{ id: "00000000-0000-4000-8000-000000000101", ordinal: 1, kind: "drawing",
        topic: "observation", prompt: "Sketch a fictional object.", answer: null, media: [],
        drawingReview: { status: "released", score: 20, maxScore: 100, comments: "Original fictional review." } }],
    } : input.p_id === pendingId ? {
      id: pendingId, title: "Original fictional pending result", status: "submitted", deadline: now,
      serverNow: now, resultsPending: true, reviewEndsAt: now, score: null, total: null, questions: [],
    } : undefined;
  }, project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Original fictional drawing result" })).toBeVisible();
  await page.getByRole("link", { name: "Original fictional drawing result" }).click();
  await expect(page.getByRole("heading", { name: "Paper analysis" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Drawing result" })).toContainText("20/100");
  await expect(page.getByRole("link", { name: "Continue Part B" })).toHaveCount(0);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Original fictional pending result" }).click();
  await expect(page.getByRole("heading", { name: /Results come after review/ })).toBeVisible();
  await expect(page.getByText("Marks, topic feedback, answer keys and ranks stay private")).toBeVisible();
  expect(calls.filter(([name]) => name === "read_attempt").map(([, input]) => input.p_id)).toEqual([drawingId, pendingId]);
  expect(calls.some(([name]) => name === "create-order" || name === "prepare_order")).toBe(false);
  expect(unexpected).toEqual([]);
});
