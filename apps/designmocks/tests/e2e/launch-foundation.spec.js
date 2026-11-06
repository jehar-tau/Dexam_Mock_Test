import { test, expect } from "@playwright/test";

test("submitted All India attempts show release status without premature feedback", async ({ page }) => {
  await page.goto("/portal-preview/pending");
  await expect(page.getByRole("heading", { name: /Your work is saved/ })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Marks, topic feedback, answer keys and ranks stay private");
  await expect(page.getByRole("status")).toContainText("1 December 2026");
  await expect(page.getByRole("button", { name: /answer review/i })).toHaveCount(0);
  await expect(page.getByText("objective marks", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "All India mocks", exact: false }).last()).toBeVisible();
});

test("cancelled Google callback explains the failure without reflecting provider details", async ({ page }) => {
  await page.goto("/account/callback?error=access_denied&error_description=private-fixture");
  await expect(page.getByRole("alert")).toContainText("Google sign-in was cancelled");
  await expect(page.getByRole("alert")).not.toContainText("private-fixture");
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeDisabled();
});

test("DMocks branding and support entry point render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DMocks/);
  await expect(
    page.getByRole("link", { name: "DMocks home" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Report a problem" }),
  ).toBeVisible();
});

test("bug reporting fails closed for signed-out visitors", async ({ page }) => {
  await page.goto("/report");
  await expect(
    page.getByRole("heading", { name: /Report a problem/ }),
  ).toBeVisible();
  await expect(page.getByText("Please sign in to continue.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send report" })).toHaveCount(
    0,
  );
});

test("student modules require authentication", async ({ page }) => {
  await page.goto("/dashboard/all-india");
  await expect(
    page.getByRole("heading", { name: /Sign in for All India mocks/ }),
  ).toBeVisible();
  await expect(
    page.locator("#main").getByRole("link", { name: "Student sign in" }),
  ).toBeVisible();
});

test("fictional portal preview exposes every requested navigation area", async ({
  page,
}) => {
  await page.goto("/portal-preview");
  if ((page.viewportSize()?.width ?? 1000) < 900)
    await page.getByRole("button", { name: "Student menu" }).click();
  const navigation = page.getByRole("navigation", {
    name: "Student workspace",
  });
  for (const name of [
    "Overview",
    "Exam-wise mocks",
    "All India mocks",
    "Topic practice",
    "Learn",
    "Community",
  ]) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByText("Sample Student")).toBeVisible();
  await expect(page.getByLabel("Performance snapshot")).toContainText("80%");
  await expect(page.getByText("Visual hierarchy", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2 released", { exact: true })).toBeVisible();
});

test("candidate profile validates and saves the complete preview flow", async ({
  page,
}) => {
  await page.goto("/profile-preview");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page.getByLabel("Student name").fill("Asha Rao");
  await page.getByLabel("Phone number").fill("+919876543210");
  await page.getByLabel("City").fill("Pune");
  await page.getByLabel("UCEED").check();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText("Preview profile saved for this session."),
  ).toBeVisible();
});

test("approved question drafts create a rights-gated Git review artifact", async ({ page }) => {
  await page.goto("/question-draft-export-preview");
  await expect(page.getByText("Export never publishes directly.")).toBeVisible();
  await page.getByLabel("Stable external key").fill("dmocks-uceed-observation-001");
  await page.getByLabel("Rights record").fill("Original DMocks question authored for this bank.");
  await page.getByLabel(/I confirm DMocks/).check();
  await page.getByRole("button", { name: "Create canonical review artifact" }).click();
  await expect(page.getByText("Not published — Git review required.")).toBeVisible();
  await expect(page.getByText("dmocks-uceed-observation-001", { exact: true })).toBeVisible();
});

test("released results recommend a preselected focused practice session", async ({ page }) => {
  await page.goto("/attempt-insights-preview");
  await expect(page.getByRole("region", { name: "Attempt insights" })).toContainText("MCQ");
  await expect(page.getByRole("heading", { name: "observation" })).toBeVisible();
  await page.getByRole("link", { name: "Build this practice session" }).click();
  await expect(page).toHaveURL(/topic-practice-preview\?topic=observation/);
  await expect(page.getByLabel("Topic")).toHaveValue("observation");
});

