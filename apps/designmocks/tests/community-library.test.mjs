import test from "node:test";
import assert from "node:assert/strict";
import { communityArticleQuery, communityArticleInput, validateCommunityArticles, mergeCommunityArticles, validateCommunityReader, validateCommunityLike,
  communityFolderName, validateCommunityFolders, validateCommunityFolder, validateCommunitySaves, communitySavedInput, validateCommunitySaved,
  validateCommunityDrafts, validateCommunityDraftReceipt, validateCommunityBlocked, communityFailure } from "../src/community-library.js";

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`, at = "2026-11-16T01:02:03.123456+00:00";
const card = (n, extra = {}) => ({ id: id(n), exam: "nid", topic: "Studio test", title: "An original fictional article", excerpt: "A fictional excerpt.", author: "Asha",
  createdAt: at, status: "visible", comments: 2, likes: 3, liked: false, saved: true, isMine: false, teacher: false, words: 420, ...extra });
const page = (articles, nextCursor = null, extra = {}) => ({ articles, nextCursor, sort: "latest", exam: null, ...extra });
const query = { exam: null, sort: "latest" };

test("article queries normalize the exam and accept only known sorts", () => {
  assert.deepEqual(communityArticleQuery(" NID ", "top"), { exam: "nid", sort: "top" });
  assert.deepEqual(communityArticleQuery("", "latest"), query);
  for (const pair of [["jee", "latest"], [null, "random"], [[], "latest"]]) assert.throws(() => communityArticleQuery(...pair));
  assert.deepEqual(communityArticleInput(query), { p_exam: null, p_sort: "latest", p_cursor: null, p_limit: 20 });
  assert.deepEqual(communityArticleInput(query, { createdAt: at, id: id(1) }).p_cursor, { createdAt: at, id: id(1) });
  assert.throws(() => communityArticleInput({ exam: null, sort: "top" }, { createdAt: at, id: id(1) }));
  for (const cursor of [{}, { createdAt: at }, { createdAt: at, id: "x" }, { createdAt: "soon", id: id(1) }, { createdAt: at, id: id(1), extra: 1 }])
    assert.throws(() => communityArticleInput(query, cursor));
});

test("article pages are bounded, unique, typed and tied to the query", () => {
  const valid = page([card(1), card(2)], { createdAt: at, id: id(2) });
  assert.deepEqual(validateCommunityArticles(valid, query).articles.length, 2);
  for (const value of [null, page(Array.from({ length: 26 }, (_, n) => card(n))), page([card(1), card(1)]), page([card(1, { status: "hidden" })]),
    page([card(1, { likes: -1 })]), page([card(1, { liked: "yes" })]), page([card(1, { excerpt: "x".repeat(401) })]), page([card(1, { exam: "jee" })]),
    page([card(1)], { createdAt: at, id: id(9) }), page([card(1)], null, { sort: "top" }), page([card(1, { body: undefined, title: 4 })])])
    assert.throws(() => validateCommunityArticles(value, query));
  assert.throws(() => validateCommunityArticles(page([card(1, { exam: "uceed" })], null, { exam: "nid" }), { exam: "nid", sort: "latest" }));
  assert.throws(() => validateCommunityArticles(page([card(1)], { createdAt: at, id: id(1) }, { sort: "top" }), { exam: null, sort: "top" }));
});

test("merging pages keeps order and drops repeats", () => {
  const first = validateCommunityArticles(page([card(1), card(2)], { createdAt: at, id: id(2) }), query);
  const merged = mergeCommunityArticles(first, validateCommunityArticles(page([card(2), card(3)]), query));
  assert.deepEqual(merged.articles.map(item => item.id), [id(1), id(2), id(3)]); assert.equal(merged.nextCursor, null);
  assert.throws(() => mergeCommunityArticles(first, { ...first, sort: "top" }));
});

test("reader header, likes and saves are verified against the request", () => {
  const header = { kind: "article", author: "Asha", createdAt: at, likes: 4, liked: true, isMine: false, folderIds: [id(5)], body: "text", version: 3, teacher: true,
    editedAt: null, acceptedCommentId: null, canAccept: false, canEdit: false, canHold: false, canSanction: false, canFeature: true, featured: false };
  assert.equal(validateCommunityReader(header), header);
  assert.equal(validateCommunityReader({ ...header, kind: "work" }).kind, "work");
  assert.equal(validateCommunityReader({ ...header, kind: "discussion", isMine: true, canAccept: true, canEdit: true, editedAt: at, acceptedCommentId: id(7) }).acceptedCommentId, id(7));
  for (const value of [{ ...header, kind: "link" }, { ...header, likes: 1.5 }, { ...header, folderIds: ["x"] }, { ...header, createdAt: 5 }, { ...header, body: "x".repeat(20001) },
    { ...header, teacher: undefined }, { ...header, version: 0 }, { ...header, editedAt: "soon" }, { ...header, acceptedCommentId: "x" },
    { ...header, canAccept: true }, { ...header, kind: "discussion", canAccept: true }, { ...header, canEdit: true }])
    assert.throws(() => validateCommunityReader(value));
  assert.deepEqual(validateCommunityLike({ postId: id(1), liked: true, likes: 5 }, id(1), true), { liked: true, likes: 5 });
  for (const value of [{ postId: id(2), liked: true, likes: 5 }, { postId: id(1), liked: false, likes: 5 }, { postId: id(1), liked: true, likes: -1 }])
    assert.throws(() => validateCommunityLike(value, id(1), true));
  assert.deepEqual(validateCommunitySaves({ postId: id(1), folderIds: [id(5)] }, id(1)), [id(5)]);
  assert.throws(() => validateCommunitySaves({ postId: id(2), folderIds: [] }, id(1)));
});

test("folder names are trimmed and bounded; folder lists are unique", () => {
  assert.equal(communityFolderName("  NID   studio  test "), "NID studio test");
  assert.throws(() => communityFolderName("   "), /name/); assert.throws(() => communityFolderName("x".repeat(61)), /60/);
  assert.deepEqual(validateCommunityFolders({ folders: [{ id: id(1), name: "Saved", count: 2, extra: true }] }), [{ id: id(1), name: "Saved", count: 2 }]);
  for (const value of [null, { folders: [{ id: id(1), name: "", count: 0 }] }, { folders: [{ id: id(1), name: "A", count: 0 }, { id: id(1), name: "B", count: 0 }] },
    { folders: Array.from({ length: 51 }, (_, n) => ({ id: id(n), name: "F" + n, count: 0 })) }]) assert.throws(() => validateCommunityFolders(value));
  assert.deepEqual(validateCommunityFolder({ id: id(1), name: "Saved" }), { id: id(1), name: "Saved", count: 0 });
});

test("saved pages show unavailable posts without any content", () => {
  const item = { postId: id(1), savedAt: at, available: true, kind: "article", exam: "nid", topic: "Studio", title: "A fictional title", excerpt: "Text", author: "Asha" };
  const gone = { postId: id(2), savedAt: at, available: false };
  const value = { folder: { id: id(9), name: "Saved" }, items: [item, gone], nextCursor: { savedAt: at, postId: id(2) } };
  assert.equal(validateCommunitySaved(value, id(9)).items.length, 2);
  assert.deepEqual(communitySavedInput(id(9)), { p_folder_id: id(9), p_cursor: null, p_limit: 20 });
  for (const broken of [{ ...value, folder: { id: id(8), name: "Saved" } }, { ...value, items: [{ ...gone, title: "leaked" }] }, { ...value, items: [item, item] },
    { ...value, items: [{ ...item, kind: "link" }] }, { ...value, nextCursor: { savedAt: at, postId: id(1) } }]) assert.throws(() => validateCommunitySaved(broken, id(9)));
  assert.throws(() => communitySavedInput("x"));
});

test("drafts, draft receipts and the block list are typed and bounded", () => {
  const draft = { id: id(1), exam: null, topic: "", title: "", body: "", updatedAt: at };
  assert.equal(validateCommunityDrafts({ drafts: [draft] }).length, 1);
  assert.throws(() => validateCommunityDrafts({ drafts: Array.from({ length: 11 }, () => draft) }));
  assert.throws(() => validateCommunityDrafts({ drafts: [{ ...draft, exam: "jee" }] }));
  assert.deepEqual(validateCommunityDraftReceipt({ id: id(1), updatedAt: at, extra: 1 }), { id: id(1), updatedAt: at });
  assert.throws(() => validateCommunityDraftReceipt({ id: id(1) }));
  assert.equal(validateCommunityBlocked({ blocked: [{ handle: "a".repeat(64), author: "Ravi", createdAt: at }] }).length, 1);
  assert.throws(() => validateCommunityBlocked({ blocked: [{ handle: id(1), author: "Ravi", createdAt: at }] }));
});

test("known server codes become sentences; anything else stays generic", () => {
  assert.match(communityFailure({ details: "community_contact_details" }), /phone numbers/);
  assert.match(communityFailure({ details: "community_folder_exists" }), /already have a folder/);
  assert.equal(communityFailure({ details: "private diagnostic", message: "secret" }, "Generic."), "Generic.");
  assert.equal(communityFailure({ details: "constructor" }, "Generic."), "Generic.");
});

import { communityCardsInput, validateCommunityCards, mergeCommunityCards, validateCommunityFeatured, validateCommunityAccept, validateCommunityEdit,
  validateCommunityFeature, validateCommunityStanding, communitySanctionNotice, communityRoleInput, validateCommunityRoles, validateCommunitySanctions,
  communityNote, communitySanctionInput, validateCommunityRevisions } from "../src/community-library.js";

const tile = (n, extra = {}) => ({ id: id(n), kind: "work", exam: "nid", topic: "Studio test", title: "A fictional poster for feedback", excerpt: "What I was trying to do",
  author: "Asha", teacher: false, createdAt: at, status: "visible", comments: 1, likes: 0, liked: false, saved: false, isMine: false, answered: false, assetCount: 2, words: 60, ...extra });

test("work and unanswered lists are typed, scoped to their view and page by time", () => {
  assert.deepEqual(communityCardsInput("work", " NID "), { p_view: "work", p_exam: "nid", p_cursor: null, p_limit: 20 });
  for (const view of ["articles", "", null]) assert.throws(() => communityCardsInput(view));
  const work = { cards: [tile(1), tile(2)], view: "work", exam: null, nextCursor: { createdAt: at, id: id(2) } };
  assert.equal(validateCommunityCards(work, "work").cards.length, 2);
  const question = tile(3, { kind: "discussion", assetCount: 0 });
  assert.equal(validateCommunityCards({ cards: [question], view: "unanswered", exam: null, nextCursor: null }, "unanswered").cards[0].kind, "discussion");
  for (const value of [{ ...work, view: "unanswered" }, { ...work, cards: [tile(1, { kind: "article" })] }, { ...work, cards: [tile(1, { assetCount: 4 })] },
    { ...work, cards: [tile(1, { answered: "no" })] }, { ...work, nextCursor: { createdAt: at, id: id(1) } }, { ...work, cards: [tile(1), tile(1)] }])
    assert.throws(() => validateCommunityCards(value, "work"));
  for (const value of [{ cards: [{ ...question, answered: true }], view: "unanswered", exam: null }, { cards: [{ ...question, status: "locked" }], view: "unanswered", exam: null },
    { cards: [question], view: "unanswered", exam: "nid" }]) assert.throws(() => validateCommunityCards(value, "unanswered"));
  const merged = mergeCommunityCards(validateCommunityCards(work, "work"), validateCommunityCards({ cards: [tile(2), tile(3)], view: "work", exam: null, nextCursor: null }, "work"));
  assert.deepEqual(merged.cards.map(item => item.id), [id(1), id(2), id(3)]);
});

test("the featured shelf holds at most ten articles or work posts", () => {
  assert.equal(validateCommunityFeatured({ cards: [tile(1), tile(2, { kind: "article", assetCount: 0 })] }).length, 2);
  for (const value of [{ cards: [tile(1, { kind: "discussion" })] }, { cards: Array.from({ length: 11 }, (_, n) => tile(n)) }, { cards: [tile(1), tile(1)] }, null])
    assert.throws(() => validateCommunityFeatured(value));
});

test("accept, edit and feature receipts must match the request", () => {
  assert.equal(validateCommunityAccept({ postId: id(1), acceptedCommentId: id(2) }, id(1), id(2)), id(2));
  assert.equal(validateCommunityAccept({ postId: id(1), acceptedCommentId: null }, id(1), null), null);
  assert.throws(() => validateCommunityAccept({ postId: id(1), acceptedCommentId: id(3) }, id(1), id(2)));
  assert.deepEqual(validateCommunityEdit({ id: id(1), version: 4, changed: true, editedAt: at }, id(1)), { version: 4, changed: true, editedAt: at });
  for (const value of [{ id: id(2), version: 4, changed: true, editedAt: at }, { id: id(1), version: 0, changed: true, editedAt: at }, { id: id(1), version: 4, changed: "yes", editedAt: at }])
    assert.throws(() => validateCommunityEdit(value, id(1)));
  assert.equal(validateCommunityFeature({ postId: id(1), featured: true }, id(1), true), true);
  assert.throws(() => validateCommunityFeature({ postId: id(1), featured: false }, id(1), true));
});

test("standing explains a pause in plain words and never hides that reading still works", () => {
  assert.deepEqual(validateCommunityStanding({ teacher: true, moderator: false, sanction: null }), { teacher: true, moderator: false, sanction: null });
  const mute = validateCommunityStanding({ teacher: false, moderator: false, sanction: { kind: "mute", until: "2026-11-24T00:00:00.000000+00:00", reason: "Repeated unkind replies" } });
  assert.match(communitySanctionNotice(mute.sanction), /^Posting is paused for your account until 24 Nov 2026\. Reason: Repeated unkind replies You can still read/);
  assert.match(communitySanctionNotice({ kind: "ban", until: null, reason: "Fictional ban reason" }), /^Posting is closed for your account\./);
  assert.equal(communitySanctionNotice(null), "");
  for (const value of [{ teacher: false, moderator: true, sanction: null }, { teacher: false, moderator: false, sanction: { kind: "ban", until: at, reason: "Fictional ban reason" } },
    { teacher: false, moderator: false, sanction: { kind: "mute", until: null, reason: "Fictional reason" } }, { teacher: false, moderator: false, sanction: { kind: "mute", until: at, reason: "short" } }])
    assert.throws(() => validateCommunityStanding(value));
});

test("role and sanction inputs are checked before any request", () => {
  assert.deepEqual(communityRoleInput(" Teacher@Example.invalid ", true, true), { p_email: "teacher@example.invalid", p_teacher: true, p_moderator: true });
  assert.throws(() => communityRoleInput("not an email", true, false), /email/);
  assert.throws(() => communityRoleInput("t@example.invalid", false, true), /moderator must also be a teacher/);
  assert.equal(validateCommunityRoles({ roles: [{ email: "t@example.invalid", name: "", teacher: true, moderator: false, updatedAt: at }] }).length, 1);
  assert.throws(() => validateCommunityRoles({ roles: [{ email: "t@example.invalid", name: "", teacher: false, moderator: false, updatedAt: at }] }));
  assert.deepEqual(communitySanctionInput("comment", id(1), "mute", "7", " Repeated unkind replies "),
    { p_target_type: "comment", p_target_id: id(1), p_kind: "mute", p_days: 7, p_reason: "Repeated unkind replies" });
  assert.equal(communitySanctionInput("post", id(1), "ban", "", "A fictional ban reason").p_days, null);
  assert.throws(() => communitySanctionInput("post", id(1), "mute", "0", "A fictional reason"), /1 to 365/);
  assert.throws(() => communitySanctionInput("post", id(1), "mute", "2.5", "A fictional reason"), /1 to 365/);
  assert.throws(() => communitySanctionInput("post", id(1), "mute", "3", "short"), /8 to 1,000/);
  assert.throws(() => communitySanctionInput("user", id(1), "ban", null, "A fictional reason"));
  assert.equal(communityNote("  Unkind reply to a student  "), "Unkind reply to a student");
  const sanction = { id: id(9), email: "s@example.invalid", name: "Kabir", kind: "mute", until: at, reason: "Repeated unkind replies", createdAt: at };
  assert.equal(validateCommunitySanctions({ sanctions: [sanction] }).length, 1);
  assert.throws(() => validateCommunitySanctions({ sanctions: [{ ...sanction, kind: "ban" }] }));
});

test("edit history keeps the current text and each replaced version", () => {
  const value = { postId: id(1), current: { title: "A fictional current title", topic: "Time", body: "Now", kind: "discussion", status: "visible", editedAt: at },
    revisions: [{ title: "A fictional older title", topic: "Time", body: "Before", replacedAt: at }] };
  assert.equal(validateCommunityRevisions(value, id(1)).revisions[0].body, "Before");
  for (const broken of [{ ...value, postId: id(2) }, { ...value, revisions: [{ title: "A title", topic: "T", body: "B" }] }, { ...value, current: null }])
    assert.throws(() => validateCommunityRevisions(broken, id(1)));
});

test("the new server codes become sentences", () => {
  assert.match(communityFailure({ details: "community_sanctioned" }), /paused/);
  assert.match(communityFailure({ details: "community_thread_changed" }), /Reload it/);
  assert.match(communityFailure({ details: "community_featured_limit" }), /ten posts/);
});
