const uuid = value => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const known = {
  community_invalid_input: "Check the discussion fields and try again.",
  community_request_conflict: "This request belongs to different text. Check your saved discussions before posting again.",
  community_post_limit: "You’ve reached the hourly post limit. Try again later.",
  community_reply_limit: "You’ve reached the hourly reply limit. Try again later.",
  community_contact_details: "Remove phone numbers, email addresses, social handles and invitations to contact you, then try again.",
  community_target_unavailable: "This discussion or reply is unavailable or locked. Refresh it before replying.",
};
export class CommunityWriteFailure extends Error {
  constructor(message, definitive = false) { super(message); this.definitive = definitive; }
}
export function communityWriteFailure(error) {
  return Object.hasOwn(known, error?.details)
    ? new CommunityWriteFailure(known[error.details],true)
    : new CommunityWriteFailure("Your text did not confirm. Retry this request to check whether it was saved.");
}
export function newCommunityWrite(kind, input, files = [], makeId = () => crypto.randomUUID()) {
  const requestId = makeId();
  if (!["post","comment"].includes(kind) || !uuid(requestId)) throw new Error("Invalid write request");
  return { kind, requestId, input: { ...input }, files: [...files] };
}
export async function submitCommunityWrite(job, send, signal) {
  signal?.throwIfAborted();
  let result;
  try { result = await send(job.kind === "post" ? "create_community_post" : "add_community_comment", { ...job.input, p_request_id: job.requestId }, signal); }
  catch (error) { signal?.throwIfAborted(); throw communityWriteFailure(error); }
  signal?.throwIfAborted();
  if (!result || !uuid(result.id) || !uuid(result.postId) || !["visible","hidden","locked"].includes(result.postStatus) ||
      !["visible","hidden",...(job.kind === "post" ? ["locked"] : [])].includes(result.status) || typeof result.replayed !== "boolean" ||
      typeof result.canUpload !== "boolean" || result.canUpload !== (result.status === "visible" && result.postStatus === "visible") ||
      (job.kind === "post" ? result.id !== result.postId || result.parentId !== null || result.status !== result.postStatus
        : result.postId !== job.input.p_post_id || result.parentId !== (job.input.p_parent_id ?? null))) throw communityWriteFailure();
  return result;
}

// Iterative traversal avoids recursion depth failures on long historical chains.
// Unloaded/removed parents remain explicit context instead of dropping the reply.
export function communityCommentOrder(comments = []) {
  const byId = new Map(comments.map(comment => [comment.id,comment])), children = new Map();
  for (const comment of comments) {
    const parent = comment.parentId && comment.parentId !== comment.id && byId.has(comment.parentId) ? comment.parentId : null;
    if (!children.has(parent)) children.set(parent,[]);
    children.get(parent).push(comment);
  }
  const result = [], seen = new Set();
  function visit(start, depth = 0) {
    const stack = [{ comment:start, depth }];
    while (stack.length) {
      const item = stack.pop();
      if (seen.has(item.comment.id)) continue;
      seen.add(item.comment.id); result.push({ ...item.comment, depth:item.depth });
      const nested = children.get(item.comment.id) ?? [];
      for (let index=nested.length-1;index>=0;index--) stack.push({comment:nested[index],depth:item.depth+1});
    }
  }
  for (const root of children.get(null) ?? []) visit(root);
  for (const comment of comments) if (!seen.has(comment.id)) visit(comment);
  return result;
}
export function mergeCommunityComments(previous, incoming) {
  const map = new Map(previous.map(comment => [comment.id,comment]));
  for (const comment of incoming) map.set(comment.id,comment);
  return [...map.values()];
}
export function communityPageCursor(value) {
  if (value === null || value === undefined) return null;
  if (!value || Object.keys(value).length !== 4 || !uuid(value.id) || !Number.isSafeInteger(value.version) || value.version < 1 ||
    ![value.createdAt,value.snapshotAt].every(item => typeof item === "string" && Number.isFinite(Date.parse(item))) || Date.parse(value.createdAt)>Date.parse(value.snapshotAt)) throw new Error("Invalid discussion cursor");
  return { createdAt:value.createdAt,id:value.id,snapshotAt:value.snapshotAt,version:value.version };
}

export function validateCommunityThread(value, postId) {
  if (!value || value.id !== postId || !["visible","locked"].includes(value.status) ||
    !Number.isSafeInteger(value.version) || value.version < 1 || !Array.isArray(value.comments) || value.comments.length > 50 ||
    !Number.isInteger(value.assetCount) || value.assetCount < 0 || value.assetCount > 3 ||
    ![value.title,value.body,value.exam,value.topic].every(item=>typeof item==="string") ||
    new Set(value.comments.map(comment=>comment.id)).size !== value.comments.length ||
    value.comments.some(comment=>!uuid(comment.id) || (comment.parentId!==null && !uuid(comment.parentId)) ||
      typeof comment.body!=="string" || typeof comment.author!=="string" || !Number.isSafeInteger(comment.helpful) || comment.helpful<0 ||
      ![comment.isMine,comment.canReply,comment.markedHelpful,comment.parentAvailable].every(item=>typeof item==="boolean") ||
      !Number.isInteger(comment.assetCount) || comment.assetCount<0 || comment.assetCount>3 ||
      (comment.parentPreview!==null && (!comment.parentPreview || typeof comment.parentPreview.author!=="string" || typeof comment.parentPreview.body!=="string")))) throw new Error("Invalid discussion response");
  const nextCursor=communityPageCursor(value.nextCursor);
  if (nextCursor && nextCursor.version!==value.version) throw new Error("Invalid discussion version");
  return { ...value,nextCursor };
}
