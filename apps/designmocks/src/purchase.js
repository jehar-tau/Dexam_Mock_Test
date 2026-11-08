import { withAccountDeadline } from './account-request.js';

export function purchaseOrder(value, expectedMode) {
  if (!value || Array.isArray(value) || value.amount !== 119300 || value.currency !== 'INR' ||
      typeof value.orderId !== 'string' || !/^order_[A-Za-z0-9]{1,194}$/.test(value.orderId) ||
      typeof value.keyId !== 'string' || !/^rzp_(test|live)_[A-Za-z0-9]{1,180}$/.test(value.keyId))
    throw new Error('The checkout response could not be verified.');
  if(expectedMode!==undefined&&(!['test','live'].includes(expectedMode)||!value.keyId.startsWith('rzp_'+expectedMode+'_')))
    throw new Error('The checkout mode could not be verified.');
  return { orderId: value.orderId, keyId: value.keyId, amount: value.amount, currency: value.currency };
}

export function purchasePass(value, expectedMode) {
  const instant = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
  if (!value || typeof value.active !== 'boolean' ||
      (value.active ? !instant(value.expiresAt) || value.revoked === true : value.expiresAt !== null && !instant(value.expiresAt)))
    throw new Error('The pass response could not be verified.');
  if(expectedMode!==undefined&&(!['test','live'].includes(expectedMode)||value.mode!==expectedMode))
    throw new Error('The pass mode could not be verified.');
  return { active: value.active, expiresAt: value.expiresAt };
}

let checkoutScript;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  checkoutScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    const failed = () => { checkoutScript = null; script.remove(); reject(new Error('Checkout did not load.')); };
    script.onload = () => typeof window.Razorpay === 'function' ? resolve(window.Razorpay) : failed();
    script.onerror = failed;
    document.head.append(script);
  });
  return checkoutScript;
}

function pause(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const interrupted = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', interrupted); resolve(); }, milliseconds);
    signal.addEventListener('abort', interrupted, { once: true });
  });
}

// This coordinator owns no entitlement. Only a verified current-account server
// read may display an active pass; widget callbacks merely request that read.
export function createPurchaseFlow({ services, termsVersion, loadCheckout = loadRazorpay, onChange, expectedMode = 'test',
  requestMilliseconds = 20000, confirmationMilliseconds = 65000, pollMilliseconds = 3000, maximumPolls = 20 }) {
  const controller = new AbortController();
  let status = 'checking', busy = false, widget = null, confirming = false;
  const current = () => !controller.signal.aborted && services.isCurrent();
  const publish = (next, error = '') => { if (current()) { status = next; onChange({ status, error }); } };
  const closeWidget = () => { const owned = widget; widget = null; try { owned?.close(); } catch {} };
  const request = operation => withAccountDeadline(operation, controller.signal, requestMilliseconds);
  const readPass = async signal => {
    const access = purchasePass(await services.rpc('my_pass', undefined, signal), expectedMode);
    await services.checkIdentity(signal);
    return access;
  };
  async function refresh() {
    if (!current() || busy || confirming || status === 'checkout') return false;
    busy = true; publish('checking');
    try {
      const access = await request(readPass);
      await request(signal => services.presentForCurrentAccount(() => publish(access.active ? 'paid' : 'idle'), signal));
      return true;
    } catch {
      publish('unconfirmed', 'Couldn’t confirm your pass. Check it again before opening checkout.');
      return false;
    } finally { busy = false; }
  }
  async function confirm() {
    if (!current() || confirming) return;
    confirming = true;
    try {
      const active = await withAccountDeadline(async signal => {
        for (let n = 0; n < maximumPolls; n++) {
          const access = await withAccountDeadline(readPass, signal, requestMilliseconds);
          if (access.active) {
            await services.presentForCurrentAccount(() => publish('paid'), signal);
            return true;
          }
          if (n + 1 < maximumPolls) await pause(pollMilliseconds, signal);
        }
        return false;
      }, controller.signal, confirmationMilliseconds);
      if (!active) publish('pending');
    } catch { publish('pending'); }
    finally { confirming = false; }
  }
  async function start(accepted) {
    if (!current() || busy || confirming || status !== 'idle' || accepted !== true) return false;
    busy = true; publish('opening');
    try {
      if (typeof termsVersion !== 'string' || !termsVersion.trim()) throw new Error('Terms unavailable.');
      await request(async signal => {
        await services.rpc('accept_current_terms', { p_version: termsVersion }, signal);
        const { data, error } = await services.functions.invoke('create-order', { body: { plan: 'annual' }, signal });
        signal.throwIfAborted(); if (error) throw error;
        const order = purchaseOrder(data, expectedMode), Razorpay = await loadCheckout();
        signal.throwIfAborted(); if (typeof Razorpay !== 'function') throw new Error('Checkout unavailable.');
        // Recheck the SDK's current cached session after server verification, then
        // construct/open synchronously in that same current-account operation.
        await services.presentForCurrentAccount(() => {
          signal.throwIfAborted(); if (!current()) throw new Error('Purchase access changed.');
          const owned = new Razorpay({ key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
            name: 'DMocks', description: '12 months of access to the released paper catalogue', theme: { color: '#244735' },
            handler: () => {
              if (!current() || status !== 'checkout' || widget !== owned) return;
              publish('verifying'); closeWidget(); void confirm();
            },
            modal: { ondismiss: () => {
              if (!current() || widget !== owned) return;
              widget = null; if (status === 'checkout') publish('pending');
            } },
          });
          if (typeof owned.open !== 'function' || typeof owned.close !== 'function' || typeof owned.on !== 'function')
            throw new Error('Checkout unavailable.');
          widget = owned;
          owned.on('payment.failed', () => {
            if (current() && status === 'checkout' && widget === owned) { publish('pending'); closeWidget(); }
          });
          publish('checkout'); owned.open();
        }, signal);
      });
      return true;
    } catch {
      publish('unconfirmed', 'Couldn’t confirm checkout. Check your pass before trying again.');
      closeWidget(); return false;
    } finally { busy = false; }
  }
  function dispose() { controller.abort(); closeWidget(); }
  return Object.freeze({ refresh, start, dispose });
}
