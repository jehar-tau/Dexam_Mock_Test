import React, { useCallback } from "react";
import { useAdminFunctions } from "./AdminAccess.jsx";
import { DrawingPages } from "./DrawingInspection.jsx";
import { isAdminAccessFailure } from "./admin-access.js";

async function loadDrawingPages(functions, reviewId, signal, onUnavailable) {
  const { data, error } = await functions.invoke("drawing-review-media", { body: { reviewId }, signal });
  if (error) {
    if(isAdminAccessFailure(error))onUnavailable?.(reviewId,error);
    throw new Error("Couldn’t open drawing pages. Refresh the queue and try again.");
  }
  return data;
}

export function DrawingReviewMedia({ reviewId, load, onUnavailable }) {
  const functions = useAdminFunctions();
  const open = useCallback(signal => load ? load(reviewId, signal) : loadDrawingPages(functions, reviewId, signal, onUnavailable), [reviewId, load, functions, onUnavailable]);
  return <DrawingPages scopeKey={reviewId} load={open} anonymous />;
}

export function DrawingReviewMediaPreview(){return <section className="wrap section"><h1>Review an <em>anonymous drawing.</em></h1><DrawingReviewMedia reviewId="preview" load={async()=>[{id:"one",ordinal:1,url:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f2eadf'/%3E%3Cpath d='M80 240 L250 70 L420 240 Z' fill='none' stroke='%23211d1b' stroke-width='8'/%3E%3C/svg%3E"}]}/></section>}
