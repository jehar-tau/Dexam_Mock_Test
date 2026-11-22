import React, { useEffect, useRef, useState } from 'react';
import { useAdminServices } from './AdminAccess.jsx';
import { withAccountDeadline } from './account-request.js';
import { readPaymentReviews } from './admin-payments.js';
import { purchaseAmount, purchaseStatusLabels } from './purchase-history.js';

export function AdminPayments() {
  const services = useAdminServices();
  const [page, setPage] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(null), heading = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function load(cursor = null) {
    if (pending.current) return;
    const request = new AbortController(); pending.current = request;
    setBusy(true); setError(''); setPage(null);
    try {
      await withAccountDeadline(async signal => {
        const next = readPaymentReviews(await services.rpc('admin_payment_review_page', {
          p_before_created_at: cursor?.createdAt ?? null, p_before_id: cursor?.reference ?? null,
        }, signal));
        await services.presentForCurrentStaff(() => { setPage(next); heading.current?.focus(); }, signal);
      }, request.signal);
    } catch {
      if (services.isCurrent() && !request.signal.aborted) setError('Couldn’t load payment reviews. Refresh and try again.');
    } finally {
      pending.current = null;
      if (services.isCurrent() && !request.signal.aborted) setBusy(false);
    }
  }
  return <section aria-label="Payment reviews">
    <h2 ref={heading} tabIndex={-1}>Payment reviews</h2>
    <p>Inspect recorded purchases needing review. Refunds and access changes require the verified payment process.</p>
    <button type="button" disabled={busy} onClick={() => void load()}>Refresh payment reviews</button>
    {busy && <p role="status">Loading payment reviews…</p>}
    {error && <p role="alert">{error}</p>}
    {page && <><p>{page.mode === 'test' ? 'Test payments' : 'Live payments'}</p>
      {page.items.length === 0 && <p>No payments need review.</p>}
      <div className="admin-list">{page.items.map(order => <article className="bug-report-card" key={order.reference}>
        <h3>Purchase review</h3>
        <p style={{overflowWrap:'anywhere'}}>Order reference <code>{order.reference}</code></p>
        <p>{purchaseStatusLabels[order.status]} · {purchaseAmount(order.amountMinor)}</p>
        <p>Recorded refund: {purchaseAmount(order.refundedMinor)}</p>
        <p>Matching pass: {order.passState}</p>
        <p>Created {new Date(order.createdAt).toLocaleString('en-IN')}</p>
      </article>)}</div>
      {page.nextCursor && <button type="button" disabled={busy} onClick={() => void load(page.nextCursor)}>Next payment reviews</button>}
    </>}
  </section>;
}