test("topic practice creates a constrained timed-session preview", async ({
  page,
}) => {
  await page.goto("/topic-practice-preview");
  await page.getByLabel("Exam").selectOption("nift");
  await page.getByLabel("Questions").selectOption("20");
  await page.getByLabel("Time").selectOption("1800");
  await expect(page.getByLabel("Topic")).toHaveValue("general-aptitude");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(
    page.getByText(
      "Preview created: 20 general-aptitude questions · 30 minutes",
    ),
  ).toBeVisible();
});

test("exam-wise mocks show release and free-attempt states", async ({
  page,
}) => {
  await page.goto("/exam-mocks-preview");
  await expect(page.getByText("1 free attempt left")).toBeVisible();
  await expect(page.getByText("NAT 14 · MSQ 15 · MCQ 28")).toBeVisible();
  await expect(page.getByText("UCEED · 2027 Part A")).toBeVisible();
  await expect(page.getByRole("button", { name: "Not released" })).toHaveCount(
    2,
  );
  await page
    .locator("article")
    .filter({ hasText: "UCEED" })
    .getByRole("button", { name: "Start mock" })
    .click();
  await expect(page.getByText("Preview: UCEED mock created")).toBeVisible();
});

test("All India mocks expose one open attempt and privacy-safe released ranks", async ({
  page,
}) => {
  await page.goto("/all-india-preview");
  await expect(page.getByText("NID All India Mock 01")).toBeVisible();
  await page.getByRole("button", { name: "Start once" }).click();
  await expect(
    page.getByText("Preview attempt created once: open"),
  ).toBeVisible();
  await expect(page.getByText("Candidate-A1B2C3")).toBeVisible();
  await expect(page.getByText("#1")).toBeVisible();
});

test("students can submit a structured question report", async ({ page }) => {
  await page.goto("/question-report-preview");
  await page.getByRole("button", { name: "Report question" }).click();
  await page.getByLabel("What is wrong?").selectOption("incomplete");
  await page
    .getByLabel("Details (optional)")
    .fill("The final sentence is missing.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(
    page.getByText("Report received. 2 of 5 reports recorded."),
  ).toBeVisible();
});

test("learning path opens a theory lesson", async ({ page }) => {
  await page.goto("/learn-preview");
  await expect(page.getByLabel("Learning progress")).toContainText("50% complete");
  await expect(page.getByLabel("Learning progress")).toContainText("40% accuracy");
  await expect(page.getByText("Recommended next", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start lesson" }).click();
  await expect(
    page.getByText("Preview lesson opened: Notice before you decide"),
  ).toBeVisible();
});

test("community accepts a structured discussion post", async ({ page }) => {
  await page.goto("/community-preview");
  await page.getByLabel("Topic").fill("perspective");
  await page
    .getByLabel("Question title")
    .fill("How should I check perspective?");
  await page
    .getByLabel("Your approach or question")
    .fill("I use horizon lines first, but I want a reliable checking method.");
  await page.getByLabel("Question images (optional, up to 3)").setInputFiles({
    name: "perspective.png", mimeType: "image/png", buffer: Buffer.from("preview"),
  });
  await page.getByRole("button", { name: "Post to community" }).click();
  await expect(
    page.getByText("Preview post created: How should I check perspective?"),
  ).toBeVisible();
  await expect(page.getByText("1 image", { exact: false })).toBeVisible();
});

test("community opens a thread and supports member actions", async ({ page }) => {
  await page.goto("/community-preview");
  await page.getByRole("button", { name: "Open discussion" }).click();
  await expect(page.getByRole("region", { name: "Discussion thread" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Question attachment 1" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Solution attachment 1" })).toBeVisible();
  await page.getByLabel("Add a reply").fill("Separating facts from inferences helps me check the answer.");
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText("Preview reply added.")).toBeVisible();
  await page.getByRole("button", { name: "Mark helpful" }).click();
  await expect(page.getByText("Marked helpful.")).toBeVisible();
  await page.getByRole("button", { name: "Report" }).click();
  await expect(page.getByText("Report sent for moderator review.")).toBeVisible();
});

test("admin can resolve a reported community post", async ({ page }) => {
  await page.goto("/community-moderation-preview");
  await expect(page.getByText("Active-paper answer posted in a discussion.")).toBeVisible();
  await page.getByRole("button", { name: "Hide content" }).click();
  await expect(page.getByText("No open community reports.")).toBeVisible();
});

test("admin can request an AI-assisted question for human review", async ({ page }) => {
  await page.goto("/ai-question-drafting-preview");
  await page.getByLabel("Topic").fill("observation");
  await page.getByLabel("Rights-approved basis keys").fill("uceed-2024-q1");
  await page.getByLabel("Generation brief").fill("Create an original question testing observation without copying the source.");
  await page.getByRole("button", { name: "Generate review draft" }).click();
  await expect(page.getByText("AI draft created and sent to human review.")).toBeVisible();
  await expect(page.getByText("succeeded")).toBeVisible();
});

test("drawing submission accepts ordered raster pages", async ({ page }) => {
  await page.goto("/drawing-uploads-preview");
  await expect(page.getByLabel("Fixed drawing upload window")).toContainText("fixed 15-minute upload window");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "page-one.png", mimeType: "image/png", buffer: Buffer.from("one") },
    {
      name: "page-two.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("two"),
    },
  ]);
  await expect(page.getByText("page-one.png")).toBeVisible();
  await expect(page.getByText("page-two.jpg")).toBeVisible();
  await expect(page.getByText("Drawing images saved privately.")).toBeVisible();
  await page.getByRole("button", { name: "Remove page-one.png" }).click();
  await expect(page.getByText("page-one.png")).not.toBeVisible();
  await expect(page.getByText("Drawing image removed.")).toBeVisible();
});

