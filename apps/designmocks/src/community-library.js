// Response checks for Community articles, likes, folders, saves, drafts and
// blocks. Every server reply is verified before it reaches the screen.
import { ARTICLE_BODY, ARTICLE_EXAMS } from "./community-article.mjs";
import { LINK_DESCRIPTION_MAX, LINK_SITE_MAX, LINK_TITLE_MAX, LINK_URL_MAX } from "../supabase/functions/_shared/community-link.mjs";

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
const kinds = new Set(["discussion", "article", "work", "link"]);
// A shared link preview. Plain text only; the address must be http or https.
export function validateCommunityLinkPreview(value) {
  const optional = (item, max) => item === null || text(item, max, 1);
  if (!value || !uuid(value.id) || typeof value.url !== "string" || value.url.length > LINK_URL_MAX || !/^https?:\/\//.test(value.url) ||
    !text(value.host, 253, 3) || !["fetched", "unavailable", "skipped"].includes(value.status) || !optional(value.title, LINK_TITLE_MAX) ||
    !optional(value.site, LINK_SITE_MAX) || !optional(value.description, LINK_DESCRIPTION_MAX) || !timestamp(value.fetchedAt)) return invalid();
  let parsed; try { parsed = new URL(value.url); } catch { return invalid(); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.hostname !== value.host) return invalid();
  return { id: value.id, url: value.url, host: value.host, status: value.status, title: value.title, site: value.site, description: value.description, fetchedAt: value.fetchedAt };
}
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
    (value.kind === "link" ? !value.link || validateCommunityLinkPreview(value.link).id !== value.link.id : value.link !== undefined && value.link !== null) ||
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
  if (!value || Object.keys(value).length !== 3 || !uuid(value.id) || !["post", "link"].includes(value.type) || !timestamp(value.savedAt)) return invalid();
  return { savedAt: value.savedAt, type: value.type, id: value.id };
}
const suggestion = value => value === null || (value && ["pending", "approved", "rejected"].includes(value.status) && (value.postId === null || uuid(value.postId)) &&
  (value.reason === null || text(value.reason, 1000, 1)));
