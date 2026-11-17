import { expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { portalFixtureURL, seedPortalSession, stubPortalIdentity } from "./portal-fixture.js";
import { contactDetails } from "../../src/community-article.mjs";
import { isSocialHost, normalizeLinkUrl } from "../../supabase/functions/_shared/community-link.mjs";

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
    roles: new Map(), admins: new Set([admin.id]), sanctions: [], featured: new Set(), revisions: [],
    links: [], linkSaves: [], notes: [], suggestions: [], trusted: new Set(), previews: new Map(), previewCalls: [], tokens: [], extensionCalls: [] };
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
  const linkJson = link => ({ id: link.id, url: link.url, host: link.host, status: link.status, title: link.title, site: link.site, description: link.description, fetchedAt: link.fetchedAt ?? "2026-11-17T00:00:00.000000+00:00" });
  const tokenUser = token => state.tokens.find(item => item.token === token && !item.revoked)?.userId ?? null;
  const linkOf = post => post.kind === "link" ? linkJson(state.links.find(link => link.id === post.linkId)) : null;
  const card = (actor, post) => ({ ...base(actor, post), kind: post.kind, answered: Boolean(accepted(post)), assetCount: post.assetCount ?? 0, link: linkOf(post) });
  const trusted = host => [...state.trusted].some(item => host === item || host.endsWith("." + item));
  const publish = (suggestion, reviewer) => {
    const link = state.links.find(item => item.id === suggestion.linkId);
    if (paused(suggestion.userId)) return paused(suggestion.userId);
    const post = state.seed({ id: suggestion.userId }, link.title ?? link.host, { kind: "link", exam: suggestion.exam, topic: suggestion.topic, body: suggestion.note, linkId: link.id });
    Object.assign(suggestion, { status: "approved", postId: post.id, reviewer });
    return null;
  };
  const comment = (actor, item) => {
    const hidden = blocked(actor, item.authorId);
    return { id: item.id, parentId: null, body: hidden ? "" : item.body, author: hidden ? "Blocked author" : names[item.authorId], helpful: 0, blocked: hidden, createdAt: item.createdAt,
      teacher: teacher(item.authorId), isMine: item.authorId === actor, canAttach: false, canReply: true, markedHelpful: false, parentAvailable: false, parentPreview: null, assetCount: 0 };
  };
  const thread = (actor, post, from = 0) => ({ id: post.id, title: post.title, body: post.body, exam: post.exam, topic: post.topic, status: post.status, isMine: post.authorId === actor,
    canAttach: post.authorId === actor && post.status === "visible", assetCount: 0, version: post.version ?? 1, nextCursor: null,
    comments: visibleComments(post).slice(from).map(item => comment(actor, item)),
    kind: post.kind, createdAt: post.createdAt, author: names[post.authorId], likes: likes(post.id), liked: state.likes.has(`${actor}:${post.id}`),
    folderIds: state.saves.filter(save => save.userId === actor && save.postId === post.id).map(save => save.folderId).sort(), link: linkOf(post),
    teacher: teacher(post.authorId), editedAt: post.editedAt ?? null, acceptedCommentId: accepted(post),
    canAccept: post.authorId === actor && post.kind === "discussion" && post.status === "visible", canEdit: post.authorId === actor && post.status === "visible",
    canHold: moderator(actor) || isAdmin(actor), canSanction: isAdmin(actor),
    canFeature: (post.kind === "article" || post.kind === "work") && post.status === "visible" && (teacher(actor) || isAdmin(actor)), featured: state.featured.has(post.id) });
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
        (input.p_view === "work" ? post.kind === "work" : input.p_view === "links" ? post.kind === "link" : post.kind === "discussion" && post.status === "visible" && !accepted(post)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, input.p_limit);
      return ok({ cards: rows.map(post => card(actor, post)), nextCursor: null, view: input.p_view, exam: input.p_exam });
    },
    community_featured_list: actor => ok({ cards: [...state.featured].map(id => readable(actor, id)).filter(post => post && post.status === "visible").map(post => card(actor, post)) }),
    my_community_standing(actor) {
      const s = sanction(actor);
      return ok({ admin: isAdmin(actor), teacher: teacher(actor), moderator: moderator(actor), sanction: s && { kind: s.kind, until: s.until, reason: s.reason } });
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
      .map(folder => ({ id: folder.id, name: folder.name, count: state.saves.filter(save => save.folderId === folder.id).length + state.linkSaves.filter(save => save.folderId === folder.id).length })) }),
    save_community_folder(actor, input) {
      if (state.folders.some(folder => folder.userId === actor && folder.id !== input.p_folder_id && folder.name.toLowerCase() === input.p_name.toLowerCase())) return fail("community_folder_exists", "23505");
      let folder = state.folders.find(item => item.id === input.p_folder_id && item.userId === actor);
      if (!folder) { folder = { id: uid("f", state.folders.length + 1), userId: actor }; state.folders.push(folder); }
      folder.name = input.p_name;
      return ok({ id: folder.id, name: folder.name, count: state.saves.filter(save => save.folderId === folder.id).length });
    },
    delete_community_folder(actor, input) {
      state.folders = state.folders.filter(folder => !(folder.id === input.p_folder_id && folder.userId === actor));
      state.saves = state.saves.filter(save => save.folderId !== input.p_folder_id);
      state.linkSaves = state.linkSaves.filter(save => save.folderId !== input.p_folder_id); return ok({ id: input.p_folder_id });
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
      const posts = state.saves.filter(save => save.folderId === folder.id).map(save => {
        const post = readable(actor, save.postId);
        return post ? { type: "post", id: post.id, postId: post.id, savedAt: save.savedAt, available: true, kind: post.kind, exam: post.exam, topic: post.topic, title: post.title,
          excerpt: excerpt(post.body), author: names[post.authorId], note: null } : { type: "post", id: save.postId, postId: save.postId, savedAt: save.savedAt, available: false };
      });
      const links = state.linkSaves.filter(save => save.folderId === folder.id).map(save => {
        const link = state.links.find(item => item.id === save.linkId), mine = state.suggestions.filter(item => item.userId === actor && item.linkId === link.id).at(-1);
        return { type: "link", id: link.id, savedAt: save.savedAt, link: linkJson(link), note: state.notes.find(item => item.userId === actor && item.linkId === link.id)?.body ?? null,
          suggestion: mine ? { status: mine.status, postId: mine.postId ?? null, reason: mine.reason ?? null } : null,
          postId: state.posts.find(post => post.linkId === link.id && post.status !== "hidden")?.id ?? null };
      });
      return ok({ folder: { id: folder.id, name: folder.name }, nextCursor: null, items: [...posts, ...links].sort((a, b) => b.savedAt.localeCompare(a.savedAt)) });
    },
    save_community_link(actor, input) {
      if (!state.links.some(link => link.id === input.p_link_id)) return fail("community_link_unavailable", "42501");
      if (input.p_folder_ids.some(id => !state.folders.some(folder => folder.id === id && folder.userId === actor))) return fail("community_folder_unavailable", "42501");
      state.linkSaves = state.linkSaves.filter(save => !(save.userId === actor && save.linkId === input.p_link_id && !input.p_folder_ids.includes(save.folderId)));
      for (const folderId of input.p_folder_ids) if (!state.linkSaves.some(save => save.userId === actor && save.linkId === input.p_link_id && save.folderId === folderId))
        state.linkSaves.push({ userId: actor, linkId: input.p_link_id, folderId, savedAt: now() });
      state.notes = state.notes.filter(item => !(item.userId === actor && item.linkId === input.p_link_id));
      const note = (input.p_note ?? "").trim();
      if (note) state.notes.push({ userId: actor, linkId: input.p_link_id, body: note });
      return ok({ linkId: input.p_link_id, folderIds: [...input.p_folder_ids].sort(), note: note || null });
    },
    remove_community_link_save(actor, input) {
      const before = state.linkSaves.length;
      state.linkSaves = state.linkSaves.filter(save => !(save.userId === actor && save.linkId === input.p_link_id && save.folderId === input.p_folder_id));
      return ok({ removed: state.linkSaves.length < before });
    },
    suggest_community_link(actor, input) {
      const link = state.links.find(item => item.id === input.p_link_id);
      if (paused(actor)) return paused(actor);
      if (!link || !state.linkSaves.some(save => save.userId === actor && save.linkId === link.id)) return fail("community_link_unavailable", "42501");
      if (isSocialHost(link.host)) return fail("community_link_social");
      if (contactDetails(`${input.p_topic}\n${input.p_note}`)) return fail("community_contact_details");
      if (state.posts.some(post => post.linkId === link.id)) return fail("community_link_posted", "P0001");
      const suggestion = { id: uid("e", state.suggestions.length + 1), linkId: link.id, userId: actor, exam: input.p_exam, topic: input.p_topic, note: input.p_note, status: "pending", createdAt: now() };
      state.suggestions.push(suggestion);
      if (trusted(link.host)) { publish(suggestion, null); return ok({ id: suggestion.id, status: "approved", postId: suggestion.postId }); }
      return ok({ id: suggestion.id, status: "pending", postId: null });
    },
    community_link_review_queue(actor) {
      if (!moderator(actor) && !isAdmin(actor)) return fail("community_moderator_required", "42501");
      return ok({ canTrust: isAdmin(actor), items: state.suggestions.filter(item => item.status === "pending").map(item => {
        const link = state.links.find(other => other.id === item.linkId);
        return { id: item.id, link: linkJson(link), author: names[item.userId], isMine: item.userId === actor, exam: item.exam, topic: item.topic, note: item.note, createdAt: item.createdAt, social: isSocialHost(link.host) };
      }) });
    },
    review_community_link_suggestion(actor, input) {
      if (!moderator(actor) && !isAdmin(actor)) return fail("community_moderator_required", "42501");
      if (input.p_trust && !isAdmin(actor)) return fail("community_admin_required", "42501");
      const suggestion = state.suggestions.find(item => item.id === input.p_id && item.status === "pending");
      if (!suggestion) return fail("community_link_unavailable", "42501");
      if (suggestion.userId === actor) return fail("community_review_own");
      if (!input.p_approve) { Object.assign(suggestion, { status: "rejected", reason: input.p_reason }); return ok({ id: suggestion.id, status: "rejected", postId: null }); }
      const refused = publish(suggestion, actor); if (refused) return refused;
      if (input.p_trust) state.trusted.add(state.links.find(link => link.id === suggestion.linkId).host);
      return ok({ id: suggestion.id, status: "approved", postId: suggestion.postId });
    },
    create_community_extension_token(actor, input) {
      if (state.tokens.filter(item => item.userId === actor && !item.revoked).length >= 5) return fail("community_extension_limit", "P0001");
      const item = { id: uid("d", 100 + state.tokens.length), userId: actor, label: input.p_label || "Browser", token: "dmx_" + randomBytes(32).toString("hex"),
        createdAt: "2026-11-17T00:00:00.000000+00:00", lastUsedAt: null, expiresAt: "2027-05-16T00:00:00.000000+00:00", revoked: false };
      state.tokens.push(item);
      return ok({ id: item.id, label: item.label, token: item.token, createdAt: item.createdAt, expiresAt: item.expiresAt });
    },
    community_extension_tokens: actor => ok({ tokens: state.tokens.filter(item => item.userId === actor && !item.revoked)
      .map(({ id, label, createdAt, lastUsedAt, expiresAt }) => ({ id, label, createdAt, lastUsedAt, expiresAt })) }),
    revoke_community_extension_token(actor, input) {
      const item = state.tokens.find(other => other.id === input.p_id && other.userId === actor && !other.revoked);
      if (item) item.revoked = true; return ok({ revoked: Boolean(item) });
    },
    extension_community_folders(_actor, input) {
      const user = tokenUser(input.p_token);
      if (!user) return fail("community_extension_token", "42501");
      state.tokens.find(item => item.token === input.p_token).lastUsedAt = "2026-11-17T01:00:00.000000+00:00";
      return ok({ folders: state.folders.filter(folder => folder.userId === user).map(folder => ({ id: folder.id, name: folder.name })) });
    },
    extension_save_community_link(_actor, input) {
      const user = tokenUser(input.p_token);
      if (!user) return fail("community_extension_token", "42501");
      let normalized; try { normalized = normalizeLinkUrl(input.p_url); } catch { return fail("community_link_invalid"); }
      if (normalized.url !== input.p_url) return fail("community_link_invalid");
      if (input.p_folder_ids.some(id => !state.folders.some(folder => folder.id === id && folder.userId === user))) return fail("community_folder_unavailable", "42501");
      const ids = [...input.p_folder_ids];
      if (input.p_new_folder) {
        let folder = state.folders.find(item => item.userId === user && item.name.toLowerCase() === input.p_new_folder.toLowerCase());
        if (!folder) { folder = { id: uid("f", state.folders.length + 1), userId: user, name: input.p_new_folder }; state.folders.push(folder); }
        ids.push(folder.id);
      }
      if (!ids.length) return fail("community_invalid_input");
      let link = state.links.find(item => item.url === normalized.url);
      if (!link) {
        link = { id: uid("f", 100 + state.links.length), url: normalized.url, host: normalized.host, status: isSocialHost(normalized.host) ? "skipped" : "unavailable",
          title: null, site: null, description: null, fetchedAt: "1970-01-01T00:00:00+00:00" };
        state.links.push(link);
      }
      for (const folderId of ids) if (!state.linkSaves.some(save => save.userId === user && save.linkId === link.id && save.folderId === folderId))
        state.linkSaves.push({ userId: user, linkId: link.id, folderId, savedAt: now() });
      if (input.p_note) { state.notes = state.notes.filter(item => !(item.userId === user && item.linkId === link.id)); state.notes.push({ userId: user, linkId: link.id, body: input.p_note }); }
      state.extensionCalls.push(input);
      return ok({ linkId: link.id, folderIds: [...new Set(ids)].sort() });
    },
    admin_community_trusted_hosts: actor => isAdmin(actor) ? ok({ hosts: [...state.trusted].sort().map(host => ({ host, createdAt: "2026-11-17T00:00:00.000000+00:00" })) }) : fail("admin", "42501"),
    admin_set_community_trusted_host(actor, input) {
      if (!isAdmin(actor)) return fail("admin", "42501");
      const host = input.p_host.trim().toLowerCase();
      if (isSocialHost(host)) return fail("community_link_social");
      if (input.p_trusted) state.trusted.add(host); else state.trusted.delete(host);
      return ok({ host, trusted: input.p_trusted });
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
      // The extension calls with the public key and its own connection key, never a session.
      if (handlers[name] && name.startsWith("extension_")) result = handlers[name](null, input);
      else if (handlers[name]) result = actor ? handlers[name](actor, input) : fail("sign_in", "42501");
      else {
        const value = fallback?.(name, actor);
        if (value === undefined) throw new Error("Unexpected fictional Community procedure: " + name);
        result = ok(value);
      }
      try { await route.fulfill({ headers, status: result.status, json: result.value }); } catch { /* page moved on */ }
    });
    // Link previews arrive through the community-media function's link action.
    await page.route(api + "/functions/v1/community-media", async route => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ headers, status: 204 });
      const input = request.postDataJSON() ?? {};
      if (input.action !== "link") throw new Error("Unexpected fictional media request");
      state.previewCalls.push(input.url);
      let normalized; try { normalized = normalizeLinkUrl(input.url); } catch (error) { return route.fulfill({ headers, status: 400, json: { error: "private", code: error.code } }); }
      let link = state.links.find(item => item.url === normalized.url);
      if (link && link.fetchedAt?.startsWith("1970")) {
        const known = state.previews.get(normalized.url);
        Object.assign(link, { status: "fetched", title: known?.title ?? "A fictional page", site: known?.site ?? null, description: known?.description ?? null, fetchedAt: "2026-11-17T02:00:00.000000+00:00" });
      }
      if (!link) {
        const known = state.previews.get(normalized.url), social = isSocialHost(normalized.host);
        link = { id: uid("f", 100 + state.links.length), url: normalized.url, host: normalized.host, status: social ? "skipped" : known?.status ?? "fetched",
          title: social ? null : known?.title ?? "A fictional page", site: social ? normalized.host : known?.site ?? null, description: social ? null : known?.description ?? null };
        state.links.push(link);
      }
      return route.fulfill({ headers, status: 200, json: { link: linkJson(link) } });
    });
    await stubPortalIdentity(page);
  };
  state.seed = (author, title, extra = {}) => {
    const post = { id: uid("a", state.posts.length + 1), kind: "article", authorId: author.id, exam: "nid", topic: "Studio test", title, body, status: "visible", version: 1, createdAt: now(), ...extra };
    state.posts.push(post); return post;
  };
  state.link = (url, extra = {}) => {
    const normalized = normalizeLinkUrl(url);
    const link = { id: uid("f", 100 + state.links.length), url: normalized.url, host: normalized.host, status: "fetched", title: "A fictional page", site: null, description: null, ...extra };
    state.links.push(link); return link;
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
  // The home page makes no account reads, signed in or not.
  if (!page.url().startsWith(portalFixtureURL)) await page.goto("/");
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

// Serves the extension popup from a stand-in origin, with a minimal chrome.* API.
export const extensionOrigin = "https://extension.fixture";
export const extensionAppOrigin = "https://dmocks.example.org";
export async function installExtension(page) {
  const files = { "popup.html": "extension/popup.html", "popup.css": "extension/popup.css", "popup.js": "extension/popup.js", "popup-core.mjs": "extension/popup-core.mjs",
    "community-link.mjs": "supabase/functions/_shared/community-link.mjs" };
  const types = { html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json" };
  const { readFile } = await import("node:fs/promises");
  await page.route(extensionOrigin + "/**", async route => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name === "config.json") return route.fulfill({ contentType: types.json, body: JSON.stringify({ supabaseUrl: api, anonKey: "sb_publishable_dmocks_browser_fixture", appOrigin: extensionAppOrigin }) });
    if (!files[name]) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: types[name.split(".").at(-1)], body: await readFile(new URL("../../" + files[name], import.meta.url)) });
  });
  await page.addInitScript(origin => {
    if (location.origin !== origin) return;
    const store = { get: async name => { const value = localStorage.getItem("chrome:" + name); return value === null ? {} : { [name]: JSON.parse(value) }; },
      set: async values => { for (const [name, value] of Object.entries(values)) localStorage.setItem("chrome:" + name, JSON.stringify(value)); },
      remove: async name => { localStorage.removeItem("chrome:" + name); } };
    window.chrome = { storage: { local: store }, runtime: { getURL: path => `${origin}/${path}` },
      tabs: { query: async () => [JSON.parse(localStorage.getItem("fixture-tab") ?? "{}")], create: ({ url }) => localStorage.setItem("fixture-opened", url) } };
    window.close = () => localStorage.setItem("fixture-closed", "yes");
  }, extensionOrigin);
}
export async function openPopup(page, tab) {
  await page.goto(extensionOrigin + "/popup.html");
  await page.evaluate(value => localStorage.setItem("fixture-tab", JSON.stringify(value)), tab);
  await page.reload();
}
