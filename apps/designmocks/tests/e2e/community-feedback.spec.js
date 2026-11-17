import { expect, test } from "@playwright/test";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { admin, asha, audit, backend, called, fitsWidth, kabir, meera, ravi, signIn } from "./community-library-fixture.js";

test.use({ baseURL: portalFixtureURL });
const question = { kind: "discussion", exam: "uceed", topic: "Time management", body: "An original fictional question about splitting two hours across the sections of a paper." };
const comments = page => page.getByRole("region", { name: "Comments", exact: true });
const comment = (page, name) => comments(page).getByRole("article", { name: `Comment by ${name}`, exact: true });
const status = (page, text) => page.getByRole("status").filter({ hasText: text });

test("a student shares work for feedback, and a teacher's structured feedback is labelled and listed first", async ({ page }) => {
  const state = backend(); state.roles.set(meera.id, { teacher: true, moderator: false });
  await state.install(page); await signIn(page, ravi, "/dashboard/community/work/new");
  await expect(page.getByRole("heading", { name: /Ask for/ })).toBeVisible();
  await page.getByLabel("Exam", { exact: true }).selectOption("nid");
  await page.getByLabel("Topic", { exact: true }).fill("Poster design");
  await page.getByLabel("Title", { exact: true }).fill("My first fictional poster for review");
  await page.getByLabel("What I was trying to do").fill("Calm poster");
  await page.getByLabel("What I want feedback on").fill("Is the hierarchy clear from far away? DM me for the file.");
  await page.getByRole("button", { name: "Post and add images" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("Describe what you were trying to do in 20 to 2,000 characters.");
  await expect(alert).toContainText("invitation to contact you");
  expect(called(state, "create_community_work")).toHaveLength(0);
  await page.getByLabel("What I was trying to do").fill("A calm poster for a fictional book fair, made in forty minutes.");
  await page.getByLabel("What I want feedback on").fill("Is the hierarchy clear from far away, and does the type fit the mood?");
  await page.getByRole("button", { name: "Post and add images" }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/post\/a0000000-0000-4000-8000-000000000001$/);
  await expect(page.getByText("Your work is posted. Now add up to three images of it below.")).toBeVisible();
  const work = page.locator(".community-reader article").first();
  await expect(work).toContainText("Work for feedback · nid · Poster design");
  await expect(work.getByRole("heading", { name: "What I want feedback on", level: 3 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add images of your work" })).toBeVisible();

  state.reply(kabir, state.posts[0], "A fictional student reply: I like the colours.");
  await signIn(page, meera, `/dashboard/community/post/${state.posts[0].id}`);
  await comments(page).getByRole("button", { name: "Use the feedback structure" }).click();
  const reply = comments(page).getByLabel("Add a reply");
  await expect(reply).toHaveValue("What works:\n\nWhat to improve:\n\nHow to improve it:\n");
  await expect(reply).toBeFocused();
  await reply.fill("What works: the calm palette.\n\nWhat to improve: the headline is small.\n\nHow to improve it: double its size and give it more space.");
  await comments(page).getByRole("button", { name: "Reply", exact: true }).click();
  await expect(comment(page, "Meera")).toContainText("By Meera · Teacher");
  // After a reply the page shows it and what follows; reading from the start shows every reply.
  await page.reload();
  await expect(comments(page).getByRole("article")).toHaveCount(2);
  await expect(comments(page).getByRole("article").first()).toHaveAccessibleName("Comment by Meera");
  await expect(comments(page).getByRole("article").nth(1)).toHaveAccessibleName("Comment by Kabir");
  await expect(comment(page, "Meera").locator(".community-comment-body")).toHaveCSS("white-space", "pre-line");

  await page.getByRole("link", { name: "Back to work" }).click();
  const list = page.getByRole("region", { name: "Work for feedback", exact: true });
  await expect(list.getByRole("article")).toHaveCount(1);
  await expect(list.getByRole("article").first()).toContainText("By Ravi · 16 Nov 2026 · 0 images · 0 likes · 2 pieces of feedback");
});

test("only the asker accepts an answer, and an answered question leaves Unanswered", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "How do you split the two hours?", question);
  state.reply(ravi, post, "I spend twenty minutes on the first section, then check the clock."); state.reply(kabir, post, "I do the sketching first.");
  await state.install(page); await signIn(page, asha, "/dashboard/community/unanswered");
  const list = page.getByRole("region", { name: "Unanswered questions", exact: true });
  await list.getByRole("link", { name: "How do you split the two hours?" }).click();
  await expect(page.getByText("When a reply answers your question, choose Accept as answer on it.")).toBeVisible();
  await comment(page, "Ravi").getByRole("button", { name: "Accept as answer" }).click();
  await expect(status(page, "You accepted Ravi’s reply as the answer.")).toBeVisible();
  await expect(comment(page, "Ravi").getByText("Accepted answer", { exact: true })).toBeVisible();
  await expect(comment(page, "Ravi").getByRole("button", { name: "Clear accepted answer" })).toHaveAttribute("aria-pressed", "true");
  await expect(comment(page, "Kabir").getByText("Accepted answer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Go to the accepted answer" }).click();
  await expect(comment(page, "Ravi")).toBeFocused();
  expect(state.posts[0].acceptedCommentId).toBe(state.comments[0].id);

  await page.goto("/dashboard/community/unanswered");
  await expect(page.getByText("Every question has an accepted answer.")).toBeVisible();

  await signIn(page, ravi, `/dashboard/community/post/${post.id}`);
  await expect(page.getByText("This question has an accepted answer.")).toBeVisible();
  await expect(comment(page, "Ravi").getByText("Accepted answer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Accept as answer|Clear accepted answer/ })).toHaveCount(0);

  await signIn(page, asha, `/dashboard/community/post/${post.id}`);
  await comment(page, "Ravi").getByRole("button", { name: "Clear accepted answer" }).click();
  await expect(status(page, "The accepted answer is cleared.")).toBeVisible();
  await page.goto("/dashboard/community/unanswered");
  await expect(page.getByRole("region", { name: "Unanswered questions", exact: true }).getByRole("article")).toHaveCount(1);
});

test("an author edits a published article, a stale edit is refused, and the administrator sees earlier versions", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "How I planned my studio test week");
  await state.install(page); await signIn(page, asha, `/dashboard/community/post/${post.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const form = page.getByRole("form", { name: "Edit post" });
  await form.getByLabel("Title").fill("How I planned my studio test fortnight");
  await form.getByRole("button", { name: "Save changes" }).click();
  const title = page.getByRole("heading", { level: 2, name: "How I planned my studio test fortnight" });
  await expect(title).toBeFocused();
  await expect(status(page, "Your changes are saved. Earlier versions are kept for moderators.")).toBeVisible();
  await expect(page.locator(".community-byline")).toContainText("· Edited 16 Nov 2026");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Text").fill(post.body + "\n\nCall 98765 43210 for the plan.");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(form.getByRole("alert")).toContainText("Remove the phone number");
  await expect(form.getByRole("alert")).toBeFocused();
  expect(called(state, "edit_community_post")).toHaveLength(1);
  state.posts[0].version += 1; // another device saved meanwhile
  await form.getByLabel("Text").fill(post.body + "\n\nA second fictional paragraph.");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(status(page, "This post changed while you were editing. Reload it, then make your change again.")).toBeVisible();
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(title).toBeFocused();

  await signIn(page, admin, `/dashboard/community/post/${post.id}`);
  const history = page.getByRole("group", { name: "Moderation" }).getByRole("button", { name: "Edit history" });
  await history.click();
  const dialog = page.getByRole("dialog", { name: "Edit history" });
  await expect(dialog.getByRole("region", { name: "Version replaced 16 Nov 2026" })).toContainText("How I planned my studio test week");
  await expect(dialog).toContainText("How I planned my studio test fortnight");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(history).toBeFocused();
});

test("teachers feature work and articles on a shelf that every member sees", async ({ page }) => {
  const state = backend(); state.roles.set(meera.id, { teacher: true, moderator: false });
  const post = state.seed(asha, "Three mistakes I made in my first fictional mock");
  await state.install(page); await signIn(page, ravi, `/dashboard/community/post/${post.id}`);
  await expect(page.getByRole("heading", { level: 2, name: post.title })).toBeVisible();
  await expect(page.getByRole("button", { name: /featured|Feature/ })).toHaveCount(0);
  await signIn(page, meera, `/dashboard/community/post/${post.id}`);
  const feature = page.getByRole("button", { name: "Feature on Articles" });
  await feature.click();
  await expect(status(page, "Added to the featured shelf on Articles.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove from featured" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".community-reader article .eyebrow").first()).toContainText("· Featured");
  await signIn(page, ravi, "/dashboard/community/articles");
  const shelf = page.getByRole("region", { name: "Featured by teachers" });
  await expect(shelf.getByRole("link", { name: post.title })).toBeVisible();
  await signIn(page, meera, `/dashboard/community/post/${post.id}`);
  await page.getByRole("button", { name: "Remove from featured" }).click();
  await expect(status(page, "Removed from the featured shelf.")).toBeVisible();
  await page.goto("/dashboard/community/articles");
  await expect(page.getByRole("region", { name: "Community articles", exact: true }).locator("article")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Featured by teachers" })).toHaveCount(0);
});

test("a moderator holds a reply and a post for an administrator's review", async ({ page }) => {
  const state = backend(); state.roles.set(meera.id, { teacher: true, moderator: true });
  const work = state.seed(ravi, "A fictional poster that drew an unkind reply", { kind: "work", body: "## What I was trying to do\n\nA fictional calm poster for a fair.\n\n## What I want feedback on\n\nIs the type clear?" });
  state.reply(kabir, work, "An unkind fictional reply that a moderator will hold.");
  state.reply(meera, work, "What works: the colour. What to improve: the type size.");
  await state.install(page); await signIn(page, meera, `/dashboard/community/post/${work.id}`);
  await expect(comment(page, "Meera").getByRole("button", { name: "Hold reply" })).toHaveCount(0);
  const hold = comment(page, "Kabir").getByRole("button", { name: "Hold reply" });
  await hold.click();
  const dialog = page.getByRole("dialog", { name: "Hold for review" });
  await expect(dialog).toContainText("An unkind fictional reply");
  await dialog.getByLabel("Note for the administrator").fill("Rude");
  await dialog.getByRole("button", { name: "Hold for review" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Write a reason of 8 to 1,000 characters.");
  await dialog.getByLabel("Note for the administrator").fill("Unkind reply to a student");
  await dialog.getByRole("button", { name: "Hold for review" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(status(page, "Reply held for review.")).toBeVisible();
  await expect(comment(page, "Kabir")).toHaveCount(0);
  expect(state.comments[0].status).toBe("hidden");

  await page.getByRole("group", { name: "Moderation" }).getByRole("button", { name: "Hold for review" }).click();
  await page.getByRole("dialog", { name: "Hold for review" }).getByLabel("Note for the administrator").fill("Checking the image rights first");
  await page.getByRole("dialog", { name: "Hold for review" }).getByRole("button", { name: "Hold for review" }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/work$/);
  await expect(page.getByText("Held for review. An administrator will decide whether to restore it.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Work for feedback", exact: true }).getByRole("article")).toHaveCount(0);
  expect(state.holds.map(item => item.p_note)).toEqual(["Unkind reply to a student", "Checking the image rights first"]);
});

test("an administrator pauses an author, who sees why and cannot post until the pause is lifted from the admin page", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "How do you split the two hours?", question);
  state.reply(kabir, post, "An unkind fictional reply that earns a pause.");
  await state.install(page, name => emptyAdminRead(name));
  await signIn(page, admin, `/dashboard/community/post/${post.id}`);
  await comment(page, "Kabir").getByRole("button", { name: "Pause author" }).click();
  const dialog = page.getByRole("dialog", { name: "Pause this author" });
  await expect(dialog.getByLabel("For a number of days")).toBeChecked();
  await dialog.getByLabel("Days (1 to 365)").fill("400");
  await dialog.getByLabel("Reason shown to the author").fill("Repeated unkind replies to other students");
  await dialog.getByRole("button", { name: "Pause author" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Choose a pause of 1 to 365 days.");
  await dialog.getByLabel("Days (1 to 365)").fill("7");
  await dialog.getByRole("button", { name: "Pause author" }).click();
  await expect(status(page, "The author is paused.")).toBeVisible();
  expect(state.sanctions).toMatchObject([{ userId: kabir.id, kind: "mute", days: 7, reason: "Repeated unkind replies to other students" }]);

  await signIn(page, kabir, "/dashboard/community/write");
  await expect(page.getByText("Posting is paused for your account until 23 Nov 2026. Reason: Repeated unkind replies to other students You can still read, like and save.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish article" })).toBeDisabled();
  await page.goto(`/dashboard/community/post/${post.id}`);
  await comments(page).getByLabel("Add a reply").fill("A fictional reply while paused.");
  await comments(page).getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByText("Posting is paused for your account. Open Write to see why and for how long.")).toBeVisible();
  expect(state.comments).toHaveLength(1);

  await signIn(page, admin, "/admin");
  const panel = page.getByRole("region", { name: "Community roles and pauses" });
  await expect(panel.getByText("community-student@example.invalid · until 23 Nov 2026 · Repeated unkind replies to other students")).toBeVisible();
  await panel.getByRole("button", { name: "Lift pause for community-student@example.invalid" }).click();
  await expect(panel.getByRole("status")).toHaveText("community-student@example.invalid can post again.");
  await expect(panel.getByText("Nobody is paused.", { exact: false })).toBeVisible();

  await panel.getByLabel("Account email").fill("nobody@example.invalid");
  await panel.getByRole("button", { name: "Save role" }).click();
  await expect(panel.getByRole("status")).toHaveText("No DMocks account uses that email address.");
  await panel.getByLabel("Account email").fill(" Community-Teacher@example.invalid ");
  await panel.getByRole("checkbox", { name: /^Moderator/ }).check();
  await panel.getByRole("button", { name: "Save role" }).click();
  await expect(panel.getByRole("status")).toHaveText("community-teacher@example.invalid is now a teacher and moderator.");
  await expect(panel.getByText("Meera · community-teacher@example.invalid · Teacher and moderator")).toBeVisible();
  expect(state.roles.get(meera.id)).toEqual({ teacher: true, moderator: true });
  await panel.getByRole("button", { name: "Remove roles from community-teacher@example.invalid" }).click();
  await expect(panel.getByText("No teachers yet.")).toBeVisible();
  await audit(page, ".community-staff");

  await signIn(page, kabir, `/dashboard/community/post/${post.id}`);
  await comments(page).getByLabel("Add a reply").fill("A kinder fictional reply after the pause.");
  await comments(page).getByRole("button", { name: "Reply", exact: true }).click();
  await expect(comment(page, "Kabir").filter({ hasText: "A kinder fictional reply" })).toBeVisible();
});

test("the phase 2 pages and staff dialogs pass the accessibility audit without horizontal scroll", async ({ page }) => {
  const state = backend(); state.roles.set(meera.id, { teacher: true, moderator: true });
  const work = state.seed(ravi, "A fictional poster " + "LongUnbrokenTitle".repeat(5), { kind: "work", body: "## What I was trying to do\n\nA fictional calm poster.\n\n## What I want feedback on\n\nIs the type clear?" });
  const ask = state.seed(asha, "How do you split the two hours?", question);
  state.reply(kabir, work, "What works:\n\nThe colours.\n\nWhat to improve:\n\nThe type.");
  await state.install(page); await signIn(page, meera, "/dashboard/community/work");
  await expect(page.getByRole("region", { name: "Work for feedback", exact: true }).getByRole("article")).toHaveCount(1); await audit(page); await fitsWidth(page);
  await page.goto("/dashboard/community/unanswered");
  await expect(page.getByRole("region", { name: "Unanswered questions", exact: true }).getByRole("link", { name: ask.title })).toBeVisible(); await audit(page); await fitsWidth(page);
  await page.goto("/dashboard/community/work/new");
  await expect(page.getByRole("button", { name: "Post and add images" })).toBeVisible(); await audit(page); await fitsWidth(page);
  await page.goto(`/dashboard/community/post/${work.id}`);
  await expect(comment(page, "Kabir")).toBeVisible(); await audit(page); await fitsWidth(page);
  await comment(page, "Kabir").getByRole("button", { name: "Hold reply" }).click();
  await audit(page, "dialog[open]");
  await page.keyboard.press("Escape");
  await expect(comment(page, "Kabir").getByRole("button", { name: "Hold reply" })).toBeFocused();
  await signIn(page, admin, `/dashboard/community/post/${work.id}`);
  await page.getByRole("group", { name: "Moderation" }).getByRole("button", { name: "Pause this author" }).click();
  await expect(page.getByRole("dialog", { name: "Pause this author" })).toBeVisible(); await audit(page, "dialog[open]");
  await page.keyboard.press("Escape");
  await signIn(page, asha, `/dashboard/community/post/${ask.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("form", { name: "Edit post" })).toBeVisible(); await audit(page); await fitsWidth(page);
});

test("the released build keeps the phase 2 pages behind Coming later and makes no Community request", async ({ page }) => {
  const provider = await stubPortalProvider(page, () => undefined);
  await page.goto("http://127.0.0.1:4999/"); await seedPortalSession(page, ravi);
  for (const path of ["/dashboard/community/work", "/dashboard/community/work/new", "/dashboard/community/unanswered"]) {
    await page.goto("http://127.0.0.1:4999" + path);
    await expect(page.getByText("COMING LATER", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Community.", exact: true })).toBeVisible();
  }
  expect(provider.calls).toEqual([]); expect(provider.unexpected).toEqual([]);
});
