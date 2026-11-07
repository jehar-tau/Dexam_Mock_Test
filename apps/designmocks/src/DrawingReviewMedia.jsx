import React, { useCallback } from "react";
import { platform } from "./platform.js";
import { DrawingPages } from "./DrawingInspection.jsx";

async function loadDrawingPages(reviewId, signal) {
  const { data, error } = await platform.functions.invoke("drawing-review-media", { body: { reviewId }, signal });
  if (error) throw new Error("Couldn’t open drawing pages. Refresh the queue and try again.");
  return data;
}

export function DrawingReviewMedia({ reviewId, load = loadDrawingPages }) {
  const open = useCallback(signal => load(reviewId, signal), [reviewId, load]);
  return <DrawingPages scopeKey={reviewId} load={open} anonymous />;
}

export function DrawingReviewMediaPreview(){return <section className="wrap section"><h1>Review an <em>anonymous drawing.</em></h1><DrawingReviewMedia reviewId="preview" load={async()=>[{id:"one",ordinal:1,url:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f2eadf'/%3E%3Cpath d='M80 240 L250 70 L420 240 Z' fill='none' stroke='%23211d1b' stroke-width='8'/%3E%3C/svg%3E"}]}/></section>}
