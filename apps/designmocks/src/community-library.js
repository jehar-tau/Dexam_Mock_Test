// Response checks for Community articles, likes, folders, saves, drafts and
// blocks. Every server reply is verified before it reaches the screen.
import { ARTICLE_BODY, ARTICLE_EXAMS } from "./community-article.mjs";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const uuid = value => typeof value === "string" && uuidPattern.test(value);
const timestamp = value => typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const text = (value, max, min = 0) => typeof value === "string" && [...value].length <= max && [...value].length >= min;
const count = value => Number.isSafeInteger(value) && value >= 0;
const exams = new Set(ARTICLE_EXAMS);
const invalid = () => { throw new Error("Community could not be verified. Refresh and try again."); };
export const COMMUNITY_FOLDER_NAME_MAX = 60;
export const COMMUNITY_FOLDER_LIMIT = 50;
export const communitySorts = Object.freeze(["latest", "top"]);

export function communityArticleQuery(exam = null, sort = "latest") {
  const selected = typeof exam === "string" ? exam.trim().toLowerCase() || null : exam ?? null;
  if ((selected !== null && !exams.has(selected)) || !communitySorts.includes(sort)) return invalid();
  return { exam: selected, sort };
}
function articleCursor(value) {
  if (value === null) return null;
  if (!value || Object.keys(value).length !== 2 || !uuid(value.id) || !timestamp(value.createdAt)) return invalid();
  // Keep PostgreSQL microseconds exactly as received.
  return { createdAt: value.createdAt, id: value.id };
}
export function communityArticleInput(query, cursor = null) {
  const selected = communityArticleQuery(query?.exam, query?.sort);
  if (cursor !== null && selected.sort !== "latest") return invalid();
  return { p_exam: selected.exam, p_sort: selected.sort, p_cursor: articleCursor(cursor), p_limit: 20 };
}
const kinds = new Set(["discussion", "article", "work"]);
function card(item) {
  return item && uuid(item.id) && exams.has(item.exam) && typeof item.teacher === "boolean" && text(item.topic, 100) && text(item.title, 160) && text(item.excerpt, 400) &&
    text(item.author, 100) && timestamp(item.createdAt) && ["visible", "locked"].includes(item.status) && count(item.comments) && count(item.likes) &&
    count(item.words) && [item.liked, item.saved, item.isMine].every(flag => typeof flag === "boolean");
}
export function validateCommunityArticles(value, query) {
  const selected = communityArticleQuery(query.exam, query.sort);
  if (!value || !Array.isArray(value.articles) || value.articles.length > 25 || value.sort !== selected.sort || (value.exam ?? null) !== selected.exam ||
    !value.articles.every(card) || new Set(value.articles.map(item => item.id.toLowerCase())).size !== value.articles.length ||
    value.articles.some(item => selected.exam && item.exam !== selected.exam)) return invalid();
  const nextCursor = articleCursor(value.nextCursor ?? null), last = value.articles.at(-1);
  if (nextCursor && (selected.sort !== "latest" || !last || last.id !== nextCursor.id || last.createdAt !== nextCursor.createdAt)) return invalid();
  return { articles: value.articles, nextCursor, sort: selected.sort, exam: selected.exam };
}
export function mergeCommunityArticles(previous, next) {
  if (!previous || previous.sort !== next.sort || previous.exam !== next.exam) return invalid();
  const seen = new Set(previous.articles.map(item => item.id));
  return { ...next, articles: [...previous.articles, ...next.articles.filter(item => !seen.has(item.id))] };
}

// Extra fields the reading page needs from community_thread's header.
export function validateCommunityReader(value) {
  if (!value || !kinds.has(value.kind) || !text(value.author, 100) || !timestamp(value.createdAt) || !count(value.likes) ||
    typeof value.liked !== "boolean" || typeof value.isMine !== "boolean" || !Array.isArray(value.folderIds) || value.folderIds.length > COMMUNITY_FOLDER_LIMIT ||
    !value.folderIds.every(uuid) || !text(value.body, ARTICLE_BODY.max) || !Number.isSafeInteger(value.version) || value.version < 1 ||
    ![value.teacher, value.canAccept, value.canEdit, value.canHold, value.canSanction, value.canFeature, value.featured].every(flag => typeof flag === "boolean") ||
    !(value.editedAt === null || timestamp(value.editedAt)) || !(value.acceptedCommentId === null || uuid(value.acceptedCommentId)) ||
    (value.canAccept && (value.kind !== "discussion" || !value.isMine)) || (value.canEdit && !value.isMine)) return invalid();
  return value;
}
export function validateCommunityLike(value, postId, liked) {
  if (!value || value.postId !== postId || value.liked !== liked || !count(value.likes)) return invalid();
  return { liked: value.liked, likes: value.likes };
}

