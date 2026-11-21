import test from "node:test";
import assert from "node:assert/strict";
import { communityArticleQuery, communityArticleInput, validateCommunityArticles, mergeCommunityArticles, validateCommunityReader, validateCommunityLike,
  communityFolderName, validateCommunityFolders, validateCommunityFolder, validateCommunitySaves, communitySavedInput, validateCommunitySaved,
  validateCommunityDrafts, validateCommunityDraftReceipt, validateCommunityBlocked, communityFailure } from "../src/community-library.js";

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`, at = "2026-11-16T01:02:03.123456+00:00";
const card = (n, extra = {}) => ({ id: id(n), exam: "nid", topic: "Studio test", title: "An original fictional article", excerpt: "A fictional excerpt.", author: "Asha",
  createdAt: at, status: "visible", comments: 2, likes: 3, liked: false, saved: true, isMine: false, words: 420, ...extra });
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
  const header = { kind: "article", author: "Asha", createdAt: at, likes: 4, liked: true, isMine: false, folderIds: [id(5)], body: "text" };
  assert.equal(validateCommunityReader(header), header);
  for (const value of [{ ...header, kind: "link" }, { ...header, likes: 1.5 }, { ...header, folderIds: ["x"] }, { ...header, createdAt: 5 }, { ...header, body: "x".repeat(20001) }])
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
