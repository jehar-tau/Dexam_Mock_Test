import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawingUploadWindow } from "./drawing-upload-window.js";
import { checkDrawingFiles, drawingInventory, drawingPageReceipt, drawingUploadFailure, planDrawingPages } from "./drawing-upload.js";
import { yearDrawingPhoto } from "./year-drawing-photo.mjs";
import { openSessionDrawingPhotos } from "./session-drawing-photos.js";
import { DrawingPhotoPreview } from "./DrawingPhotoPreview.jsx";
import { DrawingPages } from "./DrawingInspection.jsx";

export function DrawingUploads({
  attemptId,
  questionId,
  maxImages = 5,
  historical = false,
  onWritingChange,
  onPageCount,
  invoke,
}) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pending, setPending] = useState([]);
  const [drafts, setDrafts] = useState([]);
  useEffect(() => {
    if (items) onPageCount?.(questionId, items.length);
  }, [items, questionId, onPageCount]);
  const fileInput = useRef(null);
  const previewHeading = useRef(null);
  const selecting = drafts.length > 0;
  useEffect(() => { if (selecting) previewHeading.current?.focus(); }, [selecting]);
  const lifetime = useRef(null);
  const writing = useRef(false);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  const openPages = useCallback(signal => openSessionDrawingPhotos(invoke, {attemptId, questionId}, signal), [invoke, attemptId, questionId]);
  useEffect(() => {
    const controller = new AbortController();
    invoke({ action: "list", attemptId, questionId }, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setItems(drawingInventory(result));
      })
      .catch(() => { if (!controller.signal.aborted) setMessage("Couldn’t load your saved pages."); });
    return () => controller.abort();
  }, [attemptId, questionId, invoke, loadAttempt]);

  const conflict = pending.find(page => items?.some(item => item.ordinal === page.ordinal));
  const reload = () => {
    setItems(null);
    setLoadAttempt(value => value + 1);
  };
  const setWriting = value => {
    if (value === writing.current) return;
    writing.current = value;
    onWritingChange?.(value);
  };
  const save = async (pages, confirmed = false) => {
    const signal = lifetime.current.signal;
    if ((writing.current && !confirmed) || signal.aborted || !pages.length) return;
    setWriting(true);
    setDrafts([]);
    setBusy(true);
    setMessage("Saving drawing images…");
    let remaining = pages;
    try {
      for (const {file, ordinal, turns, name} of pages) {
        const form = new FormData();
        form.set("attemptId", attemptId);
        form.set("questionId", questionId);
        form.set("ordinal", String(ordinal));
        if (turns) {
          try { form.set("file", await yearDrawingPhoto(file, turns)); }
          catch (error) { setMessage(error.message); setPending([]); return; }
          signal.throwIfAborted();
        } else form.set("file", file);
        const result = await invoke(form, signal);
        signal.throwIfAborted();
        const id = drawingPageReceipt(result, ordinal);
        setItems(current => [...current, {id, name: name || file.name, ordinal}]);
        remaining = remaining.slice(1);
      }
      setPending([]);
      setMessage("Drawing images saved privately.");
    } catch (error) {
      if (signal.aborted) return;
      // A rejected image needs replacement. Keep the other selected pages in order.
      const replace = ["invalid_image", "image_size", "request_size", "image_dimensions"].includes(error?.drawingCode);
      setPending(replace ? remaining.slice(1) : remaining);
      setMessage(drawingUploadFailure(error));
      reload();
    } finally {
      setWriting(false);
      if (!signal.aborted) setBusy(false);
    }
  };
  const discardDrafts = () => {
    setDrafts([]);
    setMessage("");
    setWriting(false);
  };
  const upload = async event => {
    const input = event.currentTarget;
    const files = [...input.files];
    input.value = "";
    if (writing.current || pending.length || !items || !files.length) return;
    const {pages, error} = planDrawingPages(files, items, maxImages);
    const invalid = error || (historical ? null : checkDrawingFiles(files));
    if (invalid) { setMessage(invalid); return; }
    if (!historical) { void save(pages); return; }
    const signal = lifetime.current.signal;
    setWriting(true);
    setBusy(true);
    setMessage("Preparing your preview…");
    try {
      const ready = [];
      for (const page of pages) {
        const file = await yearDrawingPhoto(page.file);
        signal.throwIfAborted();
        ready.push({ ordinal: page.ordinal, file, name: page.file.name, turns: 0 });
      }
      setDrafts(ready);
      setMessage("");
    } catch (cause) {
      if (!signal.aborted) setMessage(cause.message);
      setWriting(false);
    } finally { if (!signal.aborted) setBusy(false); }
  };
  return (
    <div className="drawing-uploads">
      <h3>Your drawing images</h3>
      <p>
        {historical ? `Add up to ${maxImages} photos in page order, up to 12 MB each. Photos are saved privately as JPEGs.` :
          "Upload up to five clear PNG, JPEG or WebP images in the order they should be reviewed. Each image can be up to 10 MB, 24 megapixels and 12,000 pixels on either side. Use still images."}
      </p>
      <button className="button quiet" type="button" disabled={!items || busy || pending.length > 0 || drafts.length > 0 || items.length >= maxImages}
        onClick={() => fileInput.current?.click()}>Add images</button>
      <input ref={fileInput} type="file" accept={historical ? "image/png,image/jpeg,image/heic,image/heif,.heic,.heif" : "image/png,image/jpeg,image/webp"} multiple hidden onChange={upload} />
      {historical && <label className="text-button">Take a photo<input aria-label="Take a photo" type="file" accept="image/*" capture="environment" onChange={upload} disabled={!items || busy || pending.length > 0 || drafts.length > 0 || items.length >= maxImages} /></label>}
      {drafts.length > 0 && <section aria-label="Photo preview">
        <h4 ref={previewHeading} tabIndex={-1}>Check your photos</h4>
        <div className="drawing-photo-grid">{drafts.map(page => <DrawingPhotoPreview key={page.ordinal} page={page}
          rotate={() => setDrafts(current => current.map(item => item.ordinal === page.ordinal ? { ...item, turns: (item.turns + 1) % 4 } : item))} />)}</div>
        <button type="button" className="button" onClick={() => void save(drafts, true)}>Save {drafts.length === 1 ? "photo" : "photos"}</button>
        <button type="button" className="text-button" onClick={discardDrafts}>Discard selection</button>
      </section>}
      {pending.length > 0 && <div>
        {conflict && <p>Page {conflict.ordinal} already has a saved image. Inspect your saved pages before retrying.</p>}
        <button className="button quiet" type="button" disabled={!items || busy || Boolean(conflict)}
          onClick={() => void save(pending)}>Retry remaining images</button>
        {conflict && <button className="text-button" type="button" disabled={busy}
          onClick={() => setPending(current => current.filter(page => page !== conflict))}>Keep saved page {conflict.ordinal}</button>}
        <button className="text-button" type="button" disabled={busy}
          onClick={() => { setPending([]); setMessage(""); }}>Discard pending selection</button>
      </div>}
      <ol>
        {items?.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => (
          <li key={item.id} value={item.ordinal}>
            <span>{item.name || `Image ${item.ordinal}`}</span>
            <button className="text-button" type="button" disabled={busy || drafts.length > 0} aria-label={`Remove ${item.name || `image ${item.ordinal}`}`} onClick={async () => {
              const signal = lifetime.current.signal;
              if (writing.current || signal.aborted) return;
              writing.current = true;
              onWritingChange?.(true);
              setBusy(true);
              try {
                const result = await invoke({ action: "remove", id: item.id }, signal);
                signal.throwIfAborted();
                if (result?.removed !== item.id) throw new Error("Unconfirmed drawing removal.");
                setItems((current) => current.filter((page) => page.id !== item.id));
                setMessage(result.cleanupPending === true
                  ? "Drawing image removed from your submission. Private file cleanup is still pending."
                  : "Drawing image removed.");
              } catch {
                if (!signal.aborted) {
                  setMessage("Couldn’t confirm the removal. Check your saved pages.");
                  reload();
                }
              } finally {
                writing.current = false;
                onWritingChange?.(false);
                if (!signal.aborted) setBusy(false);
              }
            }}>Remove</button>
          </li>
        ))}
      </ol>
      {!busy && items?.length > 0 && <DrawingPages scopeKey={`${attemptId}:${questionId}:${items.map(page => page.id).join(",")}`} load={openPages} />}
      {items === null && message && <button type="button" className="text-button" onClick={() => {
        setMessage("");
        reload();
      }}>Reload saved pages</button>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}

