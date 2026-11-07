import React, { useEffect, useRef, useState } from "react";
import { downloadAccountExport } from "./account-export.js";

export { downloadAccountExport } from "./account-export.js";

export function AccountPrivacy({ accountId, requests = [], onExport, onRequestDeletion, onCancel }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const live = useRef(true);
  const exportRequest = useRef(null);
  const owner = useRef(accountId);
  owner.current = accountId;
  useEffect(() => {
    live.current = true;setBusy("");setMessage("");
    return () => { live.current = false;exportRequest.current?.abort(); };
  }, [accountId]);
  const active = requests.find(item => item.type === "account_deletion" && ["open", "in_progress"].includes(item.status));
  const exportData = async () => {
    const requestedOwner = accountId;
    const controller = new AbortController();
    exportRequest.current = controller;
    setBusy("export");setMessage("");
    try {
      const data = await onExport({ signal: controller.signal });
      if (!live.current || owner.current !== requestedOwner || controller.signal.aborted) return;
      downloadAccountExport(data, requestedOwner);
      setMessage("Your private JSON export was downloaded to this device.");
    } catch (error) { if (live.current && owner.current === requestedOwner && !controller.signal.aborted) setMessage(error.message); }
    finally {
      if (exportRequest.current === controller) exportRequest.current = null;
      if (live.current && owner.current === requestedOwner && !controller.signal.aborted) setBusy("");
    }
  };
  const requestDeletion = async () => {
    setBusy("delete");setMessage("");
    try {
      await onRequestDeletion();
      setMessage("Deletion request received. Your account remains active while the team verifies the request and applicable record-retention duties.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };
  return <section className="account-privacy" aria-label="Your data and account">
    <h3>Your data and account</h3>
    <p>Download a private copy of your profile, saved answers, released results, progress, community contributions, reports and access records. Scores and teacher feedback are included after their release.</p>
    <button className="button quiet" disabled={Boolean(busy)} onClick={exportData}>{busy === "export" ? "Preparing your data…" : "Download my data"}</button>
    <p>Account deletion is a reviewed request, not an instant browser action. This prevents accidental loss and allows legally required purchase records to be handled correctly.</p>
    {active ? <div className="notice"><b>Deletion request: {active.status.replaceAll("_", " ")}</b>
      {active.adminNote && <p>{active.adminNote}</p>}
      {active.status === "open" && <button className="text-button" disabled={Boolean(busy)} onClick={async () => {
        setBusy("cancel");try { await onCancel(active.id);setMessage("Deletion request cancelled."); }
        catch (error) { setMessage(error.message); } finally { setBusy(""); }
      }}>Cancel deletion request</button>}
    </div> : <button className="text-button" disabled={Boolean(busy)} onClick={requestDeletion}>Request account deletion</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}

export function AccountPrivacyPreview() {
  const [requests, setRequests] = useState([]);
  return <section className="wrap section account-card"><h1>Account privacy <em>controls.</em></h1>
    <AccountPrivacy accountId="private-preview" requests={requests} onExport={async () => ({ schemaVersion: 2,
      exportedAt: new Date().toISOString(), accountId: "private-preview", profile: null, attempts: [], questionReports: [],
      results: { examMocks: [], allIndia: [], drawingReviews: [] },
    })} onRequestDeletion={async () => setRequests([{ id: "preview", type: "account_deletion", status: "open" }])} onCancel={async () => setRequests([])} />
  </section>;
}
