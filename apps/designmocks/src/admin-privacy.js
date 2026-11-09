export const privacyQueueLimit = 25;
const statuses = ["open", "in_progress", "closed", "declined", "cancelled"];
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const timestamp = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;

export const activePrivacyReview = request => request.status === "open" || request.status === "in_progress";

export function readPrivacyQueue(value, actorId) {
  if (!Array.isArray(value?.items) || value.items.length > privacyQueueLimit) {
    throw new Error("Invalid privacy request page");
  }
  const ids = new Set();
  for (const request of value.items) {
    if (!uuid.test(request?.id) || !uuid.test(request.userId) || ids.has(request.id)
      || request.type !== "account_deletion" || !statuses.includes(request.status)
      || !(request.adminNote === null || typeof request.adminNote === "string")
      || !Number.isSafeInteger(request.reviewRevision) || request.reviewRevision < 0
      || !timestamp.test(request.createdAt)) throw new Error("Invalid privacy request");
    ids.add(request.id);
  }
  const cursor = value.nextCursor;
  const last = value.items.at(-1);
  if (cursor !== null && (!cursor || value.items.length !== privacyQueueLimit || cursor.queue !== "privacy"
    || cursor.staffId !== actorId || cursor.id !== last.id || cursor.createdAt !== last.createdAt
    || Object.keys(cursor).length !== 4)) throw new Error("Invalid privacy request cursor");
  return { items: value.items, nextCursor: cursor };
}

export function matchesPrivacyDecision(command, receipt) {
  return receipt?.requestId === command.p_id && receipt.reviewRevision === command.p_expected_revision + 1
    && receipt.status === command.p_status && receipt.adminNote === command.p_note;
}
