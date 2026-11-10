import { linkedPurchaseDetails } from "./purchase-history.js";

export const supportStatuses = ["open", "investigating", "fixed", "closed"];
export const supportPageLimit = 25;
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const timestamp = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;

export function readSupportPage(value, actorId) {
  if (!Array.isArray(value?.items) || value.items.length > supportPageLimit) {
    throw new Error("Invalid support page");
  }
  const ids = new Set();
  for (const report of value.items) {
    if (!uuid.test(report?.id) || ids.has(report.id) || typeof report.title !== "string"
      || typeof report.description !== "string" || !supportStatuses.includes(report.status)
      || !(report.adminReply === null || typeof report.adminReply === "string")
      || !Number.isSafeInteger(report.replyRevision) || report.replyRevision < 0
      || !timestamp.test(report.createdAt)) {
      throw new Error("Invalid support report");
    }
    ids.add(report.id);
  }
  const cursor = value.nextCursor;
  const last = value.items.at(-1);
  if (cursor !== null && (!cursor || value.items.length !== supportPageLimit || cursor.staffId !== actorId || cursor.id !== last.id
    || cursor.createdAt !== last.createdAt || Object.keys(cursor).length !== 3)) {
    throw new Error("Invalid support cursor");
  }
  const items = value.items.map(({ id, title, description, status, adminReply, replyRevision, createdAt, purchase }) => {
    const order = linkedPurchaseDetails(purchase);
    return { id, title, description, status, adminReply, replyRevision, createdAt, ...(order ? { purchase: order } : {}) };
  });
  return { items, nextCursor: cursor };
}

export function supportReplyRequest(reportId, draft, requestId) {
  return Object.freeze({
    p_id: reportId, p_expected_revision: draft.revision, p_status: draft.status,
    p_reply: draft.reply.trim(), p_request_id: requestId,
  });
}

export function matchesSupportReplyReceipt(request, receipt) {
  return receipt?.reportId === request.p_id
    && receipt.requestId === request.p_request_id
    && receipt.replyRevision === request.p_expected_revision + 1
    && receipt.status === request.p_status && receipt.adminReply === (request.p_reply || null);
}
