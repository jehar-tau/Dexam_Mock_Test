import { resolveProviderOrder } from './provider-order.mjs';
import { reportCommerceFailure } from './commerce-operations.mjs';
import { JsonRequestError, readJsonObject } from './request-json.mjs';

// The Edge entry point and isolated integration harness use this same handler.
// Provider transport injection is a code dependency, never a configurable URL.
export function createOrderHandler({ createClient, readEnvironment, providerFetch = globalThis.fetch,
  sdkFetch = globalThis.fetch, timeoutMilliseconds = 18000, reportFailure = reportCommerceFailure }) {
  return async request => {
    const origin = readEnvironment('DMOCKS_CHECKOUT_ORIGIN') ?? readEnvironment('PUBLIC_APP_ORIGIN');
    const cors = {
      'Access-Control-Allow-Origin': origin ?? 'https://invalid.invalid',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
    };
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    const unavailable = () => {
      reportFailure('checkout_unconfirmed');
      return json({ error: 'Could not confirm checkout. Check your pass before trying again.' }, 503);
    };
    if (!origin || request.headers.get('origin') !== origin) return json({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const url = readEnvironment('SUPABASE_URL'), anon = readEnvironment('SUPABASE_ANON_KEY'),
      service = readEnvironment('SUPABASE_SERVICE_ROLE_KEY'), key = readEnvironment('RAZORPAY_KEY_ID'),
      secret = readEnvironment('RAZORPAY_KEY_SECRET');
    if (!url || !anon || !service || !key || !secret)
      return json({ error: 'Checkout is not active. No charge has been made.' }, 503);
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer \S+$/.test(authorization)) return json({ error: 'Sign in required' }, 401);
    if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 18000) return unavailable();
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), timeoutMilliseconds);
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = () => reject(new Error('Checkout deadline.')); });
    deadline.signal.addEventListener('abort', rejectAbort, { once: true });
    const boundedFetch = async (input, init = {}) => {
      deadline.signal.throwIfAborted();
      const signal = init.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal;
      const response = await sdkFetch(input, { ...init, signal, redirect: 'error' });
      deadline.signal.throwIfAborted();
      return response;
    };
    const operation = async () => {
      const student = createClient(url, anon, { global: { headers: { Authorization: authorization }, fetch: boundedFetch },
        auth: { persistSession: false } });
      const { data: user, error: identityError } = await student.auth.getUser(authorization.slice(7));
      deadline.signal.throwIfAborted();
      if (identityError || !user?.user?.id) return json({ error: 'Sign in required' }, 401);
      let input;
      try {
        input = await readJsonObject(request, 4096, 'checkout');
      } catch (failure) {
        if (!(failure instanceof JsonRequestError)) throw failure;
        return json({ error: 'Invalid checkout request.' }, failure.status);
      }
      deadline.signal.throwIfAborted();
      if (input?.plan !== 'annual') return json({ error: 'Unknown plan' }, 400);
      const { data: order, error } = await student.rpc('prepare_order');
      deadline.signal.throwIfAborted();
      if (error || !order) return json({ error: 'Annual access is not available for purchase. Check your account and the published terms.' }, 409);
      const providerOrder = await resolveProviderOrder(order, { keyId: key, keySecret: secret,
        fetcher: providerFetch, signal: deadline.signal });
      deadline.signal.throwIfAborted();
      if (!order.providerOrderId) {
        const admin = createClient(url, service, { global: { fetch: boundedFetch }, auth: { persistSession: false } });
        const { data: saved, error: attachError } = await admin.rpc('attach_provider_order', { p_id: order.id, p_provider_id: providerOrder });
        deadline.signal.throwIfAborted();
        if (attachError || saved !== providerOrder) throw new Error('Checkout attachment could not be verified.');
      }
      return json({ orderId: providerOrder, keyId: key, amount: order.amount, currency: order.currency });
    };
    try { return await Promise.race([operation(), aborted]); }
    catch { return unavailable(); }
    finally { clearTimeout(timer); deadline.signal.removeEventListener('abort', rejectAbort); }
  };
}
