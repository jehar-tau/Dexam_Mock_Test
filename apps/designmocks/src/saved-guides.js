// Saved guides (the static editorial articles). They have no backend record to save
// against, so the list lives in this browser, per account. Student posts are saved on
// the server (community_saved).
const key = actor => `dmocks:saved-guides:${actor}`;
const store = () => { try { return window.localStorage; } catch { return null; } };
const listeners = new Set();

export function savedGuides(actor) {
  try {
    const value = JSON.parse(store()?.getItem(key(actor)) ?? "[]");
    return Array.isArray(value) ? value.filter(item => typeof item?.slug === "string" && typeof item?.savedAt === "string") : [];
  } catch { return []; }
}

export function setGuideSaved(actor, slug, saved) {
  const rest = savedGuides(actor).filter(item => item.slug !== slug);
  const next = saved ? [{ slug, savedAt: new Date().toISOString() }, ...rest].slice(0, 500) : rest;
  try { store()?.setItem(key(actor), JSON.stringify(next)); } catch { /* not saved on this device */ }
  listeners.forEach(listener => listener());
  return next;
}

export function onSavedGuidesChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
