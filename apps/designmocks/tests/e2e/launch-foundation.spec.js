import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

test("submitted All India attempts show release status without premature feedback", async ({ page }) => {
  await page.goto("/portal-preview/pending");
  await expect(page.getByRole("heading", { name: /Your work is saved/ })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Marks, topic feedback, answer keys and ranks stay private");
  await expect(page.getByRole("status")).toContainText("1 December 2026");
  await expect(page.getByRole("button", { name: /answer review/i })).toHaveCount(0);
  await expect(page.getByText("objective marks", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "All India mocks", exact: false }).last()).toBeVisible();
});

test("submitted All India drawings can be uploaded while the result stays sealed", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-07T13:00:00Z") });
  await page.goto("/portal-preview/pending-upload");
  const upload = page.getByRole("region", { name: "Drawing upload window" });
  await expect(upload.getByRole("heading", { name: "Sketch a portable reading light." })).toBeVisible();
  await expect(upload.getByRole("button", { name: "Add images" })).toBeEnabled();
  await upload.locator('input[type="file"]').setInputFiles({ name: "drawing.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  await expect(upload.getByText("drawing.png")).toBeVisible();
  await expect(upload.getByRole("status")).toContainText("Drawing images saved privately.");
  await expect(page.getByRole("button", { name: /answer review/i })).toHaveCount(0);
  await expect(page.getByText("All India marks", { exact: true })).toHaveCount(0);
  await page.clock.fastForward(5 * 60 * 1000 + 1000);
  await expect(upload).toHaveCount(0);
  await expect(page.getByText(/Marks, topic feedback, answer keys and ranks stay private/)).toBeVisible();
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

test("fictional portal preview navigation opens dev-only module screens", async ({
  page,
}) => {
  const providerRequests = [];
  page.on("request", request => {
    if (/\.supabase\.co\//.test(request.url())) providerRequests.push(request.url());
  });
  await page.goto("/portal-preview");
  const navigation = page.getByRole("navigation", {
    name: "Student workspace",
  });
  const destinations = [
    ["Overview", "/portal-preview"],
    ["Exam-wise mocks", "/exam-mocks-preview", /Inside the exam room/],
    ["All India mocks", "/all-india-preview", /One paper\. One attempt/],
    ["Topic practice", "/topic-practice-preview", /Build a topic session/],
    ["Learn", "/learn-preview", /Notice before you decide/],
    ["Community", "/community-preview", /How do you separate observation from assumption/],
  ];
  const mobile = (page.viewportSize()?.width ?? 1000) < 900;
  const openMenu = async () => {
    const menu = page.locator(".portal-menu-button");
    if (mobile && await menu.getAttribute("aria-expanded") !== "true") await menu.click();
  };
  await openMenu();
  for (const [name, destination] of destinations) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
    await expect(navigation.getByRole("link", { name })).toHaveAttribute("href", destination);
  }
  await expect(page.getByText("Sample Student")).toBeVisible();
  await expect(page.getByText("1 submitted attempt is awaiting results.")).toBeVisible();
  const pending = page.locator("article").filter({ hasText: "Example cohort awaiting release" });
  await expect(pending).toContainText("Awaiting release");
  await expect(pending.getByRole("link")).toHaveAttribute("href", "/portal-preview/pending");
  await expect(page.getByLabel("Performance snapshot")).toContainText("80%");
  await expect(page.getByText("Visual hierarchy", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2 released", { exact: true })).toBeVisible();

  for (const [name, destination, content] of destinations.slice(1)) {
    await openMenu();
    await navigation.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(destination);
    await expect(page.getByText(content).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sign in to continue|Sign in for/ })).toHaveCount(0);
  }
  expect(providerRequests).toEqual([]);
});

test("test mode links keep exploration inside sign-in-free previews", async ({ page }) => {
  await page.goto("/portal-preview");
  await page.getByText("Explore student pages").click();
  const areas = page.getByRole("navigation", { name: "Sign-in-free student pages" });
  await expect(areas.getByRole("link", { name: "Exam-wise mocks" })).toHaveAttribute("href", "/exam-mocks-preview");
  await expect(areas.getByRole("link", { name: "Community" })).toHaveAttribute("href", "/community-preview");
  await expect(areas.getByRole("link", { name: /Teacher|Admin|moderation|Operations/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Account & sign out" })).toHaveCount(0);
  await page.getByRole("link", { name: "Practise the recommended topic" }).click();
  await expect(page).toHaveURL(/\/topic-practice-preview\?topic=Visual\+hierarchy$/);
  await expect(page.getByRole("heading", { name: /Build a topic session/ })).toBeVisible();
  await page.goto("/portal-preview/pending");
  await page.getByRole("link", { name: "Back to your workspace" }).click();
  await expect(page).toHaveURL(/\/portal-preview$/);
});

test("the reduced dev preview links only to its local overview and exam example", async ({ page }) => {
  const providerRequests = [];
  await page.route(/\.supabase\.co\//, route => {
    providerRequests.push(route.request().url());
    return route.abort();
  });
  const reducedPreviewOrigin = "http://127.0.0.1:4999";
  await page.goto(reducedPreviewOrigin + "/portal-preview");
  if ((page.viewportSize()?.width ?? 1000) < 900)
    await page.getByRole("button", { name: "Student menu" }).click();
  const navigation = page.getByRole("navigation", { name: "Student workspace" });
  await expect(navigation.getByRole("link")).toHaveCount(4);
  await expect(navigation.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/portal-preview");
  await expect(navigation.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/learn-preview");
  const papers = navigation.getByRole("link", { name: "Released papers" });
  await expect(papers).toHaveAttribute("href", "/exam-mocks-preview");
  await papers.click();
  await expect(page).toHaveURL(reducedPreviewOrigin + "/exam-mocks-preview");
  await expect(page.getByRole("heading", { name: /Exam-wise mocks/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign in to continue/ })).toHaveCount(0);
  expect(providerRequests).toEqual([]);
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
  await expect(page.getByText("Git review required before import.")).toBeVisible();
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

test("account privacy controls export data and create a reversible deletion request", async ({ page }) => {
  await page.goto("/account-privacy-preview");
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download my data"}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dmocks-account-export-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByRole("status")).toContainText("downloaded");
  await page.getByRole("button",{name:"Request account deletion"}).click();
  await expect(page.getByText("Deletion request: open")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("account remains active");
  await page.getByRole("button",{name:"Cancel deletion request"}).click();
  await expect(page.getByRole("button",{name:"Request account deletion"})).toBeVisible();
});

test("verified exam transition declares the fixed Part B tasks, clock and upload grace",async({page})=>{
  await page.goto("/exam-part-transition-preview");
  const region=page.getByLabel("Exam Part B");
  await expect(region).toContainText("2 drawing tasks · 60 minutes");
  await expect(region).toContainText("15-minute upload grace");
  await expect(region.getByRole("button",{name:"Open Part B"})).toBeVisible();
  await expect(page.getByLabel("Combined exam result")).toContainText("164/300 marks");
  await expect(page.getByLabel("Combined exam result")).toContainText("Part A 124/200 · Part B 40/100");
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

test("exam-wise preview explores paper formats and samples without issuing an attempt", async ({ page }) => {
  const mutations = [];
  page.on("request", request => {
    if (request.method() === "POST") mutations.push(request.url());
  });
  await page.goto("/exam-mocks-preview");
  await expect(page.getByRole("link", { name: "Try a complete paper demo" })).toHaveAttribute("href", "/portal-preview/paper");
  const exam = name => page.getByRole("radio", { name });
  await expect(exam(/UCEED/)).toBeChecked();
  await page.getByText("A hole through folded paper", {exact:true}).click();
  await page.getByLabel("Your numerical answer").fill("4");
  await page.getByRole("button", {name:"Check answer"}).click();
  await expect(page.getByRole("status")).toContainText("Correct.");
  await exam(/UCEED/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(exam(/NID DAT/)).toBeChecked();
  await page.locator("summary").filter({hasText:"Text & visual prompts"}).click();
  await expect(page.getByText(/Check your admit card/)).toBeVisible();
  await page.getByText("A latch for small hands", {exact:true}).click();
  await page.getByText("Review your sketch", {exact:true}).click();
  await expect(page.getByText(/Compare your two views/)).toBeVisible();
  await page.getByText("NIFT", {exact:true}).first().click();
  await page.getByText("Cutting a fabric length", {exact:true}).click();
  await page.getByRole("radio", {name:"120",exact:true}).check();
  await page.getByRole("button", {name:"Check answer"}).click();
  await expect(page.getByRole("status")).toContainText("120 cm");
  await page.getByText("CEED", {exact:true}).first().click();
  await expect(page.getByRole("region", {name:"Mock catalogue"})).toContainText("Released CEED mocks");
  await expect(page.getByRole("button", {name:"Start mock"})).toHaveCount(0);
  await expect(page.getByText(/free attempt left|mock created/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(mutations).toEqual([]);
});

test("All India mocks expose one open attempt and privacy-safe released ranks", async ({
  page,
}) => {
  await page.goto("/all-india-preview");
  await expect(page.getByText("NID All India Mock 01")).toBeVisible();
  await expect(page.getByText(/Starts closed. The attempt window ends/)).toBeVisible();
  await expect(page.getByText(/plus 15 minutes for drawing uploads/)).toBeVisible();
  await expect(page.getByText("Rank 2 of 24 · 27/30 marks")).toBeVisible();
  await page.getByRole("button", { name: "Start once" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Begin timed attempt" }).click();
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
    page.getByText("Report received. 2 unique students reported this version; the review threshold is 5."),
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
  await page.getByLabel("Topic", { exact: true }).fill("perspective");
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
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByText("Preview reply added.")).toBeVisible();
  await page.getByRole("button", { name: "Mark helpful" }).click();
  await expect(page.getByText("Marked helpful.")).toBeVisible();
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByRole("dialog", { name: "Report community content", exact: true }).getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByText("Report sent for moderator review.")).toBeVisible();
});

test("admin can resolve a reported community post", async ({ page }) => {
  await page.goto("/community-moderation-preview");
  await expect(page.getByText("Active-paper answer posted in a discussion.")).toBeVisible();
  await page.getByRole("button", { name: "Review report", exact: true }).press("Enter");
  const review = page.getByRole("region", { name: "Community report review", exact: true });
  await expect(review.getByText("Current content.", { exact: false })).toBeVisible();
  await review.getByLabel("Review reason", { exact: true }).fill("Fictional active answer confirmed for this preview.");
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
  await expect(page.getByRole("button", { name: "Add images" })).toBeEnabled();
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
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
});

test("teacher review is released separately to the drawing student", async ({ page }) => {
  await page.goto("/drawing-review-lifecycle-preview");
  const queue = page.getByRole("region", { name: "Drawing review queue" });
  const advisory = page.getByLabel("AI review advisory");
  const claim = queue.getByRole("button", { name: "Claim anonymous review" });
  await expect(queue.getByText(/student upload window is still open/)).toBeVisible();
  await expect(queue.getByText("Assigned to another teacher.")).toBeVisible();
  await expect(claim).toHaveCount(1);
  await expect(advisory).toHaveCount(0);
  await claim.focus();
  await page.keyboard.press("Enter");
  await expect(advisory).toContainText("AI ADVISORY — NOT A GRADE");
  await expect(advisory).toContainText("Proposed 14 marks");
  const criteria = advisory.getByLabel("Suggested criterion marks");
  await expect(criteria.locator("dt")).toHaveText(["Composition", "Clarity"]);
  await expect(criteria.locator("dd")).toHaveText(["8.25", "5.75"]);
  await expect(queue.getByLabel("Criterion 1", { exact: true })).toHaveValue("");
  await expect(queue.getByLabel("Mark 1", { exact: true })).toHaveValue("");
  await queue.getByRole("button", { name: "Return to review queue" }).click();
  await expect(advisory).toHaveCount(0);
  await claim.click();
  await queue.getByRole("button", { name: "Open private images" }).click();
  await expect(queue.getByRole("img", { name: "Anonymous drawing page 1" })).toBeVisible();
  await queue.getByRole("button", { name: "Refresh private images" }).click();
  await expect(queue.getByRole("img", { name: "Anonymous drawing page 1" })).toBeVisible();
  await expect.poll(() => queue.getByRole("img", { name: "Anonymous drawing page 1" })
    .evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await queue.getByLabel("Criterion 1", { exact: true }).fill("Composition");
  await queue.getByLabel("Mark 1", { exact: true }).fill("8");
  await queue.getByRole("button", { name: "Add criterion" }).click();
  await queue.getByLabel("Criterion 2", { exact: true }).fill("Clarity");
  await queue.getByLabel("Mark 2", { exact: true }).fill("17");
  await page.getByLabel("Feedback").fill("Clear hierarchy; strengthen the directional contrast.");
  await expect(queue.getByLabel("Total marks")).toHaveText("25 / 20");
  const invalidTotalSubmit = queue.getByRole("button", { name: "Save human review" });
  await expect.poll(() => invalidTotalSubmit.evaluate(button => button.form.checkValidity())).toBe(true);
  await invalidTotalSubmit.press("Enter");
  await expect(queue.getByRole("alert")).toContainText("cannot exceed 20 marks");
  await queue.getByLabel("Mark 2", { exact: true }).fill("7");
  await expect(queue.getByLabel("Total marks")).toHaveText("15 / 20");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run('[aria-label="Drawing review queue"]', {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
  });
  expect(violations).toEqual([]);
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByText("Human review pending.")).toBeVisible();
  await expect(page.getByText("15/20 marks")).toHaveCount(0);
  await page.getByRole("button", { name: "Release feedback to student" }).click();
  await expect(page.getByText("15/20 marks")).toBeVisible();
  await expect(page.locator(".drawing-feedback").getByText("Clear hierarchy; strengthen the directional contrast.")).toBeVisible();
  await queue.getByLabel("Mark 2", { exact: true }).fill("8");
  await expect(queue.getByLabel("Override reason")).toHaveAttribute("required", "");
  await queue.getByLabel("Override reason").fill("Second reviewer correction");
  await queue.getByRole("button", { name: "Save reviewed override" }).click();
  await expect(page.getByText("Human review pending.")).toBeVisible();
  await expect(page.getByText("16/20 marks")).toHaveCount(0);
  await queue.getByRole("button", { name: "Release feedback to student" }).click();
  await expect(page.getByText("16/20 marks")).toBeVisible();
});

test("operations health exposes privacy-safe actionable counters", async ({ page }) => {
  await page.goto("/operations-health-preview");
  const health = page.getByLabel("Operational health");
  await expect(health).toContainText("degraded");
  await expect(health).toContainText("Stale attempts");
  await expect(health).toContainText("Failed intake jobs");
  await expect(health).toContainText("contain no student identity");
});

test("launch readiness keeps sales closed until every evidenced gate passes",async({page})=>{
  await page.goto("/launch-readiness-preview");
  const readiness=page.getByLabel("Launch readiness");
  await expect(readiness).toContainText("closed");
  await expect(readiness).toContainText("Sales disabled");
  await expect(readiness).toContainText("Content publication rights");
  await expect(readiness).toContainText("Backup and restore drill");
  await expect(readiness).toContainText("does not activate registration, publish papers or enable sales");
});

test("offline answer survives a reload and reconnects without changing revision", async ({ page }) => {
  await page.goto("/attempt-sync-preview");
  await page.getByRole("button", { name: "Choose B while offline" }).click();
  await expect(page.getByRole("status")).toContainText("1 answer waiting to sync");
  await expect(page.getByText("Server answer:")).toContainText("—");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("1 answer waiting to sync");
  await page.getByRole("button", { name: "Reconnect and retry" }).click();
  await expect(page.getByRole("status")).toContainText("All answers saved");
  await expect(page.getByText("Server answer:")).toContainText("B");
  await expect(page.getByText("Server revision:")).toContainText("100");
  await page.reload();
  await expect(page.getByRole("button", { name: "Reconnect and retry" })).toHaveCount(0);
});

test("admin corrects an extracted question before human review", async ({ page }) => {
  await page.goto("/intake-extraction-preview");
  await expect(page.getByText("CANDIDATE 1 · PAGE 2 · 84%" )).toBeVisible();
  await expect(page.getByText(/This candidate carries an intake-human-review hold/)).toBeVisible();
  const candidate = page.getByRole("region", { name: "Candidate 1" });
  await candidate.getByRole("combobox", { name: "Exam", exact: true }).selectOption("uceed");
  await candidate.getByLabel("Question wording").fill("Human-corrected fictional question");
  await candidate.getByLabel("Does the question require figures?").selectOption("false");
  await candidate.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send to human review" }).click();
  await expect(page.getByText("promoted")).toBeVisible();
  await expect(candidate.getByLabel("Question wording")).toHaveCount(0);
});