export function communitySavedInput(folderId, cursor = null) {
  if (!uuid(folderId)) return invalid();
  return { p_folder_id: folderId, p_cursor: savedCursor(cursor), p_limit: 20 };
}
export function validateCommunitySaved(value, folderId) {
  if (!value || value.folder?.id !== folderId || !text(value.folder.name, COMMUNITY_FOLDER_NAME_MAX, 1) || !Array.isArray(value.items) || value.items.length > 25 ||
    new Set(value.items.map(item => `${item?.type}:${item?.id}`)).size !== value.items.length) return invalid();
  const items = value.items.map(item => {
    if (!item || !uuid(item.id) || !timestamp(item.savedAt) || !["post", "link"].includes(item.type)) return invalid();
    const note = item.note === undefined || item.note === null || text(item.note, 2000, 1);
    if (item.type === "link") {
      if (!note || !suggestion(item.suggestion ?? null) || !(item.postId === null || uuid(item.postId))) return invalid();
      const link = validateCommunityLinkPreview(item.link);
      if (link.id !== item.id) return invalid();
      return { type: "link", id: item.id, savedAt: item.savedAt, link, note: item.note ?? null, suggestion: item.suggestion ?? null, postId: item.postId };
    }
    if (item.postId !== item.id || typeof item.available !== "boolean") return invalid();
    if (!item.available) {
      if (Object.keys(item).sort().join() !== "available,id,postId,savedAt,type") return invalid();
      return { type: "post", id: item.id, postId: item.postId, savedAt: item.savedAt, available: false };
    }
    if (!(kinds.has(item.kind) && exams.has(item.exam) && text(item.topic, 100) && text(item.title, 160) && text(item.excerpt, 400) && text(item.author, 100) && note)) return invalid();
    return { ...item, note: item.note ?? null };
  });
  const nextCursor = savedCursor(value.nextCursor ?? null), last = items.at(-1);
  if (nextCursor && (!last || last.id !== nextCursor.id || last.type !== nextCursor.type || last.savedAt !== nextCursor.savedAt)) return invalid();
  return { folder: { id: value.folder.id, name: value.folder.name }, items, nextCursor };
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
export const communityCardViews = Object.freeze(["work", "unanswered", "links"]);
function cardOf(item) {
  return item && uuid(item.id) && kinds.has(item.kind) && exams.has(item.exam) && text(item.topic, 100) && text(item.title, 160) && text(item.excerpt, 400) &&
    text(item.author, 100) && timestamp(item.createdAt) && ["visible", "locked"].includes(item.status) && count(item.comments) && count(item.likes) &&
    count(item.words) && count(item.assetCount) && item.assetCount <= 3 && [item.liked, item.saved, item.isMine, item.teacher, item.answered].every(flag => typeof flag === "boolean") &&
    (item.kind === "link" ? Boolean(item.link) && validateCommunityLinkPreview(item.link).id === item.link.id : item.link === undefined || item.link === null);
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
    value.cards.some(item => (selected && item.exam !== selected) || (view === "work" ? item.kind !== "work" : view === "links" ? item.kind !== "link"
      : item.kind !== "discussion" || item.answered || item.status !== "visible"))) return invalid();
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
  if (!value || typeof value.admin !== "boolean" || typeof value.teacher !== "boolean" || typeof value.moderator !== "boolean" || (value.moderator && !value.teacher)) return invalid();
  const s = value.sanction;
  if (s !== null && !(s && ["mute", "ban"].includes(s.kind) && text(s.reason, 1000, 8) && (s.kind === "ban" ? s.until === null : timestamp(s.until)))) return invalid();
  return { admin: value.admin, teacher: value.teacher, moderator: value.moderator, sanction: s && { kind: s.kind, until: s.until, reason: s.reason } };
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

// Links: saves, suggestions, the review queue and trusted sites.
export function validateCommunityLinkSave(value, linkId) {
  if (!value || value.linkId !== linkId || !Array.isArray(value.folderIds) || value.folderIds.length > COMMUNITY_FOLDER_LIMIT || !value.folderIds.every(uuid) ||
    !(value.note === null || text(value.note, 2000, 1))) return invalid();
  return { folderIds: value.folderIds, note: value.note };
}
export function communitySuggestionInput(linkId, exam, topic, note) {
  const selected = communityArticleQuery(exam, "latest").exam, subject = String(topic ?? "").trim(), reason = String(note ?? "").trim();
  if (!uuid(linkId)) return invalid();
  if (!selected) throw new Error("Choose the exam this link helps with.");
  if (!subject || [...subject].length > 100) throw new Error("Add a topic of up to 100 characters.");
  if ([...reason].length < 20 || [...reason].length > 2000) throw new Error("Say why it helps in 20 to 2,000 characters. This becomes the post’s text.");
  return { p_link_id: linkId, p_exam: selected, p_topic: subject, p_note: reason };
}
export function validateCommunitySuggestion(value) {
  if (!value || !uuid(value.id) || !["pending", "approved"].includes(value.status) || (value.status === "approved" ? !uuid(value.postId) : value.postId !== null)) return invalid();
  return { id: value.id, status: value.status, postId: value.postId };
}
export function validateCommunityLinkQueue(value) {
  if (!value || typeof value.canTrust !== "boolean" || !Array.isArray(value.items) || value.items.length > 50) return invalid();
  const items = value.items.map(item => {
    if (!item || !uuid(item.id) || !text(item.author, 100) || typeof item.isMine !== "boolean" || typeof item.social !== "boolean" || !exams.has(item.exam) ||
      !text(item.topic, 100, 1) || !text(item.note, 2000, 20) || !timestamp(item.createdAt)) return invalid();
    return { ...item, link: validateCommunityLinkPreview(item.link) };
  });
  return { canTrust: value.canTrust, items };
}
export function validateCommunityReview(value, id) {
  if (!value || value.id !== id || !["approved", "rejected"].includes(value.status) || (value.status === "approved" ? !uuid(value.postId) : value.postId !== null)) return invalid();
  return { status: value.status, postId: value.postId };
}
export function validateCommunityTrustedHosts(value) {
  if (!value || !Array.isArray(value.hosts) || value.hosts.length > 500 || !value.hosts.every(item => item && text(item.host, 253, 3) && timestamp(item.createdAt))) return invalid();
  return value.hosts.map(item => item.host);
}
const linkFailures = Object.freeze({
  link_invalid: "That doesn’t look like a web address. Paste the full address, starting with https://.",
  link_blocked: "That address can’t be saved. Use a public website.",
  link_limit: "You’ve fetched thirty previews this hour. Try again later.",
  link_unavailable: "Link previews are unavailable right now. Try again.",
});
// Errors from the preview request arrive as a function reply with a code.
export async function communityLinkFailure(error) {
  try { const body = await error?.context?.clone().json(); if (Object.hasOwn(linkFailures, body?.code)) return linkFailures[body.code]; } catch { /* Diagnostics stay private. */ }
  return linkFailures.link_unavailable;
}

// Browser extension connections.
export function validateExtensionTokens(value) {
  if (!value || !Array.isArray(value.tokens) || value.tokens.length > 5 || !value.tokens.every(item => item && uuid(item.id) && text(item.label, 60, 1) &&
    timestamp(item.createdAt) && (item.lastUsedAt === null || timestamp(item.lastUsedAt)) && timestamp(item.expiresAt) && !Object.hasOwn(item, "token"))) return invalid();
  return value.tokens;
}
export function validateExtensionTokenCreated(value) {
  if (!value || !uuid(value.id) || !text(value.label, 60, 1) || typeof value.token !== "string" || !/^dmx_[0-9a-f]{64}$/.test(value.token) || !timestamp(value.expiresAt)) return invalid();
  return { id: value.id, label: value.label, token: value.token, expiresAt: value.expiresAt };
}
// A link saved from the extension has no preview until one is fetched.
export const communityLinkNeedsPreview = link => link.status === "unavailable" && Date.parse(link.fetchedAt) < Date.now() - 7 * 86400000;

const failures = Object.freeze({
  community_extension_limit: "You can connect five browsers. Remove one first.",
  community_link_unavailable: "That link is no longer available. Save it again.",
  community_link_social: "Links to social or messaging sites stay in your private folders.",
  community_link_posted: "This link is already in the Links feed.",
  community_suggest_limit: "You’ve suggested five links today. Try again tomorrow.",
  community_review_own: "Another moderator must review your own suggestion.",
  community_admin_required: "Only an administrator can trust a site.",
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
