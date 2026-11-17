import { expect, test } from "@playwright/test";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { admin, asha, audit, backend, fitsWidth, meera, ravi, signIn, uid } from "./community-library-fixture.js";

test.use({ baseURL: portalFixtureURL });
const guide = { title: "A fictional guide to two-hour plans", site: "Fictional Guides", description: "How one fictional student split the paper." };
const status = (page, text) => page.getByRole("status").filter({ hasText: text });
const saveForm = page => page.getByRole("region", { name: "Save a link", exact: true });
const folder = (page, name) => page.getByRole("region", { name: `Folder ${name}`, exact: true });
function savedLink(state, user, link, folderName = "Links", note = null) {
  let folderRow = state.folders.find(item => item.userId === user.id && item.name === folderName);
  if (!folderRow) { folderRow = { id: uid("f", state.folders.length + 1), userId: user.id, name: folderName }; state.folders.push(folderRow); }
  state.linkSaves.push({ userId: user.id, linkId: link.id, folderId: folderRow.id, savedAt: "2026-11-17T00:00:0" + state.linkSaves.length + ".000000+00:00" });
  if (note) state.notes.push({ userId: user.id, linkId: link.id, body: note });
}

test("a student saves a link with a private note, and private addresses are refused before any request", async ({ page }) => {
  const state = backend(); state.previews.set("https://example.org/two-hour-plan", guide);
  await state.install(page); await signIn(page, asha, "/dashboard/community/saved");
  await expect(page.getByText("No folders yet.", { exact: false })).toBeVisible();
  await saveForm(page).getByLabel("Web address").fill("http://192.168.1.10/admin");
  await saveForm(page).getByRole("button", { name: "Get preview" }).click();
  await expect(saveForm(page).getByRole("alert")).toHaveText("That address can’t be saved. Use a public website.");
  await saveForm(page).getByLabel("Web address").fill("https://example.org:8443/");
  await saveForm(page).getByRole("button", { name: "Get preview" }).click();
  await expect(saveForm(page).getByRole("alert")).toHaveText("Use an ordinary web address without a port number.");
  expect(state.previewCalls).toEqual([]);

  await saveForm(page).getByLabel("Web address").fill("example.org/two-hour-plan?utm_source=fictional");
  await saveForm(page).getByRole("button", { name: "Get preview" }).click();
  const previewFrame = saveForm(page).getByLabel("Link preview");
  await expect(previewFrame).toBeFocused();
  await expect(previewFrame.getByRole("heading", { name: guide.title })).toBeVisible();
  await expect(previewFrame).toContainText("Fictional Guides · example.org");
  const external = previewFrame.getByRole("link", { name: /Open on example.org/ });
  await expect(external).toHaveAttribute("href", "https://example.org/two-hour-plan");
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  await expect(saveForm(page).getByLabel("New folder")).toHaveValue("Links");
  await saveForm(page).getByLabel("Your note (private, optional)").fill("Read before the next mock.");
  await saveForm(page).getByRole("button", { name: "Save link" }).click();
  await expect(status(page, "Link saved to 1 folder.")).toBeVisible();
  await expect(saveForm(page).getByLabel("Web address")).toBeFocused();
  await expect(page.getByRole("region", { name: "Your folders" }).getByRole("button", { name: /Links \(1\)/ })).toHaveAttribute("aria-pressed", "true");
  const saved = folder(page, "Links").getByRole("article", { name: `Saved link: ${guide.title}` });
  await expect(saved).toContainText("Your note: Read before the next mock.");
  expect(state.previewCalls).toEqual(["example.org/two-hour-plan?utm_source=fictional"]);
  expect(state.links.map(link => link.url)).toEqual(["https://example.org/two-hour-plan"]);

  await saved.getByRole("button", { name: `Remove from folder: ${guide.title}` }).click();
  await expect(status(page, "Link removed from this folder.")).toBeVisible();
  await expect(folder(page, "Links").getByText("Nothing saved here yet.")).toBeVisible();
});

