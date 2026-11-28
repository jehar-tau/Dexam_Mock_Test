// Visible-tab time per account for the required profile step (ProfileGate.jsx).
export const profileGateAfterMs = 10 * 60 * 1000;
const key = actor => `dmocks:active-ms:${actor}`;

function read(store, actor) {
  try { const value = Number(store?.getItem(key(actor))); return Number.isFinite(value) && value > 0 ? value : 0; }
  catch { return 0; }
}

export function profileGateDue(store, actor) {
  return read(store, actor) >= profileGateAfterMs;
}

// Adds `ms` of use and says whether the step is now due. Without storage (private
// windows) time still counts for this page load through the in-memory fallback.
const memory = new Map();
export function recordActiveTime(store, actor, ms) {
  const total = Math.max(read(store, actor), memory.get(actor) ?? 0) + ms;
  memory.set(actor, total);
  try { store?.setItem(key(actor), String(total)); } catch { /* counted in memory */ }
  return total >= profileGateAfterMs;
}
