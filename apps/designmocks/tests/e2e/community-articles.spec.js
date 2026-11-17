import { expect, test } from "@playwright/test";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { asha, audit as auditPage, backend, body, called, ravi, signIn, uid } from "./community-library-fixture.js";

test.use({ baseURL: portalFixtureURL });
const cards = page => page.getByRole("region", { name: "Community articles", exact: true }).locator("article");
const audit = page => auditPage(page);

test("an article is written with formatting, kept as a draft across a reload, published and read", async ({ page }) => {
  const state = backend(); await state.install(page); await signIn(page, asha, "/dashboard/community/write");
  await expect(page.getByRole("heading", { name: /Write it/ })).toBeVisible();
  await page.getByLabel("Exam", { exact: true }).selectOption("nid");
  await page.getByLabel("Topic", { exact: true }).fill("Studio test");
  await page.getByLabel("Title", { exact: true }).fill("How I planned my studio test week");
  const article = page.getByLabel("Article", { exact: true });
  await article.fill("My plan");
  await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "Heading", exact: true }).click();
  await expect(article).toHaveValue("## My plan");
  await article.fill(body);
  await page.getByRole("group", { name: "Editor view" }).getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Article preview" });
  await expect(preview.getByRole("heading", { name: "My plan", level: 3 })).toBeVisible();
  await expect(preview.getByRole("listitem")).toHaveCount(2);
  await expect(preview.locator("strong")).toHaveText("Warm up");
  await expect(preview.locator("blockquote")).toHaveText("Finish early, review slowly.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Draft (saved at|is up to date)/ })).toBeVisible();
  expect(state.drafts).toHaveLength(1);

  await page.reload();
  const drafts = page.getByRole("region", { name: "Your drafts" });
  await drafts.getByRole("button", { name: "Continue “How I planned my studio test week”" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("How I planned my studio test week");
  await expect(page.getByLabel("Article", { exact: true })).toHaveValue(body);
  await expect(page.getByLabel("Exam", { exact: true })).toHaveValue("nid");

  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/post\/a0000000-0000-4000-8000-000000000001$/);
  const title = page.getByRole("heading", { name: "How I planned my studio test week", level: 2 });
  await expect(title).toBeVisible(); await expect(title).toBeFocused();
  await expect(page.getByText("Your article is published.")).toBeVisible();
  const reader = page.locator(".community-reader article").first();
  await expect(reader.getByRole("heading", { name: "My plan", level: 3 })).toBeVisible();
  await expect(reader.locator("strong")).toHaveText("Warm up");
  await expect(reader).toContainText("By Asha (you)");
  await expect(page.getByRole("button", { name: /^Like/ })).toHaveCount(0); // authors cannot like their own article
  expect(state.posts).toHaveLength(1); expect(state.drafts).toHaveLength(0);
  expect(called(state, "create_community_article")).toHaveLength(1);

  await page.getByRole("navigation", { name: "Community sections" }).getByRole("link", { name: "Articles", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().getByRole("link", { name: "How I planned my studio test week" })).toBeVisible();
  await expect(cards(page).first()).toContainText("My plan An original fictional paragraph");
  await expect(cards(page).first()).not.toContainText("##");
});

test("contact details are refused before and at the server, and markup is never rendered", async ({ page }) => {
  const state = backend(); await state.install(page); await signIn(page, asha, "/dashboard/community/write");
  await page.getByLabel("Topic", { exact: true }).fill("Notes");
  await page.getByLabel("Title", { exact: true }).fill("A fictional title about notes");
  await page.getByLabel("Article", { exact: true }).fill(`${body}\n\nCall 98765 43210 for my notes.`);
  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Remove the phone number"); await expect(alert).toBeFocused();
  expect(called(state, "create_community_article")).toHaveLength(0);

  await page.getByLabel("Article", { exact: true }).fill("too short");
  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("at least 200 characters");

  // The server is the authority even when the browser check passes.
  state.refuseContact = true;
  await page.getByLabel("Article", { exact: true }).fill(`${body}\n\n<img src=x onerror="window.__xss=1"> <script>window.__xss=1</script>`);
  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Remove phone numbers, email addresses, social handles");
  await expect(page.getByRole("alert")).not.toContainText("private-fixture-diagnostic");
  expect(state.posts).toHaveLength(0);
  state.refuseContact = false;
  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/post\//);
  await expect(page.locator(".community-reader article").first()).toContainText('<img src=x onerror="window.__xss=1">');
  await expect(page.locator(".community-reader article img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test("a reader likes and unlikes, and Top follows the likes", async ({ page }) => {
  const state = backend(); state.seed(asha, "An older fictional article on colour"); state.seed(asha, "A newer fictional article on time");
  await state.install(page); await signIn(page, ravi, "/dashboard/community/articles");
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText("A newer fictional article on time");
  await cards(page).nth(1).getByRole("link").click();
  const like = page.getByRole("button", { name: /^Like/ });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  const liked = page.getByRole("button", { name: "Liked · 1", exact: true });
  await expect(liked).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Back to articles" }).click();
  await page.getByRole("group", { name: "Article order" }).getByRole("button", { name: "Top", exact: true }).click();
  await expect(cards(page).first()).toContainText("An older fictional article on colour");
  await expect(cards(page).first()).toContainText("1 like ·");
  await cards(page).first().getByRole("link").click();
  await page.getByRole("button", { name: "Liked · 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Like · 0", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(state.likes.size).toBe(0);
  await page.goto("/dashboard/community/articles");
  await page.getByLabel("Exam", { exact: true }).selectOption("uceed");
  await expect(page.getByText("No articles yet for this exam.")).toBeVisible();
});

test("a reader saves into a new folder, finds it under Saved, renames the folder and removes the save", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "A fictional article worth keeping");
  await state.install(page); await signIn(page, ravi, `/dashboard/community/post/${post.id}`);
  const save = page.getByRole("button", { name: "Save", exact: true });
  await save.click();
  const dialog = page.getByRole("dialog", { name: "Save to folders" });
  await expect(dialog.getByLabel("New folder (optional)")).toHaveValue("Saved");
  await dialog.getByLabel("New folder (optional)").fill("NID studio test");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = page.getByRole("button", { name: "Saved in 1 folder", exact: true });
  await expect(saved).toBeVisible(); await expect(saved).toBeFocused();
  expect(state.saves).toHaveLength(1);

  await saved.click();
  await expect(dialog.getByLabel("NID studio test")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0); await expect(saved).toBeFocused();

  await page.getByRole("navigation", { name: "Community sections" }).getByRole("link", { name: "Saved", exact: true }).click();
  const folder = page.getByRole("region", { name: "Folder NID studio test" });
  await expect(folder.getByRole("link", { name: "A fictional article worth keeping" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your folders" }).getByRole("button", { name: /NID studio test \(1\)/ })).toHaveAttribute("aria-pressed", "true");
  await folder.getByRole("button", { name: "Rename folder" }).click();
  await folder.getByLabel("Folder name").fill("Studio prep");
  await folder.getByRole("button", { name: "Save name" }).click();
  const renamed = page.getByRole("region", { name: "Folder Studio prep" });
  await expect(renamed.getByRole("heading", { name: "Studio prep" })).toBeFocused();

  // A second folder with the same name is refused with a sentence, not a diagnostic.
  await page.getByLabel("New folder", { exact: true }).fill("studio PREP");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByText("You already have a folder with that name.")).toBeVisible();
  await page.getByRole("region", { name: "Your folders" }).getByRole("button", { name: /Studio prep/ }).click();

  await renamed.getByRole("button", { name: "Remove from folder: A fictional article worth keeping" }).click();
  await expect(renamed.getByText("Nothing saved here yet.")).toBeVisible();
  expect(state.saves).toHaveLength(0);
  await renamed.getByRole("button", { name: "Delete folder" }).click();
  await renamed.getByRole("button", { name: "Yes, delete folder" }).click();
  await expect(page.getByText("No folders yet.")).toBeVisible();
  expect(state.folders).toHaveLength(0);
});

test("a reader comments, and blocking an author hides their replies and articles until unblocked", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "A fictional article that starts a conversation");
  const own = state.seed(ravi, "A fictional article by the reader");
  state.comments.push({ id: uid("c", 1), postId: own.id, authorId: asha.id, body: "A fictional reply from the other author.", createdAt: "2026-11-16T00:00:30.000000+00:00" });
  await state.install(page); await signIn(page, ravi, `/dashboard/community/post/${post.id}`);
  const comments = page.getByRole("region", { name: "Comments", exact: true });
  await comments.getByLabel("Add a reply").fill("DM me for the file");
  await comments.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByText("Remove phone numbers, email addresses, social handles")).toBeVisible();
  expect(state.comments).toHaveLength(1);
  await comments.getByLabel("Add a reply").fill("This helped me plan my week. Thank you.");
  await comments.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(comments.getByRole("article", { name: "Comment by Ravi" })).toContainText("This helped me plan my week.");
  expect(state.comments).toHaveLength(2);

  // Block from a reply on the reader's own article: the reply becomes a placeholder.
  await page.goto(`/dashboard/community/post/${own.id}`);
  await page.getByRole("button", { name: "Block author Asha", exact: true }).click();
  await expect(page.getByText("A reply from an author you blocked.")).toBeVisible();
  await expect(page.getByText("A fictional reply from the other author.")).toHaveCount(0);

  // Their articles leave the feed and cannot be opened.
  await page.goto("/dashboard/community/articles");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("A fictional article by the reader");
  await page.goto(`/dashboard/community/post/${post.id}`);
  await expect(page.getByText("This discussion or its images are unavailable.", { exact: false })).toBeVisible();

  await page.goto("/dashboard/community/saved");
  const blocked = page.getByRole("region", { name: "Blocked authors" });
  await blocked.getByRole("button", { name: "Unblock Asha" }).click();
  await expect(page.getByText("Asha is unblocked.")).toBeVisible();
  await page.goto("/dashboard/community/articles");
  await expect(cards(page)).toHaveCount(2);

  // Block from the article itself asks first, then returns to the feed.
  await cards(page).filter({ hasText: "starts a conversation" }).getByRole("link").click();
  await page.getByRole("button", { name: "Block this author" }).click();
  await page.getByRole("button", { name: "Yes, block" }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/articles$/);
  await expect(page.getByText("You blocked Asha.", { exact: false })).toBeVisible();
  await expect(cards(page)).toHaveCount(1);
});

test("the new pages work from the keyboard and pass the accessibility audit without horizontal scroll", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "A fictional article for the keyboard journey " + "LongUnbrokenWord".repeat(6));
  state.folders.push({ id: uid("f", 1), userId: ravi.id, name: "Saved" }); state.saves.push({ userId: ravi.id, postId: post.id, folderId: uid("f", 1), savedAt: "2026-11-16T00:00:40.000000+00:00" });
  await state.install(page); await signIn(page, ravi, "/dashboard/community/articles");
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(cards(page)).toHaveCount(1); await audit(page); await fits();
  const link = cards(page).first().getByRole("link"); await link.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: /keyboard journey/ })).toBeFocused();
  await audit(page); await fits();
  const like = page.getByRole("button", { name: /^Like/ }); await like.focus(); await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Liked · 1", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Saved in 1 folder" }).focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Save to folders" });
  await expect(dialog.getByLabel("Saved", { exact: true })).toBeChecked();
  await auditPage(page, "dialog[open]");
  await page.keyboard.press("Escape");
  await page.goto("/dashboard/community/saved");
  await expect(page.getByRole("region", { name: "Folder Saved" }).getByRole("link")).toBeVisible(); await audit(page); await fits();
  await page.goto("/dashboard/community/write");
  await page.getByLabel("Article", { exact: true }).fill(body);
  await page.getByRole("group", { name: "Editor view" }).getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("region", { name: "Article preview" })).toBeVisible(); await audit(page); await fits();
  await page.getByRole("group", { name: "Editor view" }).getByRole("button", { name: "Write" }).click(); await audit(page);
  // The existing discussions page gains only the section links.
  await page.goto("/dashboard/community/write");
  await expect(page.getByRole("navigation", { name: "Community sections" }).getByRole("link")).toHaveText(["Articles", "Discussions", "Unanswered", "Work", "Saved", "Write"]);
});

test("the released build keeps every Community page behind Coming later and makes no Community request", async ({ page }) => {
  const provider = await stubPortalProvider(page, () => undefined);
  await page.goto("http://127.0.0.1:4999/"); await seedPortalSession(page, ravi);
  for (const path of ["/dashboard/community/articles", "/dashboard/community/write", "/dashboard/community/saved", "/dashboard/community/post/a0000000-0000-4000-8000-000000000001"]) {
    await page.goto("http://127.0.0.1:4999" + path);
    await expect(page.getByText("COMING LATER", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Community.", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Community sections" })).toHaveCount(0);
  }
  expect(provider.calls).toEqual([]); expect(provider.unexpected).toEqual([]);
});
