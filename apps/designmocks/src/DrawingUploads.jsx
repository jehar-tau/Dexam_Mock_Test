import React, { useEffect, useState } from "react";
import { platform } from "./platform.js";
export function DrawingUploads({
  attemptId,
  questionId,
  initial = [],
  invoke = async (body) => {
    const { data, error } = await platform.functions.invoke("drawing-media", {
      body,
    });
    if (error) throw error;
    return data;
  },
}) {
  const [items, setItems] = useState(initial),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (initial.length) return;
    invoke({ action: "list", attemptId, questionId })
      .then((result) => setItems(result.items ?? []))
      .catch((error) => setMessage(error.message));
  }, [attemptId, questionId]);
  const upload = async (e) => {
    const files = [...e.target.files].slice(0, 5 - items.length);
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
      setMessage(error.message);
    } finally {
      e.target.value = "";
    }
  };
  return (
    <div className="drawing-uploads">
      <h3>Your drawing images</h3>
      <p>
        Upload up to five clear PNG, JPEG or WebP images in the order they
        should be reviewed.
      </p>
      <label className="button quiet">
        Add images
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={upload}
          disabled={items.length >= 5}
        />
      </label>
      <ol>
        {items.map((x) => (
          <li key={x.id}>
            <span>{x.name || `Image ${x.ordinal}`}</span>
            <button className="text-button" type="button" aria-label={`Remove ${x.name || `image ${x.ordinal}`}`} onClick={async () => {
              try {
                await invoke({ action: "remove", id: x.id });
                setItems((current) => current.filter((item) => item.id !== x.id));
                setMessage("Drawing image removed.");
              } catch (error) { setMessage(error.message); }
            }}>Remove</button>
          </li>
        ))}
      </ol>
      {message && <p role="status">{message}</p>}
    </div>
  );
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
        invoke={async (request) => request instanceof FormData
          ? { id: crypto.randomUUID(), ordinal: Number(request.get("ordinal")) }
          : request.action === "list" ? { items: [] } : { removed: request.id }}
      />
    </section>
  );
}
