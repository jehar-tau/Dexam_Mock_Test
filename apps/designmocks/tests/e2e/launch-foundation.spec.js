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
  await page.getByRole("button", { name: "Post to community" }).click();
  await expect(
    page.getByText("Preview post created: How should I check perspective?"),
  ).toBeVisible();
});

test("drawing submission accepts ordered raster pages", async ({ page }) => {
  await page.goto("/drawing-uploads-preview");
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
});
