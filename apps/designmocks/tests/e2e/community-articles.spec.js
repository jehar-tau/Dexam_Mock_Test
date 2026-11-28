import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalIdentity, stubPortalProvider } from "./portal-fixture.js";
import { contactDetails } from "../../src/community-article.mjs";

test.use({ baseURL: portalFixtureURL });
// Fictional accounts and original fixture text only.
const asha = { id: "00000000-0000-4000-8000-000000000911", email: "community-author@example.invalid", name: "Asha" };
const ravi = { id: "00000000-0000-4000-8000-000000000912", email: "community-reader@example.invalid", name: "Ravi" };
const names = { [asha.id]: asha.name, [ravi.id]: ravi.name };
const api = "https://dmocks-portal-fixture.supabase.co";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, content-profile, accept-profile, prefer", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const paragraph = "An original fictional paragraph about planning a sketching routine before the studio test. ";
const body = `## My plan\n\n${paragraph.repeat(3)}\n\n- **Warm up** with ten gesture sketches\n- Time one full composition\n\n> Finish early, review slowly.`;
const uid = (kind, n) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const excerpt = text => text.replace(/(\*\*|\*|^#{2,3}\s+|^>\s?|^-\s+)/gm, "").replace(/\s+/g, " ").trim().slice(0, 400);

// A small in-memory model of the phase 1 server functions.
function backend() {
  const state = { posts: [], comments: [], likes: new Set(), folders: [], saves: [], drafts: [], blocks: new Set(), receipts: new Map(), calls: [], clock: 0, refuseContact: false };
  const now = () => `2026-11-16T00:00:${String(++state.clock).padStart(2, "0")}.000000+00:00`;
  const fail = (details, code = "22023") => ({ status: code === "42501" ? 403 : 400, value: { code, details, message: "private-fixture-diagnostic" } });
  const blocked = (actor, author) => state.blocks.has(`${actor}:${author}`);
  const readable = (actor, id) => state.posts.find(post => post.id === id && post.status !== "hidden" && !blocked(actor, post.authorId));
  const likes = id => [...state.likes].filter(key => key.endsWith(":" + id)).length;
  const card = (actor, post) => ({ id: post.id, exam: post.exam, topic: post.topic, title: post.title, excerpt: excerpt(post.body), author: names[post.authorId], createdAt: post.createdAt,
    status: post.status, comments: state.comments.filter(item => item.postId === post.id).length, likes: likes(post.id), liked: state.likes.has(`${actor}:${post.id}`),
    saved: state.saves.some(save => save.userId === actor && save.postId === post.id), isMine: post.authorId === actor, words: post.body.split(/\s+/).length });
  const comment = (actor, item) => {
    const hidden = blocked(actor, item.authorId);
    return { id: item.id, parentId: null, body: hidden ? "" : item.body, author: hidden ? "Blocked author" : names[item.authorId], helpful: 0, blocked: hidden, createdAt: item.createdAt,
      isMine: item.authorId === actor, canAttach: false, canReply: true, markedHelpful: false, parentAvailable: false, parentPreview: null, assetCount: 0 };
  };
  const thread = (actor, post, from = 0) => ({ id: post.id, title: post.title, body: post.body, exam: post.exam, topic: post.topic, status: post.status, isMine: post.authorId === actor,
    canAttach: false, assetCount: 0, version: 1, nextCursor: null, comments: state.comments.filter(item => item.postId === post.id).slice(from).map(item => comment(actor, item)),
    kind: post.kind, createdAt: post.createdAt, author: names[post.authorId], likes: likes(post.id), liked: state.likes.has(`${actor}:${post.id}`),
    folderIds: state.saves.filter(save => save.userId === actor && save.postId === post.id).map(save => save.folderId).sort() });
  const ok = value => ({ status: 200, value });
  const handlers = {
    public_all_india_top_ten: () => ok([]),
    community_drafts: actor => ok({ drafts: state.drafts.filter(draft => draft.userId === actor).map(({ userId, ...draft }) => draft) }),
    save_community_draft(actor, input) {
      let draft = state.drafts.find(item => item.id === input.p_draft_id && item.userId === actor);
      if (input.p_draft_id && !draft) return fail("community_draft_unavailable", "42501");
      if (!draft) { draft = { id: uid("d", state.drafts.length + 1), userId: actor }; state.drafts.unshift(draft); }
      Object.assign(draft, { exam: input.p_exam, topic: input.p_topic, title: input.p_title, body: input.p_body, updatedAt: now() });
      return ok({ id: draft.id, updatedAt: draft.updatedAt });
    },
    delete_community_draft(actor, input) { state.drafts = state.drafts.filter(draft => !(draft.id === input.p_draft_id && draft.userId === actor)); return ok({ id: input.p_draft_id }); },
    create_community_article(actor, input) {
      const key = `${actor}:${input.p_request_id}`;
      if (state.receipts.has(key)) return ok({ ...state.receipts.get(key), replayed: true });
      if (state.refuseContact || contactDetails(`${input.p_topic}\n${input.p_title}\n${input.p_body}`)) return fail("community_contact_details");
      const post = { id: uid("a", state.posts.length + 1), kind: "article", authorId: actor, exam: input.p_exam, topic: input.p_topic, title: input.p_title, body: input.p_body, status: "visible", createdAt: now() };
      state.posts.push(post); state.drafts = state.drafts.filter(draft => draft.id !== input.p_draft_id);
      const receipt = { id: post.id, postId: post.id, parentId: null, status: "visible", postStatus: "visible", canUpload: true, replayed: false };
      state.receipts.set(key, receipt); return ok(receipt);
    },
    community_articles(actor, input) {
      let rows = state.posts.filter(post => post.kind === "article" && readable(actor, post.id) && (!input.p_exam || post.exam === input.p_exam))
        .sort((a, b) => (input.p_sort === "top" ? likes(b.id) - likes(a.id) : 0) || b.createdAt.localeCompare(a.createdAt));
      if (input.p_cursor) rows = rows.slice(rows.findIndex(post => post.id === input.p_cursor.id) + 1);
      const page = rows.slice(0, input.p_limit), last = page.at(-1);
      return ok({ articles: page.map(post => card(actor, post)), sort: input.p_sort, exam: input.p_exam,
        nextCursor: input.p_sort === "latest" && rows.length > page.length ? { createdAt: last.createdAt, id: last.id } : null });
    },
    community_thread(actor, input) { const post = readable(actor, input.p_post_id); return post ? ok(thread(actor, post)) : fail("community_target_unavailable", "42501"); },
    community_reply_context(actor, input) {
      const post = readable(actor, input.p_post_id), all = state.comments.filter(item => item.postId === input.p_post_id), index = all.findIndex(item => item.id === input.p_anchor_id);
      return post && index >= 0 ? ok({ ...thread(actor, post, index), anchorId: input.p_anchor_id, hasEarlier: index > 0 }) : fail("community_target_unavailable", "42501");
    },
    add_community_comment(actor, input) {
      if (contactDetails(input.p_body)) return fail("community_contact_details");
      const item = { id: uid("c", state.comments.length + 1), postId: input.p_post_id, authorId: actor, body: input.p_body, createdAt: now() };
      state.comments.push(item);
      return ok({ id: item.id, postId: item.postId, parentId: null, status: "visible", postStatus: "visible", canUpload: true, replayed: false });
    },
    set_community_like(actor, input) {
      const post = readable(actor, input.p_post_id);
      if (!post) return fail("community_target_unavailable", "42501");
      if (post.authorId === actor) return fail("community_like_own");
      if (input.p_liked) state.likes.add(`${actor}:${post.id}`); else state.likes.delete(`${actor}:${post.id}`);
      return ok({ postId: post.id, liked: input.p_liked, likes: likes(post.id) });
    },
    community_folders: actor => ok({ folders: state.folders.filter(folder => folder.userId === actor).sort((a, b) => a.name.localeCompare(b.name))
      .map(folder => ({ id: folder.id, name: folder.name, count: state.saves.filter(save => save.folderId === folder.id).length })) }),
    save_community_folder(actor, input) {
      if (state.folders.some(folder => folder.userId === actor && folder.id !== input.p_folder_id && folder.name.toLowerCase() === input.p_name.toLowerCase())) return fail("community_folder_exists", "23505");
      let folder = state.folders.find(item => item.id === input.p_folder_id && item.userId === actor);
      if (!folder) { folder = { id: uid("f", state.folders.length + 1), userId: actor }; state.folders.push(folder); }
      folder.name = input.p_name;
      return ok({ id: folder.id, name: folder.name, count: state.saves.filter(save => save.folderId === folder.id).length });
    },
    delete_community_folder(actor, input) {
      state.folders = state.folders.filter(folder => !(folder.id === input.p_folder_id && folder.userId === actor));
      state.saves = state.saves.filter(save => save.folderId !== input.p_folder_id); return ok({ id: input.p_folder_id });
    },
    set_community_saves(actor, input) {
      if (!readable(actor, input.p_post_id)) return fail("community_target_unavailable", "42501");
      state.saves = state.saves.filter(save => !(save.userId === actor && save.postId === input.p_post_id));
      for (const folderId of input.p_folder_ids) state.saves.push({ userId: actor, postId: input.p_post_id, folderId, savedAt: now() });
      return ok({ postId: input.p_post_id, folderIds: [...input.p_folder_ids].sort() });
    },
    remove_community_save(actor, input) {
      const before = state.saves.length;
      state.saves = state.saves.filter(save => !(save.userId === actor && save.postId === input.p_post_id && save.folderId === input.p_folder_id));
      return ok({ removed: state.saves.length < before });
    },
    community_saved(actor, input) {
      const folder = state.folders.find(item => item.id === input.p_folder_id && item.userId === actor);
      if (!folder) return fail("community_folder_unavailable", "42501");
      return ok({ folder: { id: folder.id, name: folder.name }, nextCursor: null, items: state.saves.filter(save => save.folderId === folder.id).map(save => {
        const post = readable(actor, save.postId);
        return post ? { postId: post.id, savedAt: save.savedAt, available: true, kind: post.kind, exam: post.exam, topic: post.topic, title: post.title, excerpt: excerpt(post.body), author: names[post.authorId] }
          : { postId: save.postId, savedAt: save.savedAt, available: false };
      }) });
    },
    set_community_block(actor, input) {
      const author = input.p_post_id ? state.posts.find(post => post.id === input.p_post_id)?.authorId : state.comments.find(item => item.id === input.p_comment_id)?.authorId;
      if (!author) return fail("community_target_unavailable", "42501");
      if (author === actor) return fail("community_block_self");
      state.blocks.add(`${actor}:${author}`); return ok({ blocked: true });
    },
    community_blocked: actor => ok({ blocked: [...state.blocks].filter(key => key.startsWith(actor + ":")).map(key => ({ handle: "b".repeat(52) + key.slice(-12), author: names[key.split(":")[1]], createdAt: "2026-11-16T00:00:00.000000+00:00" })) }),
    remove_community_block(actor, input) {
      const key = [...state.blocks].find(item => item.startsWith(actor + ":") && item.endsWith(input.p_handle.slice(-12)));
      if (key) state.blocks.delete(key); return ok({ removed: Boolean(key) });
    },
  };
  state.install = async page => {
    await page.route(api + "/rest/v1/rpc/**", async route => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ headers, status: 204 });
      const name = new URL(request.url()).pathname.split("/").at(-1), input = request.postDataJSON() ?? {};
      let actor; try { actor = JSON.parse(Buffer.from(request.headers().authorization.split(" ")[1].split(".")[1], "base64url")).sub; } catch { /* signed out */ }
      if (!handlers[name]) throw new Error("Unexpected fictional Community procedure: " + name);
      state.calls.push([name, input, actor]);
      const result = actor ? handlers[name](actor, input) : fail("sign_in", "42501");
      try { await route.fulfill({ headers, status: result.status, json: result.value }); } catch { /* page moved on */ }
    });
    await stubPortalIdentity(page);
  };
  state.seed = (author, title, extra = {}) => { const post = { id: uid("a", state.posts.length + 1), kind: "article", authorId: author.id, exam: "nid", topic: "Studio test", title, body, status: "visible", createdAt: now(), ...extra }; state.posts.push(post); return post; };
  return state;
}
async function signIn(page, actor, path) { await page.goto("/account"); await seedPortalSession(page, actor); await page.goto(path); }
const called = (state, name) => state.calls.filter(call => call[0] === name);
const cards = page => page.getByRole("region", { name: "Community articles", exact: true }).locator("article");
async function audit(page) {
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".community-page", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(" ")).join(" | ")}`))).toEqual([]);
}


// Types into the rich editor the way a student does: "## " starts a heading,
// "- " a list, "**…**" bold and "> " a quote. Returns the stored text it produces.
async function typeArticle(page, { short = false } = {}) {
  const editor = page.getByRole("textbox", { name: "Article", exact: true });
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A"); await page.keyboard.press("Backspace");
  if (short) { await page.keyboard.type("too short"); return "too short"; }
  await page.keyboard.type("## My plan"); await page.keyboard.press("Enter");
  await page.keyboard.type(paragraph.repeat(3).trim()); await page.keyboard.press("Enter");
  await page.keyboard.type("- **Warm up** with ten gesture sketches"); await page.keyboard.press("Enter");
  await page.keyboard.type("Time one full composition"); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
  await page.keyboard.type("> Finish early, review slowly.");
  return `## My plan\n\n${paragraph.repeat(3).trim()}\n\n- **Warm up** with ten gesture sketches\n- Time one full composition\n\n> Finish early, review slowly.`;
}

