import React, { useState } from "react";
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
  const upload = async (e) => {
    const files = [...e.target.files].slice(0, 5 - items.length);
    for (const file of files) {
      const form = new FormData();
      form.set("attemptId", attemptId);
      form.set("questionId", questionId);
      form.set("ordinal", String(items.length + 1));
      form.set("file", file);
      const result = await invoke(form);
      setItems((x) => [
        ...x,
        { id: result.id, name: file.name, ordinal: result.ordinal },
      ]);
    }
    setMessage("Drawing images saved privately.");
    e.target.value = "";
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
          <li key={x.id}>{x.name || `Image ${x.ordinal}`}</li>
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
      <DrawingUploads
        attemptId="preview"
        questionId="preview"
        invoke={async (f) => ({
          id: crypto.randomUUID(),
          ordinal: Number(f.get("ordinal")),
        })}
      />
    </section>
  );
}
