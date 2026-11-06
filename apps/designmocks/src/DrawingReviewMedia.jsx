import React, { useState } from "react";
import { platform } from "./platform.js";

async function loadDrawingPages(reviewId) {
  const { data, error } = await platform.functions.invoke("drawing-review-media", { body: { reviewId } });
  if (error) throw new Error("Couldn’t open drawing pages. Refresh the queue and try again.");
  return data.images;
}

export function DrawingReviewMedia({ reviewId, load = loadDrawingPages }) {
  const [images, setImages] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const open = async () => {
    setLoading(true);
    setMessage("");
    try { setImages(await load(reviewId)); }
    catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  };
  return <div className="drawing-review-media">
    <button type="button" disabled={loading} onClick={open}>{images ? "Refresh private images" : "Open private images"}</button>
    {loading && <p role="status">Opening private images…</p>}
    {message && <p role="alert">{message}</p>}
    {images?.length === 0 && <p>No drawing pages found.</p>}
    {images?.length > 0 && <div className="drawing-review-grid">
      {images.map((image) => <figure key={image.id}>
        <img src={image.url} alt={`Anonymous drawing page ${image.ordinal}`} referrerPolicy="no-referrer"
          onError={() => setMessage("A page could not be displayed. Refresh the private images.")} />
        <figcaption>Page {image.ordinal}</figcaption>
      </figure>)}
    </div>}
  </div>;
}

export function DrawingReviewMediaPreview(){return <section className="wrap section"><h1>Review an <em>anonymous drawing.</em></h1><DrawingReviewMedia reviewId="preview" load={async()=>[{id:"one",ordinal:1,url:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f2eadf'/%3E%3Cpath d='M80 240 L250 70 L420 240 Z' fill='none' stroke='%23211d1b' stroke-width='8'/%3E%3C/svg%3E"}]}/></section>}
