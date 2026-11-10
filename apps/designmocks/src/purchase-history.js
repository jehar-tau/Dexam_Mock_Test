const referencePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const validTime = value => typeof value === "string" && timestampPattern.test(value) && Number.isFinite(Date.parse(value));
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const pageLimit = 10;
const paiseMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
  minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unavailable = () => new Error("Couldn’t load your purchases. Refresh and try again.");
export const purchaseStatusLabels = Object.freeze({ pending: "Pending payment", paid: "Paid", refunded: "Refunded" });
export const isOrderReference = value => typeof value === "string" && referencePattern.test(value);
const isPurchaseMode = value => value === "test" || value === "live";
const validPayment = ({ amountMinor, currency, status, refundedMinor, reviewRequired }) =>
  currency === "INR" && typeof status === "string" && Object.hasOwn(purchaseStatusLabels, status) &&
  typeof reviewRequired === "boolean" &&
  Number.isSafeInteger(amountMinor) && amountMinor > 0 && Number.isSafeInteger(refundedMinor) &&
  refundedMinor >= 0 && refundedMinor <= amountMinor;

export function purchaseAmount(minor) {
  return paiseMoney.format(minor / 100);
}

export function linkedPurchaseReference(value) {
  if (value == null) return null;
  if (!isRecord(value) || !isOrderReference(value.reference) || !isPurchaseMode(value.mode)) {
    throw new Error("Invalid linked purchase");
  }
  return { reference: value.reference, mode: value.mode };
}

export function linkedPurchaseDetails(value) {
  const identity = linkedPurchaseReference(value);
  if (!identity) return null;
  if (!validPayment(value)) throw new Error("Invalid linked purchase");
  const { amountMinor, currency, status, refundedMinor, reviewRequired } = value;
  return { ...identity, amountMinor, currency, status, refundedMinor, reviewRequired };
}

export function purchaseSupportContext(state, actorId, mode) {
  const link = state?.purchaseSupport;
  if (!actorId || link?.actorId !== actorId || !isPurchaseMode(mode) ||
      link.mode !== mode || !isOrderReference(link.reference)) return null;
  return linkedPurchaseReference(link);
}

export function validatePurchasePage(value, expectedMode) {
  if (!isRecord(value) || !isPurchaseMode(value.mode) || !Array.isArray(value.items) ||
      value.items.length > pageLimit || !Object.hasOwn(value, "nextCursor")) throw unavailable();
  if (value.mode !== expectedMode) throw Object.assign(unavailable(), { code: "purchase_mode_changed" });

  const items = value.items.map(item => {
    if (!isRecord(item)) throw unavailable();
    const { reference, amountMinor, currency, status, refundedMinor, reviewRequired, createdAt, paidAt, refundedAt } = item;
    if (!isOrderReference(reference) || !validPayment(item) || !validTime(createdAt) ||
        (paidAt !== null && !validTime(paidAt)) || (refundedAt !== null && !validTime(refundedAt))) throw unavailable();
    return { reference, amountMinor, currency, status, refundedMinor, reviewRequired, createdAt, paidAt, refundedAt };
  });
  if (new Set(items.map(item => item.reference)).size !== items.length) throw unavailable();

  const cursor = value.nextCursor;
  const last = items.at(-1);
  if (cursor !== null && (!isRecord(cursor) || items.length !== pageLimit ||
      cursor.reference !== last.reference || cursor.createdAt !== last.createdAt)) throw unavailable();
  const nextCursor = cursor === null ? null : { reference: cursor.reference, createdAt: cursor.createdAt };
  return { mode: value.mode, items, nextCursor };
}

export function appendPurchasePage(previous, next) {
  const references = new Set(previous.items.map(item => item.reference));
  if (next.mode !== previous.mode || next.items.some(item => references.has(item.reference))) throw unavailable();
  return { ...next, items: [...previous.items, ...next.items] };
}
