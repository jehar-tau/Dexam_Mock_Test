import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useAdminFunctions } from "./AdminAccess.jsx";
import { PrivateRasterImage } from "./DrawingInspection.jsx";
import { communityReviewFailure, communityReviewGroups, communityReviewInput, communityReviewMedia, validateCommunityReport } from "./community-moderation.js";

function ImageInspector({ selection, onClose }) {
  const dialog = useRef(null);
  useLayoutEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="drawing-inspection-dialog" aria-label={selection.label} onClose={onClose}>
    <div className="drawing-inspection-header"><h2>{selection.label}</h2>
      <button type="button" className="button quiet" autoFocus onClick={() => dialog.current.close()}>Close image</button></div>
    <p>Adjust the view to inspect the current attachment.</p>
    <PrivateRasterImage image={selection.image} label={selection.label} controls />
  </dialog>;
}

export function CommunityReportReview({ reportId, rpc, onClose, onReopen, onResolved }) {
  const functions = useAdminFunctions();
  const noteId = useId();
  const [report, setReport] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [mediaBusy, setMediaBusy] = useState(false);
  const [images, setImages] = useState({}), [selectedImage, setSelectedImage] = useState(null), [note, setNote] = useState("");
  const [displayed, setDisplayed] = useState({});
  const scope = useRef(null), mediaRequest = useRef(null), expiry = useRef(null), mutation = useRef(false);
  const imageEpoch = useRef(0), galleryEpoch = imageEpoch.current;
  const heading = useRef(null), imagesButton = useRef(null), inspectorButton = useRef(null);
  const reviewRoot = useRef(null), reopenButton = useRef(null), recoveryFocus = useRef(null);
  const current = controller => !controller.signal.aborted && scope.current === controller;
  const clearImages = () => { imageEpoch.current++; clearTimeout(expiry.current); setImages({}); setDisplayed({}); setSelectedImage(null); };

  async function failed(failure, controller) {
    const safe = await communityReviewFailure(failure);
    if (!current(controller)) return;
    if (reviewRoot.current?.contains(document.activeElement)) recoveryFocus.current = document.activeElement;
    if (safe.kind !== "invalid") clearImages();
    setError(safe.message);
    if (["stale", "unavailable"].includes(safe.kind)) { setReport(null); setNote(""); }
    else if (safe.kind === "incomplete") setReport(value => value ? { ...value, canDismiss: false } : null);
  }
  useEffect(() => {
    const controller = new AbortController(); scope.current = controller;
    setReport(null); setLoading(true); setError(""); setNotice(""); setNote(""); clearImages();
    (async () => {
      try {
        const value = validateCommunityReport(await rpc("admin_community_report", { p_report_id: reportId }, controller.signal), reportId);
        if (!current(controller)) return;
        if (value.status !== "open") throw { details: "community_review_unavailable" };
        setReport(value);
      } catch (failure) { await failed(failure, controller); }
      finally { if (current(controller)) setLoading(false); }
    })();
    return () => { controller.abort(); mediaRequest.current?.abort(); clearTimeout(expiry.current); };
  }, [reportId, rpc]);
  useLayoutEffect(() => { heading.current?.focus(); }, []);
  useLayoutEffect(() => {
    const previous = recoveryFocus.current;
    if (!previous || loading) return;
    recoveryFocus.current = null;
    if (!previous.isConnected && document.activeElement === document.body) (report ? heading.current : reopenButton.current)?.focus();
  }, [report, error, loading]);

  const groups = report ? communityReviewGroups(report) : [];
  const withImages = groups.filter(group => group.content.assets.length);
  const imagesReady = withImages.every(group => images[group.context]?.length === group.content.assets.length &&
    images[group.context].every(image => displayed[`${galleryEpoch}:${image.id}:${image.url}`]));
  const imageDisplayed = (event, image, ready) => {
    if (galleryEpoch !== imageEpoch.current || event.target.tagName !== "IMG" || !event.currentTarget.isConnected || !scope.current || !current(scope.current)) return;
    setDisplayed(value => ({ ...value, [`${galleryEpoch}:${image.id}:${image.url}`]: ready }));
    if (!ready) setError("A private image could not be displayed. Refresh the private images or hide the content while it is checked.");
  };
  const openImages = async () => {
    const controller = scope.current;
    if (!controller || !current(controller) || !report || mutation.current || mediaBusy || withImages.every(group => group.content.assets.some(item => !item.available))) return;
    mediaRequest.current?.abort();
    const request = new AbortController(); mediaRequest.current = request;
    const abort = () => request.abort(); controller.signal.addEventListener("abort", abort, { once: true });
    clearImages(); setMediaBusy(true); setError(""); setNotice("");
    const collected = {}, deadlines = [];
    try {
      for (const group of withImages) {
        if (group.content.assets.some(item => !item.available)) continue;
        request.signal.throwIfAborted();
        const start = performance.now();
        const { data, error: failure } = await functions.invoke("community-media", {
          body: { action: "review", reportId: report.id, reviewVersion: report.reviewVersion, context: group.context }, signal: request.signal,
        });
        request.signal.throwIfAborted();
        if (failure) throw failure;
        if (data?.error) throw data;
        const value = communityReviewMedia(data, group, performance.now() - start);
        if (!value.lifetime) throw { code: "community_review_expired" };
        collected[group.context] = value.media;
        deadlines.push(performance.now() + value.lifetime);
      }
      if (!current(controller) || request.signal.aborted || mediaRequest.current !== request) return;
      const remaining = deadlines.length ? Math.min(...deadlines) - performance.now() : 0;
      if (deadlines.length && remaining <= 0) throw { code: "community_review_expired" };
      setImages(collected);
      if (deadlines.length) expiry.current = setTimeout(() => {
        if (current(controller) && mediaRequest.current === request) {
          const inspecting = document.activeElement?.closest(".community-report-review dialog");
          clearImages(); setNotice("Private image links expired. Open the images again to continue.");
          if (inspecting) requestAnimationFrame(() => { if (current(controller)) imagesButton.current?.focus(); });
        }
      }, remaining);
    } catch (failure) {
      if (current(controller) && !request.signal.aborted && mediaRequest.current === request) await failed(failure, controller);
    } finally {
      controller.signal.removeEventListener("abort", abort);
      if (current(controller) && mediaRequest.current === request) setMediaBusy(false);
    }
  };
  const resolve = async event => {
    event.preventDefault();
    const controller = scope.current;
    if (!controller || !current(controller) || mutation.current || mediaBusy) return;
    let input;
    try { input = communityReviewInput(report, event.nativeEvent.submitter?.value, note); }
    catch (failure) { await failed(failure, controller); return; }
    if (input.p_resolution === "dismiss" && !imagesReady) { setError("View each private image before dismissing this report."); return; }
    mutation.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await rpc("admin_resolve_community_report", input, controller.signal);
      if (current(controller)) { clearImages(); await onResolved(); }
    } catch (failure) { if (current(controller)) await failed(failure, controller); }
    finally { mutation.current = false; if (current(controller)) setBusy(false); }
  };
  const closeInspector = () => {
    setSelectedImage(null);
    if (inspectorButton.current?.isConnected) inspectorButton.current.focus(); else imagesButton.current?.focus();
  };
  return <section ref={reviewRoot} className="bank-question-review community-report-review" aria-label="Community report review" style={{ overflowWrap: "anywhere" }}>
    <div className="admin-actions"><h3 ref={heading} tabIndex={-1}>Review Community report</h3>
      <button type="button" className="button quiet" onClick={onClose}>Close report</button></div>
    {loading && <p role="status">Opening current report content…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !report && <button type="button" className="button" ref={reopenButton} onClick={onReopen}>Reopen report</button>}
    {report && <>
      <p><b>Current content.</b> This content may have changed since the report was sent.</p>
      <p>Report reason: {report.reason.replaceAll("_", " ")}</p>
      {report.details && <p className="bank-question-prompt">Reporter note: {report.details}</p>}
      {!report.canDismiss && <p>Dismissal requires complete private images. You can hide the content while missing images are checked.</p>}
      {groups.map(group => <section key={group.context} aria-label={group.label} style={{ minWidth: 0 }}>
        <h4>{group.label}</h4>
        <p>{group.content.exam.toUpperCase()} · {group.content.topic} · {group.content.status}</p>
        {group.content.title && <h5>{group.content.title}</h5>}
        <p className="bank-question-prompt">{group.content.body}</p>
        {group.content.assets.some(item => !item.available) && <p className="error">Some registered images for this content are missing or unavailable. Hiding remains available; dismissal requires complete images.</p>}
        {images[group.context]?.map(image => {
          const label = `${group.label} image ${image.ordinal}`;
          return <figure className="community-image-frame" key={`${galleryEpoch}:${image.id}:${image.url}`} style={{ marginInline: 0 }}
            onLoadCapture={event => imageDisplayed(event, image, event.target.naturalWidth > 0 && event.target.naturalHeight > 0)}
            onErrorCapture={event => imageDisplayed(event, image, false)}>
            <PrivateRasterImage image={image} label={label} />
            <figcaption>Attachment {image.ordinal}</figcaption>
            <button type="button" className="button quiet" onClick={event => { inspectorButton.current = event.currentTarget; setSelectedImage({ image, label }); }}>Inspect {label.toLowerCase()}</button>
          </figure>;
        })}
      </section>)}
      {withImages.length > 0 && <div className="drawing-review-media">
        <button type="button" className="button quiet" ref={imagesButton} aria-disabled={busy || mediaBusy || withImages.every(group => group.content.assets.some(item => !item.available))} onClick={openImages}>
          {mediaBusy ? "Opening private images…" : Object.keys(images).length ? "Refresh private images" : "Open private images"}</button>
        {report.canDismiss && !imagesReady && <p>{Object.keys(images).length ? "View each private image before dismissing this report." : "Open the private images before dismissing this report."}</p>}
      </div>}
      <form className="admin-form" onSubmit={resolve} noValidate style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div style={{ minWidth: 0 }}><label htmlFor={noteId}>Review reason</label><textarea id={noteId} name="note" required minLength={8} maxLength={1000} rows={3} value={note} disabled={busy || mediaBusy}
          onChange={event => setNote(event.target.value)} style={{ minWidth: 0, width: "100%" }} /></div>
        <div className="admin-actions">
          <button className="button quiet" name="decision" value="hide" aria-disabled={busy || mediaBusy}>Hide content</button>
          <button className="button" name="decision" value="dismiss" aria-disabled={busy || mediaBusy || !report.canDismiss || !imagesReady}>Dismiss report</button>
        </div>
      </form>
      <details><summary>Review history</summary>{report.history.length ? report.history.map(event => <p key={event.id} className="bank-question-prompt">
        {event.action} · {new Date(event.createdAt).toLocaleString("en-IN")} · {event.note || "No reason recorded."}</p>) : <p>No earlier review actions.</p>}</details>
    </>}
    {selectedImage && <ImageInspector selection={selectedImage} onClose={closeInspector} />}
  </section>;
}
