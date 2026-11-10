import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AccountAccessBoundary, useAccountServices } from "./AccountAccess.jsx";
import { withAccountDeadline } from "./account-request.js";
import { environment } from "./environment.js";
import { appendPurchasePage, purchaseAmount, purchaseStatusLabels, validatePurchasePage } from "./purchase-history.js";
import { useAuthState } from "./useAuth.js";

const orderDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const expectedMode = environment.production ? "live" : "test";

function OrderTime({ value }) {
  return <time dateTime={value}>{orderDate.format(new Date(value))}</time>;
}

function PurchaseOrder({ order, actorId, mode }) {
  const heading = `purchase-heading-${order.reference}`;
  return <li><article id={`purchase-${order.reference}`} tabIndex={-1} aria-labelledby={heading}>
    <h2 id={heading}>Annual pass</h2>
    <span className="status-pill">{purchaseStatusLabels[order.status]}</span>
    <dl className="purchase-order-details">
      <div><dt>Order reference</dt><dd><code>{order.reference}</code></dd></div>
      <div><dt>Order amount</dt><dd>{purchaseAmount(order.amountMinor)}</dd></div>
      <div><dt>Order created</dt><dd><OrderTime value={order.createdAt} /></dd></div>
      {order.paidAt && <div><dt>Payment confirmed</dt><dd><OrderTime value={order.paidAt} /></dd></div>}
      {order.refundedMinor > 0 && <div><dt>Refunded amount</dt><dd>{purchaseAmount(order.refundedMinor)}</dd></div>}
      {order.refundedAt && <div><dt>Refund recorded</dt><dd><OrderTime value={order.refundedAt} /></dd></div>}
    </dl>
    {order.reviewRequired && <p className="notice"><strong>Payment under review</strong></p>}
    <p><Link to="/report" state={{ purchaseSupport: { actorId, mode, reference: order.reference } }}>Get help with this order</Link></p>
  </article></li>;
}

function PurchaseHistorySession({ actorId }) {
  const services = useAccountServices();
  const [page, setPage] = useState(null);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState("");
  const lifetime = useRef(null);
  const request = useRef(null);
  const focusOrder = useRef(null);

  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  useLayoutEffect(() => {
    if (!focusOrder.current) return;
    document.getElementById(`purchase-${focusOrder.current}`)?.focus();
    focusOrder.current = null;
  }, [page]);

  async function load(cursor = null) {
    if (!lifetime.current || lifetime.current.signal.aborted || !services.isCurrent() || (cursor && request.current)) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const signal = AbortSignal.any([lifetime.current.signal, controller.signal]);
    const current = () => !signal.aborted && request.current === controller && services.isCurrent();
    const opener = document.activeElement;
    setReading(true);
    setError("");
    if (!cursor) setPage(null);
    try {
      await withAccountDeadline(async active => {
        const response = await services.rpc("my_purchase_page", {
          p_before_created_at: cursor?.createdAt ?? null,
          p_before_id: cursor?.reference ?? null,
        }, active);
        const next = validatePurchasePage(response, expectedMode);
        const result = cursor ? appendPurchasePage(page, next) : next;
        await services.presentForCurrentAccount(() => {
          if (!current()) return;
          if (cursor && (document.activeElement === opener || document.activeElement === document.body)) {
            focusOrder.current = next.items[0]?.reference ?? null;
          }
          setPage(result);
        }, active);
      }, signal);
    } catch (failure) {
      if (current()) {
        if (["22023", "purchase_mode_changed"].includes(failure?.code)) setPage(null);
        setError("Couldn’t load your purchases. Refresh and try again.");
      }
    } finally {
      if (current()) { request.current = null; setReading(false); }
    }
  }

  useEffect(() => { void load(); }, [services]);

  return <>
    <div className="inline-links">
      <button type="button" className="button quiet" onClick={() => void load()}>Refresh purchases</button>
      <Link to="/report">Contact support</Link>
    </div>
    {reading && <p role="status">Loading purchases…</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {page?.mode === "test" && <p className="notice">Test purchases</p>}
    {page?.items.length === 0 && <p>No purchases yet.</p>}
    {page?.items.length > 0 && <ol className="purchase-history-list" aria-label="Your orders">
      {page.items.map(order => <PurchaseOrder key={order.reference} order={order} actorId={actorId} mode={page.mode} />)}
    </ol>}
    {page?.nextCursor && <button type="button" className="button quiet" disabled={reading}
      onClick={() => void load(page.nextCursor)}>Load older purchases</button>}
  </>;
}

export default function PurchaseHistory() {
  const { session, loading } = useAuthState();
  const location = useLocation();
  const heading = useRef(null);
  const scopeKey = `${session?.user.id ?? "signed-out"}:${location.key}`;
  const previousScope = useRef(scopeKey);
  useLayoutEffect(() => {
    if (previousScope.current !== scopeKey && (document.activeElement === document.body ||
      heading.current?.parentElement.contains(document.activeElement))) heading.current?.focus();
    previousScope.current = scopeKey;
  }, [scopeKey]);

  return <section className="wrap section purchase-history-page" aria-labelledby="purchase-history-heading">
    <span className="eyebrow">YOUR ACCOUNT</span>
    <h1 id="purchase-history-heading" ref={heading} tabIndex={-1}>Purchase history</h1>
    <p><Link to="/account">Back to your account</Link></p>
    {loading && <p role="status">Checking your account…</p>}
    {!loading && !session && <><p>Sign in to view your purchases.</p><Link to="/account">Student sign in</Link></>}
    {!loading && session && <AccountAccessBoundary key={scopeKey} kind="purchaseHistory" actorId={session.user.id} headingRef={heading}>
      <PurchaseHistorySession actorId={session.user.id} />
    </AccountAccessBoundary>}
  </section>;
}
