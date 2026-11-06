import React, { useEffect, useRef, useState } from "react";
import { platform } from "./platform.js";
import { drawingUploadWindow } from "./drawing-upload-window.js";

async function drawingMedia(body) {
  const { data, error } = await platform.functions.invoke("drawing-media", { body });
  if (error) throw error;
  return data;
}

export function DrawingUploads({
  attemptId,
  questionId,
  invoke = drawingMedia,
}) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const fileInput = useRef(null);
  useEffect(() => {
    let current = true;
    invoke({ action: "list", attemptId, questionId })
      .then((result) => { if (current) setItems(result.items ?? []); })
      .catch(() => { if (current) setMessage("Couldn’t load your saved pages."); });
    return () => { current = false; };
  }, [attemptId, questionId, invoke, loadAttempt]);
  const upload = async (event) => {
    if (busy || !items) return;
    const input = event.currentTarget;
    const files = [...input.files].slice(0, 5 - items.length);
    if (!files.length) return;
    setBusy(true);
    setMessage("Saving drawing images…");
    const used = new Set(items.map((item) => item.ordinal));
    const ordinals = [1, 2, 3, 4, 5].filter((ordinal) => !used.has(ordinal));
    try {
      for (const [index, file] of files.entries()) {
        const form = new FormData();
        form.set("attemptId", attemptId);
        form.set("questionId", questionId);
        form.set("ordinal", String(ordinals[index]));
        form.set("file", file);
        const result = await invoke(form);
        setItems((x) => [
          ...x,
          { id: result.id, name: file.name, ordinal: result.ordinal },
        ]);
      }
      setMessage("Drawing images saved privately.");
    } catch (error) {
      setMessage("An upload did not confirm. Check your saved pages before adding the remaining images.");
      setItems(null);
      setLoadAttempt((attempt) => attempt + 1);
    } finally {
      input.value = "";
      setBusy(false);
    }
  };
  return (
    <div className="drawing-uploads">
      <h3>Your drawing images</h3>
      <p>
        Upload up to five clear PNG, JPEG or WebP images in the order they
        should be reviewed.
      </p>
      <button className="button quiet" type="button" disabled={!items || busy || items.length >= 5}
        onClick={() => fileInput.current?.click()}>Add images</button>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={upload} />
      <ol>
        {items?.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => (
          <li key={item.id}>
            <span>{item.name || `Image ${item.ordinal}`}</span>
            <button className="text-button" type="button" disabled={busy} aria-label={`Remove ${item.name || `image ${item.ordinal}`}`} onClick={async () => {
              setBusy(true);
              try {
                await invoke({ action: "remove", id: item.id });
                setItems((current) => current.filter((page) => page.id !== item.id));
                setMessage("Drawing image removed.");
              } catch {
                setMessage("Couldn’t confirm the removal. Check your saved pages.");
                setItems(null);
                setLoadAttempt((attempt) => attempt + 1);
              } finally { setBusy(false); }
            }}>Remove</button>
          </li>
        ))}
      </ol>
      {items === null && message && <button type="button" className="text-button" onClick={() => {
        setMessage("");
        setLoadAttempt((attempt) => attempt + 1);
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
    {tasks.map((item) => <article key={item.id}>
      <h3>{item.prompt}</h3>
      <DrawingUploads attemptId={attempt.id} questionId={item.id} invoke={invoke} />
    </article>)}
  </section>;
}

export const previewDrawingMedia = async (request) => request instanceof FormData
  ? { id: crypto.randomUUID(), ordinal: Number(request.get("ordinal")) }
  : request.action === "list" ? { items: [] } : { removed: request.id };

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