test("a suggested link reaches the Links feed after a moderator adds it, and a turned-down one shows the reason", async ({ page }) => {
  const state = backend(); state.roles.set(meera.id, { teacher: true, moderator: true });
  const plan = state.link("https://example.org/two-hour-plan", guide), colour = state.link("https://example.net/colour", { title: "A fictional colour wheel note" });
  savedLink(state, asha, plan, "Links", "Read before the next mock."); savedLink(state, asha, colour);
  await state.install(page); await signIn(page, asha, "/dashboard/community/saved");
  const item = folder(page, "Links").getByRole("article", { name: `Saved link: ${guide.title}` });
  await item.getByRole("button", { name: `Suggest for the Links feed: ${guide.title}` }).click();
  const form = item.getByRole("form", { name: "Suggest for the Links feed" });
  await expect(form.getByLabel("Exam")).toBeFocused();
  await expect(form.getByLabel("Why it helps")).toHaveValue("Read before the next mock.");
  await form.getByRole("button", { name: "Send suggestion" }).click();
  await expect(form.getByRole("alert")).toHaveText("Choose the exam this link helps with.");
  await form.getByLabel("Exam").selectOption("uceed");
  await form.getByLabel("Topic").fill("Time management");
  await form.getByLabel("Why it helps").fill("It shows a plan for the two hours. DM me for my notes.");
  await form.getByRole("button", { name: "Send suggestion" }).click();
  await expect(form.getByRole("alert")).toContainText("Remove phone numbers, email addresses, social handles");
  await form.getByLabel("Why it helps").fill("It shows a calm plan for splitting the two hours across sections.");
  await form.getByRole("button", { name: "Send suggestion" }).click();
  await expect(status(page, "Suggestion sent. A moderator will review it.")).toBeVisible();
  await expect(item).toContainText("Suggested for the Links feed. Waiting for a moderator.");
  const other = folder(page, "Links").getByRole("article", { name: "Saved link: A fictional colour wheel note" });
  await other.getByRole("button", { name: /^Suggest for the Links feed/ }).click();
  await other.getByLabel("Exam").selectOption("nid");
  await other.getByLabel("Topic").fill("Colour");
  await other.getByLabel("Why it helps").fill("A short fictional note about the colour wheel.");
  await other.getByRole("button", { name: "Send suggestion" }).click();
  await expect(other).toContainText("Waiting for a moderator.");

  await signIn(page, meera, "/dashboard/community/links");
  await expect(page.getByText("No links in the feed yet.")).toBeVisible();
  await page.getByRole("link", { name: "Review suggested links" }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/review$/);
  const first = page.getByRole("article", { name: `Suggestion from Asha: ${guide.title}` });
  await expect(first).toContainText("Why Asha suggests it: It shows a calm plan");
  await expect(first.getByText(/Also trust/)).toHaveCount(0);
  await first.getByRole("button", { name: "Add to the Links feed" }).click();
  await expect(status(page, "Added to the Links feed.")).toBeVisible();
  const second = page.getByRole("article", { name: "Suggestion from Asha: A fictional colour wheel note" });
  await second.getByRole("button", { name: "Turn down…" }).click();
  await second.getByLabel("Reason shown to Asha").fill("Vague");
  await second.getByRole("button", { name: "Turn down", exact: true }).click();
  await expect(status(page, "Write a reason of 8 to 1,000 characters.")).toBeVisible();
  await second.getByLabel("Reason shown to Asha").fill("Not specific to the design exams");
  await second.getByRole("button", { name: "Turn down", exact: true }).click();
  await expect(status(page, "Suggestion turned down.")).toBeVisible();
  await expect(page.getByText("Nothing to review.")).toBeVisible();

  await signIn(page, asha, "/dashboard/community/links");
  const card = page.getByRole("region", { name: "Links from the internet", exact: true }).getByRole("article");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Link · uceed · Time management");
  await expect(card).toContainText("From Fictional Guides (example.org)");
  await expect(card).toContainText("Shared by Asha (you)");
  await card.getByRole("link", { name: guide.title }).click();
  const reader = page.locator(".community-reader article").first();
  await expect(reader.getByRole("link", { name: /Open on example.org/ })).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  await expect(reader).toContainText("Why you shared it: It shows a calm plan");
  await expect(page.getByRole("link", { name: "Back to links" })).toBeVisible();

  await page.goto("/dashboard/community/saved");
  await expect(folder(page, "Links").getByRole("article", { name: "Saved link: A fictional colour wheel note" })).toContainText("Not added to the Links feed. Reason: Not specific to the design exams");
  await expect(folder(page, "Links").getByRole("article", { name: `Saved link: ${guide.title}` }).getByRole("link", { name: "Open the post in the Links feed" })).toBeVisible();
});