export function DrawingUploadWindow({ attempt, serverTime, invoke }) {
  const window = drawingUploadWindow(attempt, serverTime);
  if (!window) return null;
  const { remainingSeconds, tasks } = window;
  return <section className="drawing-upload-window" aria-label="Drawing upload window">
    <span className="eyebrow">FIXED UPLOAD WINDOW</span>
    <h2>Upload your drawing pages now.</h2>
    <p>Upload or replace pages by {new Date(attempt.uploadDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. The server timer continues through power or internet loss.</p>
    <p role="timer"><b>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}</b> remaining to upload</p>
    {tasks.map((item) => <article key={`${attempt.id}:${item.id}`}>
      <h3>{item.prompt}</h3>
      <DrawingUploads attemptId={attempt.id} questionId={item.id} invoke={invoke} />
    </article>)}
  </section>;
}

export async function previewDrawingMedia(request) {
  if (request instanceof FormData) return {id: crypto.randomUUID(), ordinal: Number(request.get("ordinal"))};
  if (request.action === "list") return {items: []};
  if (request.action === "pages") {
    const now = Date.now();
    return {delivery: "session", serverNow: new Date(now).toISOString(), expiresAt: new Date(now + 300000).toISOString(),
      images: [{id: "preview", ordinal: 1, mimeType: "image/png"}]};
  }
  if (request.action === "page") {
    const canvas = document.createElement("canvas");
    canvas.width = 500; canvas.height = 300;
    const frame = canvas.getContext("2d");
    frame.fillStyle = "#f2eadf"; frame.fillRect(0, 0, 500, 300);
    frame.strokeStyle = "#211d1b"; frame.lineWidth = 8;
    frame.beginPath(); frame.moveTo(80, 240); frame.lineTo(250, 70); frame.lineTo(420, 240); frame.closePath(); frame.stroke();
    return await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  }
  return {removed: request.id};
}

export function DrawingUploadsPreview() {
  return (
    <section className="wrap section">
      <h1>
        Submit your <em>drawing.</em>
      </h1>
      <div className="notice" aria-label="Fixed drawing upload window">
        After the drawing timer ends, this paper provides a fixed 15-minute upload window. The deadline keeps running through disconnections and cannot be restarted.
      </div>
      <DrawingUploads
        attemptId="preview"
        questionId="preview"
        invoke={previewDrawingMedia}
      />
    </section>
  );
}