export function communityFolderName(value) {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Give the folder a name.");
  if ([...name].length > COMMUNITY_FOLDER_NAME_MAX) throw new Error("Keep folder names within 60 characters.");
  return name;
}
const folder = item => item && uuid(item.id) && text(item.name, COMMUNITY_FOLDER_NAME_MAX, 1) && count(item.count);
export function validateCommunityFolders(value) {
  if (!value || !Array.isArray(value.folders) || value.folders.length > COMMUNITY_FOLDER_LIMIT || !value.folders.every(folder) ||
    new Set(value.folders.map(item => item.id)).size !== value.folders.length) return invalid();
  return value.folders.map(item => ({ id: item.id, name: item.name, count: item.count }));
}
export function validateCommunityFolder(value) {
  if (!value || !uuid(value.id) || !text(value.name, COMMUNITY_FOLDER_NAME_MAX, 1)) return invalid();
  return { id: value.id, name: value.name, count: count(value.count) ? value.count : 0 };
}
export function validateCommunitySaves(value, postId) {
  if (!value || value.postId !== postId || !Array.isArray(value.folderIds) || value.folderIds.length > COMMUNITY_FOLDER_LIMIT || !value.folderIds.every(uuid)) return invalid();
  return value.folderIds;
}
function savedCursor(value) {
  if (value === null) return null;
  if (!value || Object.keys(value).length !== 2 || !uuid(value.postId) || !timestamp(value.savedAt)) return invalid();
  return { savedAt: value.savedAt, postId: value.postId };
}
export function communitySavedInput(folderId, cursor = null) {
  if (!uuid(folderId)) return invalid();
  return { p_folder_id: folderId, p_cursor: savedCursor(cursor), p_limit: 20 };
}
export function validateCommunitySaved(value, folderId) {
  if (!value || value.folder?.id !== folderId || !text(value.folder.name, COMMUNITY_FOLDER_NAME_MAX, 1) || !Array.isArray(value.items) || value.items.length > 25 ||
    new Set(value.items.map(item => item?.postId)).size !== value.items.length) return invalid();
  for (const item of value.items) {
    if (!item || !uuid(item.postId) || !timestamp(item.savedAt) || typeof item.available !== "boolean") return invalid();
    if (item.available ? !(kinds.has(item.kind) && exams.has(item.exam) && text(item.topic, 100) && text(item.title, 160) &&
      text(item.excerpt, 400) && text(item.author, 100)) : Object.keys(item).length !== 3) return invalid();
  }
  const nextCursor = savedCursor(value.nextCursor ?? null), last = value.items.at(-1);
  if (nextCursor && (!last || last.postId !== nextCursor.postId || last.savedAt !== nextCursor.savedAt)) return invalid();
  return { folder: { id: value.folder.id, name: value.folder.name }, items: value.items, nextCursor };
}

const draft = item => item && uuid(item.id) && (item.exam === null || exams.has(item.exam)) && text(item.topic, 100) && text(item.title, 160) &&
  text(item.body, ARTICLE_BODY.max) && timestamp(item.updatedAt);
export function validateCommunityDrafts(value) {
  if (!value || !Array.isArray(value.drafts) || value.drafts.length > 10 || !value.drafts.every(draft)) return invalid();
  return value.drafts;
}
export function validateCommunityDraftReceipt(value) {
  if (!value || !uuid(value.id) || !timestamp(value.updatedAt)) return invalid();
  return { id: value.id, updatedAt: value.updatedAt };
}
export function validateCommunityBlocked(value) {
  if (!value || !Array.isArray(value.blocked) || value.blocked.length > 200 ||
    !value.blocked.every(item => item && /^[0-9a-f]{64}$/.test(item.handle) && text(item.author, 100) && timestamp(item.createdAt))) return invalid();
  return value.blocked;
}

