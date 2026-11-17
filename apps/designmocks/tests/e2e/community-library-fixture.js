import { expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalIdentity } from "./portal-fixture.js";
import { contactDetails } from "../../src/community-article.mjs";

// An in-memory model of the Community phase 1 and 2 server functions, for
// browser journeys. Fictional accounts and original fixture text only.
export const asha = { id: "00000000-0000-4000-8000-000000000911", email: "community-author@example.invalid", name: "Asha" };
export const ravi = { id: "00000000-0000-4000-8000-000000000912", email: "community-reader@example.invalid", name: "Ravi" };
export const meera = { id: "00000000-0000-4000-8000-000000000913", email: "community-teacher@example.invalid", name: "Meera" };
export const kabir = { id: "00000000-0000-4000-8000-000000000914", email: "community-student@example.invalid", name: "Kabir" };
export const admin = { id: "00000000-0000-4000-8000-000000000915", email: "community-admin@example.invalid", name: "Admin" };
const people = [asha, ravi, meera, kabir, admin], names = Object.fromEntries(people.map(person => [person.id, person.name]));
const api = "https://dmocks-portal-fixture.supabase.co";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, content-profile, accept-profile, prefer", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const paragraph = "An original fictional paragraph about planning a sketching routine before the studio test. ";
export const body = `## My plan\n\n${paragraph.repeat(3)}\n\n- **Warm up** with ten gesture sketches\n- Time one full composition\n\n> Finish early, review slowly.`;
export const uid = (kind, n) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const excerpt = text => text.replace(/(\*\*|\*|^#{2,3}\s+|^>\s?|^-\s+)/gm, "").replace(/\s+/g, " ").trim().slice(0, 400);

export function backend() {
  const state = { posts: [], comments: [], likes: new Set(), folders: [], saves: [], drafts: [], blocks: new Set(), receipts: new Map(), calls: [], clock: 0, refuseContact: false,
    roles: new Map(), admins: new Set([admin.id]), sanctions: [], featured: new Set(), revisions: [] };
  const now = () => `2026-11-16T00:${String(Math.floor(++state.clock / 60)).padStart(2, "0")}:${String(state.clock % 60).padStart(2, "0")}.000000+00:00`;
  const fail = (details, code = "22023") => ({ status: code === "42501" ? 403 : 400, value: { code, details, message: "private-fixture-diagnostic" } });
  const ok = value => ({ status: 200, value });
  const blocked = (actor, author) => state.blocks.has(`${actor}:${author}`);
  const readable = (actor, id) => state.posts.find(post => post.id === id && post.status !== "hidden" && !blocked(actor, post.authorId));
  const likes = id => [...state.likes].filter(key => key.endsWith(":" + id)).length;
  const teacher = user => Boolean(state.roles.get(user)?.teacher), moderator = user => Boolean(state.roles.get(user)?.moderator), isAdmin = user => state.admins.has(user);
  const sanction = user => state.sanctions.find(item => item.userId === user && !item.liftedAt) ?? null;
  const visibleComments = post => state.comments.filter(item => item.postId === post.id && item.status !== "hidden");
  const accepted = post => visibleComments(post).some(item => item.id === post.acceptedCommentId) ? post.acceptedCommentId : null;
  const base = (actor, post) => ({ id: post.id, exam: post.exam, topic: post.topic, title: post.title, excerpt: excerpt(post.body), author: names[post.authorId], teacher: teacher(post.authorId),
    createdAt: post.createdAt, status: post.status, comments: visibleComments(post).length, likes: likes(post.id), liked: state.likes.has(`${actor}:${post.id}`),
    saved: state.saves.some(save => save.userId === actor && save.postId === post.id), isMine: post.authorId === actor, words: post.body.split(/\s+/).length });
  const card = (actor, post) => ({ ...base(actor, post), kind: post.kind, answered: Boolean(accepted(post)), assetCount: post.assetCount ?? 0 });
  const comment = (actor, item) => {
    const hidden = blocked(actor, item.authorId);
    return { id: item.id, parentId: null, body: hidden ? "" : item.body, author: hidden ? "Blocked author" : names[item.authorId], helpful: 0, blocked: hidden, createdAt: item.createdAt,
      teacher: teacher(item.authorId), isMine: item.authorId === actor, canAttach: false, canReply: true, markedHelpful: false, parentAvailable: false, parentPreview: null, assetCount: 0 };
  };
  const thread = (actor, post, from = 0) => ({ id: post.id, title: post.title, body: post.body, exam: post.exam, topic: post.topic, status: post.status, isMine: post.authorId === actor,
    canAttach: post.authorId === actor && post.status === "visible", assetCount: 0, version: post.version ?? 1, nextCursor: null,
    comments: visibleComments(post).slice(from).map(item => comment(actor, item)),
    kind: post.kind, createdAt: post.createdAt, author: names[post.authorId], likes: likes(post.id), liked: state.likes.has(`${actor}:${post.id}`),
    folderIds: state.saves.filter(save => save.userId === actor && save.postId === post.id).map(save => save.folderId).sort(),
    teacher: teacher(post.authorId), editedAt: post.editedAt ?? null, acceptedCommentId: accepted(post),
    canAccept: post.authorId === actor && post.kind === "discussion" && post.status === "visible", canEdit: post.authorId === actor && post.status === "visible",
    canHold: moderator(actor) || isAdmin(actor), canSanction: isAdmin(actor),
    canFeature: post.kind !== "discussion" && post.status === "visible" && (teacher(actor) || isAdmin(actor)), featured: state.featured.has(post.id) });
  const paused = actor => sanction(actor) ? fail("community_sanctioned", "P0001") : null;
  const receipt = post => ({ id: post.id, postId: post.id, parentId: null, status: "visible", postStatus: "visible", canUpload: true, replayed: false });
  const handlers = {
    public_all_india_top_ten: () => ok([]),
    // Role probes the portal makes when a second account signs in.
    can_review_drawings: () => ok(false),
    is_dmocks_admin: actor => ok(isAdmin(actor)),
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
      if (paused(actor)) return paused(actor);
      const post = state.seed({ id: actor }, input.p_title, { exam: input.p_exam, topic: input.p_topic, body: input.p_body });
      state.drafts = state.drafts.filter(draft => draft.id !== input.p_draft_id);
      state.receipts.set(key, receipt(post)); return ok(receipt(post));
    },
    create_community_work(actor, input) {
      const key = `${actor}:${input.p_request_id}`;
      if (state.receipts.has(key)) return ok({ ...state.receipts.get(key), replayed: true });
      if (contactDetails(`${input.p_topic}\n${input.p_title}\n${input.p_intent}\n${input.p_request}`)) return fail("community_contact_details");
      if (paused(actor)) return paused(actor);
      const post = state.seed({ id: actor }, input.p_title, { kind: "work", exam: input.p_exam, topic: input.p_topic,
        body: `## What I was trying to do\n\n${input.p_intent}\n\n## What I want feedback on\n\n${input.p_request}` });
      state.receipts.set(key, receipt(post)); return ok(receipt(post));
    },
    community_articles(actor, input) {
      let rows = state.posts.filter(post => post.kind === "article" && readable(actor, post.id) && (!input.p_exam || post.exam === input.p_exam))
        .sort((a, b) => (input.p_sort === "top" ? likes(b.id) - likes(a.id) : 0) || b.createdAt.localeCompare(a.createdAt));
      if (input.p_cursor) rows = rows.slice(rows.findIndex(post => post.id === input.p_cursor.id) + 1);
      const page = rows.slice(0, input.p_limit), last = page.at(-1);
      return ok({ articles: page.map(post => base(actor, post)), sort: input.p_sort, exam: input.p_exam,
        nextCursor: input.p_sort === "latest" && rows.length > page.length ? { createdAt: last.createdAt, id: last.id } : null });
    },
    community_cards(actor, input) {
      const rows = state.posts.filter(post => readable(actor, post.id) && (!input.p_exam || post.exam === input.p_exam) &&
        (input.p_view === "work" ? post.kind === "work" : post.kind === "discussion" && post.status === "visible" && !accepted(post)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, input.p_limit);
      return ok({ cards: rows.map(post => card(actor, post)), nextCursor: null, view: input.p_view, exam: input.p_exam });
    },
    community_featured_list: actor => ok({ cards: [...state.featured].map(id => readable(actor, id)).filter(post => post && post.status === "visible").map(post => card(actor, post)) }),
    my_community_standing(actor) {
      const s = sanction(actor);
      return ok({ teacher: teacher(actor), moderator: moderator(actor), sanction: s && { kind: s.kind, until: s.until, reason: s.reason } });
    },
    community_thread(actor, input) { const post = readable(actor, input.p_post_id); return post ? ok(thread(actor, post)) : fail("community_target_unavailable", "42501"); },
    community_reply_context(actor, input) {
      const post = readable(actor, input.p_post_id), all = post ? visibleComments(post) : [], index = all.findIndex(item => item.id === input.p_anchor_id);
      return post && index >= 0 ? ok({ ...thread(actor, post, index), anchorId: input.p_anchor_id, hasEarlier: index > 0 }) : fail("community_target_unavailable", "42501");
    },
    add_community_comment(actor, input) {
      if (contactDetails(input.p_body)) return fail("community_contact_details");
      if (paused(actor)) return paused(actor);
      const item = { id: uid("c", state.comments.length + 1), postId: input.p_post_id, authorId: actor, body: input.p_body, status: "visible", createdAt: now() };
      state.comments.push(item);
      return ok({ id: item.id, postId: item.postId, parentId: null, status: "visible", postStatus: "visible", canUpload: true, replayed: false });
    },
    accept_community_answer(actor, input) {
      const post = state.posts.find(item => item.id === input.p_post_id && item.authorId === actor && item.kind === "discussion" && item.status === "visible");
      if (!post || (input.p_comment_id && !visibleComments(post).some(item => item.id === input.p_comment_id && item.authorId !== actor))) return fail("community_target_unavailable", "42501");
      post.acceptedCommentId = input.p_comment_id; return ok({ postId: post.id, acceptedCommentId: input.p_comment_id });
    },
    edit_community_post(actor, input) {
      const post = state.posts.find(item => item.id === input.p_post_id && item.authorId === actor && item.status === "visible");
      if (!post) return fail("community_target_unavailable", "42501");
      if (input.p_version !== (post.version ?? 1)) return fail("community_thread_changed", "40001");
      if (contactDetails(`${input.p_topic}\n${input.p_title}\n${input.p_body}`)) return fail("community_contact_details");
      if (paused(actor)) return paused(actor);
      if (post.topic === input.p_topic && post.title === input.p_title && post.body === input.p_body) return ok({ id: post.id, version: post.version ?? 1, editedAt: post.editedAt ?? null, changed: false });
      state.revisions.push({ postId: post.id, title: post.title, topic: post.topic, body: post.body, replacedAt: now() });
      Object.assign(post, { topic: input.p_topic, title: input.p_title, body: input.p_body, editedAt: now(), version: (post.version ?? 1) + 1 });
      return ok({ id: post.id, version: post.version, editedAt: post.editedAt, changed: true });
    },
    admin_community_post_revisions(actor, input) {
      if (!isAdmin(actor)) return fail("admin", "42501");
      const post = state.posts.find(item => item.id === input.p_post_id);
      return ok({ postId: post.id, current: { title: post.title, topic: post.topic, body: post.body, kind: post.kind, status: post.status, editedAt: post.editedAt ?? null },
        revisions: state.revisions.filter(item => item.postId === post.id).reverse().map(({ postId, ...item }) => item) });
    },
    set_community_featured(actor, input) {
      if (!teacher(actor) && !isAdmin(actor)) return fail("community_teacher_required", "42501");
      if (input.p_featured) state.featured.add(input.p_post_id); else state.featured.delete(input.p_post_id);
      return ok({ postId: input.p_post_id, featured: input.p_featured });
    },
    moderator_hold_community(actor, input) {
      if (!moderator(actor) && !isAdmin(actor)) return fail("community_moderator_required", "42501");
      const target = (input.p_target_type === "post" ? state.posts : state.comments).find(item => item.id === input.p_target_id && item.status !== "hidden");
      if (!target) return fail("community_target_unavailable", "42501");
      if (target.authorId === actor) return fail("community_hold_own");
      target.status = "hidden"; state.holds = [...(state.holds ?? []), { actor, ...input }];
      return ok({ targetType: input.p_target_type, targetId: input.p_target_id, status: "hidden" });
    },
    admin_community_sanction(actor, input) {
      if (!isAdmin(actor)) return fail("admin", "42501");
      const target = (input.p_target_type === "post" ? state.posts : state.comments).find(item => item.id === input.p_target_id);
      if (!target) return fail("community_target_unavailable", "42501");
      for (const item of state.sanctions) if (item.userId === target.authorId) item.liftedAt = now();
      const item = { id: uid("b", state.sanctions.length + 1), userId: target.authorId, kind: input.p_kind, until: input.p_kind === "mute" ? "2026-11-23T00:00:00.000000+00:00" : null,
        reason: input.p_reason, createdAt: now(), days: input.p_days };
      state.sanctions.push(item); return ok({ id: item.id, kind: item.kind, until: item.until });
    },
    admin_community_roles: actor => isAdmin(actor) ? ok({ roles: [...state.roles].filter(([, role]) => role.teacher).map(([user, role]) => ({ email: people.find(p => p.id === user).email,
      name: names[user], teacher: true, moderator: role.moderator, updatedAt: "2026-11-16T00:00:00.000000+00:00" })) }) : fail("admin", "42501"),
    admin_set_community_role(actor, input) {
      if (!isAdmin(actor)) return fail("admin", "42501");
      const person = people.find(p => p.email === input.p_email);
      if (!person) return fail("community_role_unknown", "P0001");
      if (input.p_teacher) state.roles.set(person.id, { teacher: true, moderator: input.p_moderator }); else state.roles.delete(person.id);
      return ok({ email: input.p_email, teacher: input.p_teacher, moderator: input.p_moderator });
    },
    admin_community_sanctions: actor => isAdmin(actor) ? ok({ sanctions: state.sanctions.filter(item => !item.liftedAt).map(item => ({ id: item.id,
      email: people.find(p => p.id === item.userId).email, name: names[item.userId], kind: item.kind, until: item.until, reason: item.reason, createdAt: item.createdAt })) }) : fail("admin", "42501"),
    admin_lift_community_sanction(actor, input) {
      if (!isAdmin(actor)) return fail("admin", "42501");
      const item = state.sanctions.find(s => s.id === input.p_sanction_id && !s.liftedAt);
      if (item) item.liftedAt = now(); return ok({ lifted: Boolean(item) });
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
  // fallback(name, actor) answers procedures outside Community, such as the admin page's reads.
  state.install = async (page, fallback = null) => {
    await page.route(api + "/rest/v1/rpc/**", async route => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ headers, status: 204 });
      const name = new URL(request.url()).pathname.split("/").at(-1), input = request.postDataJSON() ?? {};
      let actor; try { actor = JSON.parse(Buffer.from(request.headers().authorization.split(" ")[1].split(".")[1], "base64url")).sub; } catch { /* signed out */ }
      state.calls.push([name, input, actor]);
      let result;
      if (handlers[name]) result = actor ? handlers[name](actor, input) : fail("sign_in", "42501");
      else {
        const value = fallback?.(name, actor);
        if (value === undefined) throw new Error("Unexpected fictional Community procedure: " + name);
        result = ok(value);
      }
      try { await route.fulfill({ headers, status: result.status, json: result.value }); } catch { /* page moved on */ }
    });
    await stubPortalIdentity(page);
  };
  state.seed = (author, title, extra = {}) => {
    const post = { id: uid("a", state.posts.length + 1), kind: "article", authorId: author.id, exam: "nid", topic: "Studio test", title, body, status: "visible", version: 1, createdAt: now(), ...extra };
    state.posts.push(post); return post;
  };
  state.reply = (author, post, text) => {
    const item = { id: uid("c", state.comments.length + 1), postId: post.id, authorId: author.id, body: text, status: "visible", createdAt: now() };
    state.comments.push(item); return item;
  };
  return state;
}

// The first sign-in opens the app; switching accounts later replaces the stored
// session in place, so the account page's own reads are not involved.
export async function signIn(page, actor, path) {
  if (!page.url().startsWith(portalFixtureURL)) await page.goto("/account");
  await seedPortalSession(page, actor); await page.goto(path);
}
export const called = (state, name) => state.calls.filter(call => call[0] === name);
export async function audit(page, selector = ".community-page") {
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async selector => (await window.axe.run(selector, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations
    .map(item => `${item.id}: ${item.nodes.map(node => node.target.join(" ")).join(" | ")}`), selector)).toEqual([]);
}
export async function fitsWidth(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
