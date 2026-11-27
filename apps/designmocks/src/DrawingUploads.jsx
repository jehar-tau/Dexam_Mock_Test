import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawingUploadWindow } from "./drawing-upload-window.js";
import { checkDrawingFiles, drawingInventory, drawingPageReceipt, drawingUploadFailure, planDrawingPages } from "./drawing-upload.js";
import { yearDrawingPhoto } from "./year-drawing-photo.mjs";
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
  useEffect(() => {
    if (items) onPageCount?.(questionId, items.length);
  }, [items, questionId, onPageCount]);
  const fileInput = useRef(null);
  const lifetime = useRef(null);
  const writing = useRef(false);
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  const openPages = useCallback(signal => invoke({ action: "open", attemptId, questionId }, signal), [invoke, attemptId, questionId]);
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
  const save = async pages => {
    const signal = lifetime.current.signal;
    if (writing.current || signal.aborted || !pages.length) return;
    writing.current = true;
    onWritingChange?.(true);
    setBusy(true);
    setMessage("Saving drawing images…");
    let remaining = pages;
    try {
      for (const {file, ordinal} of pages) {
        const form = new FormData();
        form.set("attemptId", attemptId);
        form.set("questionId", questionId);
        form.set("ordinal", String(ordinal));
        if (historical) {
          try { form.set("file", await yearDrawingPhoto(file)); }
          catch (error) { setMessage(error.message); setPending([]); return; }
          signal.throwIfAborted();
        } else form.set("file", file);
        const result = await invoke(form, signal);
        signal.throwIfAborted();
        const id = drawingPageReceipt(result, ordinal);
        setItems(current => [...current, {id, name: file.name, ordinal}]);
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
      writing.current = false;
      onWritingChange?.(false);
      if (!signal.aborted) setBusy(false);
    }
  };
  const upload = event => {
    const input = event.currentTarget;
    const files = [...input.files];
    input.value = "";
    if (writing.current || pending.length || !items || !files.length) return;
    const {pages, error} = planDrawingPages(files, items, maxImages);
    const invalid = error || (historical ? null : checkDrawingFiles(files));
    if (invalid) { setMessage(invalid); return; }
    void save(pages);
  };
  return (
    <div className="drawing-uploads">
      <h3>Your drawing images</h3>
      <p>
        {historical ? `Add up to ${maxImages} photos in page order, up to 12 MB each. Photos are saved privately as JPEGs.` :
          "Upload up to five clear PNG, JPEG or WebP images in the order they should be reviewed. Each image can be up to 10 MB, 24 megapixels and 12,000 pixels on either side. Use still images."}
      </p>
      <button className="button quiet" type="button" disabled={!items || busy || pending.length > 0 || items.length >= maxImages}
        onClick={() => fileInput.current?.click()}>Add images</button>
      <input ref={fileInput} type="file" accept={historical ? "image/png,image/jpeg,image/heic,image/heif,.heic,.heif" : "image/png,image/jpeg,image/webp"} multiple hidden onChange={upload} />
      {historical && <label className="text-button">Take a photo<input aria-label="Take a photo" type="file" accept="image/*" capture="environment" onChange={upload} disabled={!items || busy || pending.length > 0 || items.length >= maxImages} /></label>}
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
            <button className="text-button" type="button" disabled={busy} aria-label={`Remove ${item.name || `image ${item.ordinal}`}`} onClick={async () => {
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

export const previewDrawingMedia = async (request) => request instanceof FormData
  ? { id: crypto.randomUUID(), ordinal: Number(request.get("ordinal")) }
  : request.action === "list" ? { items: [] } : request.action === "open" ? { images: [{ id: "preview", ordinal: 1,
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f2eadf'/%3E%3Cpath d='M80 240 L250 70 L420 240 Z' fill='none' stroke='%23211d1b' stroke-width='8'/%3E%3C/svg%3E" }] } : { removed: request.id };

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