// Cards for the work list, the unanswered list and the featured shelf.
export const communityCardViews = Object.freeze(["work", "unanswered"]);
function cardOf(item) {
  return item && uuid(item.id) && kinds.has(item.kind) && exams.has(item.exam) && text(item.topic, 100) && text(item.title, 160) && text(item.excerpt, 400) &&
    text(item.author, 100) && timestamp(item.createdAt) && ["visible", "locked"].includes(item.status) && count(item.comments) && count(item.likes) &&
    count(item.words) && count(item.assetCount) && item.assetCount <= 3 && [item.liked, item.saved, item.isMine, item.teacher, item.answered].every(flag => typeof flag === "boolean");
}
export function communityCardsInput(view, exam = null, cursor = null) {
  const selected = communityArticleQuery(exam, "latest").exam;
  if (!communityCardViews.includes(view)) return invalid();
  return { p_view: view, p_exam: selected, p_cursor: articleCursor(cursor), p_limit: 20 };
}
export function validateCommunityCards(value, view, exam = null) {
  const selected = communityArticleQuery(exam, "latest").exam;
  if (!value || value.view !== view || (value.exam ?? null) !== selected || !Array.isArray(value.cards) || value.cards.length > 25 || !value.cards.every(cardOf) ||
    new Set(value.cards.map(item => item.id.toLowerCase())).size !== value.cards.length ||
    value.cards.some(item => (selected && item.exam !== selected) || (view === "work" ? item.kind !== "work" : item.kind !== "discussion" || item.answered || item.status !== "visible"))) return invalid();
  const nextCursor = articleCursor(value.nextCursor ?? null), last = value.cards.at(-1);
  if (nextCursor && (!last || last.id !== nextCursor.id || last.createdAt !== nextCursor.createdAt)) return invalid();
  return { cards: value.cards, nextCursor, view, exam: selected };
}
export function mergeCommunityCards(previous, next) {
  if (!previous || previous.view !== next.view || previous.exam !== next.exam) return invalid();
  const seen = new Set(previous.cards.map(item => item.id));
  return { ...next, cards: [...previous.cards, ...next.cards.filter(item => !seen.has(item.id))] };
}
export function validateCommunityFeatured(value) {
  if (!value || !Array.isArray(value.cards) || value.cards.length > 10 || !value.cards.every(cardOf) ||
    value.cards.some(item => item.kind === "discussion") || new Set(value.cards.map(item => item.id)).size !== value.cards.length) return invalid();
  return value.cards;
}

