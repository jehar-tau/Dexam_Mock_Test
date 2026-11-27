import { keyMatchesMode } from './commerce.mjs';

const api = 'https://api.razorpay.com/v1/orders';
const providerId = /^order_[A-Za-z0-9]{1,194}$/;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const unavailable = () => new Error('Checkout order could not be verified.');

// Server prices in paise (owner's plan, 28 November 2026). The database plan
// row is authoritative; this is a second check before any provider call.
export const PLAN_AMOUNTS = Object.freeze({ annual: 128400, duo: 214200 });
export const planOf = order => order?.plan ?? 'annual';
const priced = order => Object.hasOwn(PLAN_AMOUNTS, planOf(order)) && PLAN_AMOUNTS[planOf(order)] === order.amount;

function prepared(order, keyId, keySecret) {
  if (!order || !uuid.test(order.id ?? '') || !priced(order) || order.currency !== 'INR' ||
      !['test', 'live'].includes(order.mode) || !keyMatchesMode(keyId, order.mode) ||
      !/^rzp_(?:test|live)_[A-Za-z0-9]{1,180}$/.test(keyId ?? '') ||
      typeof keySecret !== 'string' || !keySecret.length || keySecret.length > 1000 ||
      (order.providerOrderId !== null && !providerId.test(order.providerOrderId ?? '')))
    throw unavailable();
}

function boundOrder(value, order, expectedId) {
  if (!value || value.entity !== 'order' || !providerId.test(value.id ?? '') ||
      (expectedId && value.id !== expectedId) || value.receipt !== order.id ||
      value.notes?.designmocks_order !== order.id || value.amount !== order.amount || value.currency !== order.currency ||
      !['created', 'attempted'].includes(value.status) || value.amount_paid !== 0 || value.amount_due !== order.amount ||
      (value.partial_payment !== undefined && value.partial_payment !== false))
    throw unavailable();
  return value.id;
}

// Receipt uniqueness and lookup recover a provider commit whose response or
// later database attachment was lost. Never retry a POST within one request.
// Paid/partial/ambiguous orders require webhook/operator reconciliation instead.
export async function resolveProviderOrder(order, { keyId, keySecret, fetcher = globalThis.fetch,
  signal, timeoutMilliseconds = 12000 } = {}) {
  prepared(order, keyId, keySecret);
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 18000) throw unavailable();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(unavailable()), timeoutMilliseconds);
  const current = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = () => reject(unavailable()); });
  current.addEventListener('abort', rejectAbort, { once: true });
  const headers = { Authorization: 'Basic ' + btoa(keyId + ':' + keySecret), 'Content-Type': 'application/json' };
  const request = async (url, init = {}) => {
    current.throwIfAborted();
    const response = await fetcher(url, { ...init, headers, signal: current, redirect: 'error' });
    current.throwIfAborted();
    if (!response.ok) throw unavailable();
    const text = await response.text();
    current.throwIfAborted();
    if (text.length > 65536) throw unavailable();
    return JSON.parse(text);
  };
  const lookup = async () => {
    const result = await request(api + '?receipt=' + encodeURIComponent(order.id) + '&count=2');
    if (result?.entity !== 'collection' || !Array.isArray(result.items) ||
        !Number.isInteger(result.count) || result.count !== result.items.length || result.count > 1)
      throw unavailable();
    return result.count === 0 ? null : boundOrder(result.items[0], order);
  };
  const operation = async () => {
    if (order.providerOrderId) return boundOrder(await request(api + '/' + order.providerOrderId), order, order.providerOrderId);
    const existing = await lookup();
    if (existing) return existing;
    try {
      return boundOrder(await request(api, { method: 'POST', body: JSON.stringify({
        amount: order.amount, currency: order.currency, receipt: order.id,
        partial_payment: false, notes: { designmocks_order: order.id },
      }) }), order);
    } catch {
      current.throwIfAborted();
      const recovered = await lookup();
      if (!recovered) throw unavailable();
      return recovered;
    }
  };
  try {
    current.throwIfAborted();
    return await Promise.race([operation(), aborted]);
  } finally {
    clearTimeout(timer);
    current.removeEventListener('abort', rejectAbort);
  }
}
