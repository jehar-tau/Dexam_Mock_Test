import React, { useEffect, useState } from "react";
import { onSavedGuidesChange, savedGuides, setGuideSaved } from "./saved-guides.js";

// One tap to save a guide; it then appears under Community → Saved.
export function SaveGuideButton({ actor, slug, title }) {
  const read = () => savedGuides(actor).some(item => item.slug === slug);
  const [saved, setSaved] = useState(read);
  useEffect(() => onSavedGuidesChange(() => setSaved(read())), [actor, slug]);
  return <button type="button" className={`button quiet save-button${saved ? " is-saved" : ""}`} aria-pressed={saved}
    aria-label={`${saved ? "Saved" : "Save"}: ${title}`} onClick={() => { setGuideSaved(actor, slug, !saved); setSaved(!saved); }}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
    {saved ? "Saved" : "Save"}
  </button>;
}
