const referencePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const validTime = value => typeof value === "string" && timestampPattern.test(value) && Number.isFinite(Date.parse(value));
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const pageLimit = 10;
const paiseMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
  minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unavailable = () => new Error("Couldn’t load your purchases. Refresh and try again.");

export function purchaseAmount(minor) {
  return paiseMoney.format(minor / 100);
}

export function validatePurchasePage(value, expectedMode) {
  if (!isRecord(value) || !["test", "live"].includes(value.mode) || !Array.isArray(value.items) ||
      value.items.length > pageLimit || !Object.hasOwn(value, "nextCursor")) throw unavailable();
  if (value.mode !== expectedMode) throw Object.assign(unavailable(), { code: "purchase_mode_changed" });

  const items = value.items.map(item => {
    if (!isRecord(item)) throw unavailable();
    const { reference, amountMinor, currency, status, refundedMinor, reviewRequired, createdAt, paidAt, refundedAt } = item;
    if (typeof reference !== "string" || !referencePattern.test(reference) || currency !== "INR" ||
        !["pending", "paid", "refunded"].includes(status) || typeof reviewRequired !== "boolean" ||
        !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !Number.isSafeInteger(refundedMinor) ||
        refundedMinor < 0 || refundedMinor > amountMinor || !validTime(createdAt) ||
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