test("an article is written with formatting, kept as a draft across a reload, published and read", async ({ page }, info) => {
  const state = backend(); await state.install(page); await signIn(page, asha, "/dashboard/community/write");
  await expect(page.getByRole("heading", { name: /Write it/ })).toBeVisible();
  await page.getByLabel("Exam", { exact: true }).selectOption("nid");
  await page.getByLabel("Topic", { exact: true }).fill("Studio test");
  await page.getByLabel("Title", { exact: true }).fill("How I planned my studio test week");
  const article = page.getByRole("textbox", { name: "Article", exact: true });
  const stored = await typeArticle(page);
  // What you see while writing is the formatted article.
  await expect(article.getByRole("heading", { name: "My plan", level: 2 })).toBeVisible();
  await expect(article.getByRole("listitem")).toHaveCount(2);
  await expect(article.locator("strong")).toHaveText("Warm up");
  await expect(article.locator("blockquote")).toHaveText("Finish early, review slowly.");
  // Selecting text shows the small formatting bar.
  await article.getByRole("heading", { name: "My plan" }).dblclick();
  const bar = page.getByRole("toolbar", { name: "Format selected text" });
  await expect(bar.getByRole("button", { name: "Heading", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Exam", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("write-editor.png") });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Draft (saved at|is up to date)/ })).toBeVisible();
  expect(state.drafts).toHaveLength(1);
  expect(state.drafts[0].body).toBe(stored);

  await page.reload();
  const drafts = page.getByRole("region", { name: "Your drafts" });
  await drafts.getByRole("button", { name: "Continue “How I planned my studio test week”" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("How I planned my studio test week");
  await expect(page.getByRole("textbox", { name: "Article", exact: true }).getByRole("heading", { name: "My plan", level: 2 })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Article", exact: true }).locator("blockquote")).toHaveText("Finish early, review slowly.");
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
  await typeArticle(page); await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await page.keyboard.type("Call 98765 43210 for my notes.");
  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Remove the phone number"); await expect(alert).toBeFocused();
  expect(called(state, "create_community_article")).toHaveLength(0);

  await typeArticle(page, { short: true });
  await page.getByRole("button", { name: "Publish article", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("at least 200 characters");

  // The server is the authority even when the browser check passes.
  state.refuseContact = true;
  await typeArticle(page); await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await page.keyboard.type(`<img src=x onerror="window.__xss=1"> <script>window.__xss=1</script>`);
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

test("one tap saves a post and a guide; Saved lists both in one place and removes them", async ({ page }) => {
  const state = backend(); const post = state.seed(asha, "A fictional article worth keeping");
  await state.install(page); await signIn(page, ravi, `/dashboard/community/post/${post.id}`);
  const save = page.getByRole("button", { name: "Save", exact: true });
  await save.click();
  const saved = page.getByRole("button", { name: "Saved", exact: true });
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saved. Find it under Saved.")).toBeVisible();
  expect(state.saves).toHaveLength(1);
  expect(state.folders.map(folder => folder.name)).toEqual(["Saved"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/dashboard/community/read/how-to-review-a-mock-test");
  await page.getByRole("button", { name: /^Save: How to review a mock test/ }).click();
  await expect(page.getByRole("button", { name: /^Saved: How to review a mock test/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("navigation", { name: "Community sections" }).getByRole("link", { name: "Saved", exact: true }).click();
  const guides = page.getByRole("region", { name: "Guides" }), posts = page.getByRole("region", { name: "From students" });
  await expect(guides.getByRole("link", { name: /How to review a mock test/ })).toBeVisible();
  await expect(posts.getByRole("link", { name: "A fictional article worth keeping" })).toBeVisible();
  await expect(page.getByText(/folder/i)).toHaveCount(0);
  await posts.getByRole("button", { name: "Remove from Saved: A fictional article worth keeping" }).click();
  await expect(posts.getByText("Tap Save on a student’s article or discussion to keep it here.")).toBeVisible();
  expect(state.saves).toHaveLength(0);
  await guides.getByRole("button", { name: /^Remove from Saved: How to review a mock test/ }).click();
  await expect(guides.getByText(/to keep it here/)).toBeVisible();

  // Saving again reuses the same "Saved" folder.
  await page.goto(`/dashboard/community/post/${post.id}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  expect(state.folders).toHaveLength(1);
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  expect(state.saves).toHaveLength(0);
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
  await expect(page).toHaveURL(/\/dashboard\/community$/);
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
  const savedButton = page.getByRole("button", { name: "Saved", exact: true });
  await expect(savedButton).toHaveAttribute("aria-pressed", "true");
  await savedButton.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await expect(savedButton).toHaveAttribute("aria-pressed", "true");
  await page.goto("/dashboard/community/saved");
  await expect(page.getByRole("region", { name: "From students" }).getByRole("link")).toBeVisible(); await audit(page); await fits();
  await page.goto("/dashboard/community/write");
  await typeArticle(page);
  await expect(page.getByRole("textbox", { name: "Article", exact: true }).getByRole("heading", { name: "My plan" })).toBeVisible(); await audit(page); await fits();
  // The existing discussions page gains only the section links.
  await page.goto("/dashboard/community/write");
  await expect(page.getByRole("navigation", { name: "Community sections" }).getByRole("link")).toHaveText(["Articles", "Discussions", "Saved", "Write"]);
});

test("the released build keeps every Community page behind Coming later and makes no Community request", async ({ page }) => {
  const provider = await stubPortalProvider(page, () => undefined);
  await page.goto("http://127.0.0.1:4999/"); await seedPortalSession(page, ravi);
  for (const path of ["/dashboard/community", "/dashboard/community/articles", "/dashboard/community/discussions", "/dashboard/community/read/how-to-review-a-mock-test", "/dashboard/community/write", "/dashboard/community/saved", "/dashboard/community/post/a0000000-0000-4000-8000-000000000001"]) {
    await page.goto("http://127.0.0.1:4999" + path);
    await expect(page.getByText("COMING LATER", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Community.", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Community sections" })).toHaveCount(0);
  }
  expect(provider.calls).toEqual([]); expect(provider.unexpected).toEqual([]);
});

test("Articles opens with the DMocks guides, filters them and reads one", async ({ page }) => {
  const state = backend(); await state.install(page); await signIn(page, ravi, "/dashboard/community");
  const guides = page.getByRole("region", { name: "Guides from DMocks" }).locator(".editorial-feed > li");
  await expect(guides.first()).toBeVisible();
  const total = await guides.count(); expect(total).toBeGreaterThanOrEqual(20);
  await expect(guides.locator("img.editorial-photo")).toHaveCount(8); // openly licensed photos on some covers
  await expect(guides.first()).toContainText("Snehalkumar Shinde, NID Bengaluru");
  await expect(page.getByRole("link", { name: "Write an article" }).first()).toHaveAttribute("href", "/dashboard/community/write");
  await page.getByRole("group", { name: "Article theme" }).getByRole("button", { name: "Mindset", exact: true }).click();
  await expect(guides).not.toHaveCount(total);
  for (const text of await guides.locator(".eyebrow").allTextContents()) expect(text).toMatch(/^Mindset/);
  await page.getByRole("group", { name: "Article theme" }).getByRole("button", { name: "All", exact: true }).click();
  await expect(guides).toHaveCount(total);
  await audit(page);
  await guides.first().getByRole("heading").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/community\/read\/how-to-review-a-mock-test$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator(".editorial-byline")).toContainText("Snehalkumar Shinde");
  await expect(page.locator(".editorial-byline")).toContainText("NID Bengaluru");
  await expect(page.getByRole("complementary", { name: "About the author" })).toContainText("studied design at NID Bengaluru");
  await expect(page.getByRole("region", { name: "Keep reading" }).locator("li")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await audit(page);
  await page.getByRole("link", { name: "← All articles" }).click();
  await expect(page).toHaveURL(/\/dashboard\/community$/);
  // A photo cover loads and carries its credit in the reader.
  await page.goto("/dashboard/community/read/drawing-when-you-think-you-cannot-draw");
  const photo = page.locator(".editorial-reader figure img.editorial-photo");
  await expect(photo).toHaveAttribute("src", "/learn-images/warli.jpg");
  await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".editorial-reader figcaption")).toContainText("via Wikimedia Commons");
  await audit(page);
});