test("teacher can open anonymous private drawing pages", async ({ page }) => {
  await page.goto("/drawing-review-preview");
  await page.getByRole("button", { name: "Open private images" }).click();
  await expect(page.getByRole("img", { name: "Anonymous drawing page 1" })).toBeVisible();
  await expect(page.getByText("Page 1")).toBeVisible();
});

test("teacher review is released separately to the drawing student", async ({ page }) => {
  await page.goto("/drawing-review-lifecycle-preview");
  const advisory = page.getByLabel("AI review advisory");
  await expect(advisory).toContainText("AI ADVISORY — NOT A GRADE");
  await expect(advisory).toContainText("Proposed 14 marks");
  await expect(page.getByLabel("Score out of 20")).toHaveValue("");
  await page.getByLabel("Criterion marks JSON").fill('{"composition":8,"clarity":7}');
  await page.getByLabel("Score out of 20").fill("15");
  await page.getByLabel("Feedback").fill("Clear hierarchy; strengthen the directional contrast.");
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByText("Human review pending.")).toBeVisible();
  await page.getByRole("button", { name: "Release feedback to student" }).click();
  await expect(page.getByText("15/20 marks")).toBeVisible();
  await expect(page.locator(".drawing-feedback").getByText("Clear hierarchy; strengthen the directional contrast.")).toBeVisible();
});

test("operations health exposes privacy-safe actionable counters", async ({ page }) => {
  await page.goto("/operations-health-preview");
  const health = page.getByLabel("Operational health");
  await expect(health).toContainText("degraded");
  await expect(health).toContainText("Stale attempts");
  await expect(health).toContainText("Failed intake jobs");
  await expect(health).toContainText("contain no student identity");
});

test("offline answer stays queued and reconnects without changing revision", async ({ page }) => {
  await page.goto("/attempt-sync-preview");
  await page.getByRole("button", { name: "Choose B while offline" }).click();
  await expect(page.getByRole("status")).toContainText("1 answer waiting to sync");
  await expect(page.getByText("Server answer:")).toContainText("—");
  await page.getByRole("button", { name: "Reconnect and retry" }).click();
  await expect(page.getByRole("status")).toContainText("All answers saved");
  await expect(page.getByText("Server answer:")).toContainText("B");
});

test("admin corrects an extracted question before human review", async ({ page }) => {
  await page.goto("/intake-extraction-preview");
  await expect(page.getByText("CANDIDATE 1 · PAGE 2 · 84%" )).toBeVisible();
  const payload = page.getByLabel("Review and correct question JSON");
  await expect(payload).toContainText("intake-human-review");
  await payload.fill('{"type":"MCQ","prompt":"Human-corrected fictional question","holds":["intake-human-review"]}');
  await page.getByRole("button", { name: "Send to human review" }).click();
  await expect(page.getByText("promoted")).toBeVisible();
  await expect(payload).toBeDisabled();
});