test("an administrator trusts a site so later suggestions publish at once, while social links stay private", async ({ page }) => {
  const state = backend();
  const studio = state.link("https://studio.example.com/perspective", { title: "A fictional perspective exercise" });
  const blog = state.link("https://blog.studio.example.com/sketching", { title: "A fictional sketching routine" });
  const social = state.link("https://www.instagram.com/p/fictional/", { status: "skipped", title: null, site: "www.instagram.com" });
  savedLink(state, ravi, studio); savedLink(state, ravi, blog); savedLink(state, ravi, social, "Links", "Poster idea from a fictional account.");
  state.suggestions.push({ id: uid("e", 1), linkId: studio.id, userId: ravi.id, exam: "nid", topic: "Perspective", note: "A fictional perspective exercise worth trying twice.", status: "pending", createdAt: "2026-11-17T00:00:00.000000+00:00" });
  await state.install(page); await signIn(page, ravi, "/dashboard/community/review");
  await expect(page.getByText("Only moderators review suggested links.")).toBeVisible();
  await page.goto("/dashboard/community/saved");
  const instagram = folder(page, "Links").getByRole("article", { name: "Saved link: www.instagram.com" });
  await expect(instagram).toContainText("Social and messaging pages are not previewed.");
  await expect(instagram).toContainText("Social and messaging links stay in your private folders.");
  await expect(instagram).toContainText("Your note: Poster idea from a fictional account.");
  await expect(instagram.getByRole("button", { name: /Suggest/ })).toHaveCount(0);

  await signIn(page, admin, "/dashboard/community/review");
  const item = page.getByRole("article", { name: "Suggestion from Ravi: A fictional perspective exercise" });
  await item.getByLabel("Also trust studio.example.com").check();
  await item.getByRole("button", { name: "Add to the Links feed" }).click();
  await expect(status(page, "Added to the Links feed and studio.example.com is trusted.")).toBeVisible();
  const trustedSites = page.getByRole("region", { name: "Trusted sites" });
  await expect(trustedSites.getByText("studio.example.com", { exact: true })).toBeVisible();
  await trustedSites.getByLabel("Site to trust").fill("instagram.com");
  await trustedSites.getByRole("button", { name: "Trust site" }).click();
  await expect(status(page, "Links to social or messaging sites stay in your private folders.")).toBeVisible();

  await signIn(page, ravi, "/dashboard/community/saved");
  const routine = folder(page, "Links").getByRole("article", { name: "Saved link: A fictional sketching routine" });
  await routine.getByRole("button", { name: /^Suggest for the Links feed/ }).click();
  await routine.getByLabel("Exam").selectOption("nid");
  await routine.getByLabel("Topic").fill("Sketching");
  await routine.getByLabel("Why it helps").fill("A fictional routine from a trusted studio blog.");
  await routine.getByRole("button", { name: "Send suggestion" }).click();
  await expect(status(page, "Your link is in the Links feed.")).toBeVisible();
  await expect(routine.getByRole("link", { name: "Open the post in the Links feed" })).toBeVisible();

  await signIn(page, admin, "/dashboard/community/review");
  await page.getByRole("region", { name: "Trusted sites" }).getByRole("button", { name: "Stop trusting studio.example.com" }).click();
  await expect(status(page, "studio.example.com is no longer trusted.")).toBeVisible();
  await expect(page.getByText("No trusted sites.")).toBeVisible();
});

test("the link pages pass the accessibility audit without horizontal scroll", async ({ page }) => {
  const state = backend(); state.roles.set(meera.id, { teacher: true, moderator: true });
  const plan = state.link("https://example.org/two-hour-plan/" + "a-very-long-fictional-path-segment".repeat(4), guide);
  savedLink(state, asha, plan, "Links", "Read before the next mock.");
  state.suggestions.push({ id: uid("e", 1), linkId: plan.id, userId: asha.id, exam: "uceed", topic: "Time", note: "A fictional reason that is long enough to send.", status: "pending", createdAt: "2026-11-17T00:00:00.000000+00:00" });
  state.previews.set("https://example.net/colour", { title: "A fictional colour wheel note" });
  await state.install(page); await signIn(page, asha, "/dashboard/community/saved");
  await expect(folder(page, "Links").getByRole("article")).toHaveCount(1);
  await saveForm(page).getByLabel("Web address").fill("https://example.net/colour");
  await saveForm(page).getByRole("button", { name: "Get preview" }).click();
  await expect(saveForm(page).getByLabel("Link preview")).toBeVisible();
  await audit(page); await fitsWidth(page);
  await signIn(page, meera, "/dashboard/community/review");
  await expect(page.getByRole("article", { name: /^Suggestion from Asha/ })).toBeVisible(); await audit(page); await fitsWidth(page);
  await page.getByRole("button", { name: "Add to the Links feed" }).click();
  await expect(page.getByText("Nothing to review.")).toBeVisible();
  await page.goto("/dashboard/community/links");
  await expect(page.getByRole("region", { name: "Links from the internet", exact: true }).getByRole("article")).toHaveCount(1); await audit(page); await fitsWidth(page);
  await page.getByRole("region", { name: "Links from the internet", exact: true }).getByRole("article").getByRole("link").first().click();
  await expect(page.getByRole("link", { name: "Back to links" })).toBeVisible(); await audit(page); await fitsWidth(page);
});

test("the released build keeps the link pages behind Coming later and makes no Community request", async ({ page }) => {
  const provider = await stubPortalProvider(page, () => undefined);
  await page.goto("http://127.0.0.1:4999/"); await seedPortalSession(page, ravi);
  for (const path of ["/dashboard/community/links", "/dashboard/community/review"]) {
    await page.goto("http://127.0.0.1:4999" + path);
    await expect(page.getByText("COMING LATER", { exact: true })).toBeVisible();
  }
  expect(provider.calls).toEqual([]); expect(provider.unexpected).toEqual([]);
});
