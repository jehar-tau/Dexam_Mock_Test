import React from "react";

export function AdminQueueNavigation({ page, label, subject, disabled, navigate }) {
  if (!page || (!page.position.previous.length && !page.nextCursor)) return null;
  const { cursor, previous } = page.position;
  return <nav className="admin-actions" aria-label={label}>
    {previous.length > 0 && <button type="button" className="button quiet" disabled={disabled}
      onClick={() => navigate({ cursor: previous.at(-1), previous: previous.slice(0, -1) })}>Previous {subject}</button>}
    <span>Page {previous.length + 1}</span>
    {page.nextCursor && <button type="button" className="button quiet" disabled={disabled}
      onClick={() => navigate({ cursor: page.nextCursor, previous: [...previous, cursor] })}>Next {subject}</button>}
  </nav>;
}