// Accepting, editing, featuring and standing.
export function validateCommunityAccept(value, postId, commentId) {
  if (!value || value.postId !== postId || value.acceptedCommentId !== commentId) return invalid();
  return value.acceptedCommentId;
}
export function validateCommunityEdit(value, postId) {
  if (!value || value.id !== postId || !Number.isSafeInteger(value.version) || value.version < 1 || typeof value.changed !== "boolean" ||
    !(value.editedAt === null || timestamp(value.editedAt))) return invalid();
  return { version: value.version, changed: value.changed, editedAt: value.editedAt };
}
export function validateCommunityFeature(value, postId, featured) {
  if (!value || value.postId !== postId || value.featured !== featured) return invalid();
  return featured;
}
export function validateCommunityStanding(value) {
  if (!value || typeof value.teacher !== "boolean" || typeof value.moderator !== "boolean" || (value.moderator && !value.teacher)) return invalid();
  const s = value.sanction;
  if (s !== null && !(s && ["mute", "ban"].includes(s.kind) && text(s.reason, 1000, 8) && (s.kind === "ban" ? s.until === null : timestamp(s.until)))) return invalid();
  return { teacher: value.teacher, moderator: value.moderator, sanction: s && { kind: s.kind, until: s.until, reason: s.reason } };
}
export function communitySanctionNotice(sanction) {
  if (!sanction) return "";
  const until = sanction.until ? new Date(sanction.until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  return `${until ? `Posting is paused for your account until ${until}.` : "Posting is closed for your account."} Reason: ${sanction.reason} You can still read, like and save. To ask about this, use Report a problem.`;
}

// Administrator and moderator tools.
const email = value => typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+$/.test(value);
export function communityRoleInput(address, teacher, moderator) {
  const value = String(address ?? "").trim().toLowerCase();
  if (!email(value)) throw new Error("Enter the account’s email address.");
  if (moderator && !teacher) throw new Error("A moderator must also be a teacher.");
  return { p_email: value, p_teacher: Boolean(teacher), p_moderator: Boolean(moderator) };
}
export function validateCommunityRoles(value) {
  if (!value || !Array.isArray(value.roles) || value.roles.length > 500 || !value.roles.every(item => item && email(item.email) && text(item.name, 100) &&
    item.teacher === true && typeof item.moderator === "boolean" && timestamp(item.updatedAt))) return invalid();
  return value.roles;
}
export function validateCommunitySanctions(value) {
  if (!value || !Array.isArray(value.sanctions) || value.sanctions.length > 500 || !value.sanctions.every(item => item && uuid(item.id) && email(item.email) &&
    text(item.name, 100) && ["mute", "ban"].includes(item.kind) && (item.kind === "ban" ? item.until === null : timestamp(item.until)) &&
    text(item.reason, 1000, 8) && timestamp(item.createdAt))) return invalid();
  return value.sanctions;
}
export function communityNote(value, min = 8, max = 1000) {
  const note = String(value ?? "").trim();
  if ([...note].length < min || [...note].length > max) throw new Error(`Write a reason of ${min} to ${max.toLocaleString("en-IN")} characters.`);
  return note;
}
export function communitySanctionInput(targetType, targetId, kind, days, reason) {
  if (!["post", "comment"].includes(targetType) || !uuid(targetId) || !["mute", "ban"].includes(kind)) return invalid();
  const length = kind === "mute" ? Number(days) : null;
  if (kind === "mute" && (!Number.isInteger(length) || length < 1 || length > 365)) throw new Error("Choose a pause of 1 to 365 days.");
  return { p_target_type: targetType, p_target_id: targetId, p_kind: kind, p_days: length, p_reason: communityNote(reason) };
}
export function validateCommunityRevisions(value, postId) {
  const entry = item => item && text(item.title, 160) && text(item.topic, 100) && text(item.body, ARTICLE_BODY.max);
  if (!value || value.postId !== postId || !entry(value.current) || !Array.isArray(value.revisions) || value.revisions.length > 50 ||
    !value.revisions.every(item => entry(item) && timestamp(item.replacedAt))) return invalid();
  return { current: value.current, revisions: value.revisions };
}

const failures = Object.freeze({
  community_sanctioned: "Posting is paused for your account. You can still read, like and save.",
  community_work_limit: "You’ve shared five pieces of work today. Try again tomorrow.",
  community_edit_limit: "You’ve made twenty edits today. Try again tomorrow.",
  community_thread_changed: "This post changed while you were editing. Reload it, then make your change again.",
  community_hold_own: "You can’t hold your own post or reply.",
  community_hold_limit: "You’ve held thirty items this hour. Ask an administrator to help.",
  community_moderator_required: "Only moderators can hold content.",
  community_teacher_required: "Only teachers can change the featured shelf.",
  community_featured_limit: "The featured shelf holds ten posts. Remove one first.",
  community_role_unknown: "No DMocks account uses that email address.",
  community_contact_details: "Remove phone numbers, email addresses, social handles and invitations to contact you, then try again.",
  community_article_limit: "You’ve published three articles today. Try again tomorrow.",
  community_invalid_input: "Check the fields and try again.",
  community_request_conflict: "This request belongs to different text. Check your published articles before trying again.",
  community_like_limit: "You’re liking very quickly. Try again in a while.",
  community_like_own: "You can’t like your own post.",
  community_target_unavailable: "This post is no longer available.",
  community_folder_limit: "You’ve reached the limit of 50 folders.",
  community_folder_exists: "You already have a folder with that name.",
  community_folder_unavailable: "That folder no longer exists. Refresh your folders.",
  community_save_limit: "You’ve reached the limit of 1,000 saved posts.",
  community_draft_limit: "You can keep ten drafts. Delete one to save another.",
  community_draft_unavailable: "That draft no longer exists.",
  community_block_limit: "You’ve reached the limit of 200 blocked authors.",
  community_block_self: "You can’t block yourself.",
});
export function communityFailure(error, fallback = "That didn’t save. Check your connection and try again.") {
  return Object.hasOwn(failures, error?.details) ? failures[error.details] : fallback;
}
