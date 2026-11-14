// Phase 0 progress store: local to this browser and account. Phase 2 replaces
// this with the verified-actor RPCs described in docs/LEARN_INTERACTIVE_PLAN.md.
import { emptyProgress, readProgress } from './programme-model.js';

const storageKey = (slug, actorId) => `dmocks:learn:${slug}:${actorId}`;

export function loadProgress(slug, actorId) {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(slug, actorId));
    return raw ? readProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(slug, actorId, progress) {
  try {
    globalThis.localStorage?.setItem(storageKey(slug, actorId), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(slug, actorId) {
  try { globalThis.localStorage?.removeItem(storageKey(slug, actorId)); } catch { /* ignore */ }
}
