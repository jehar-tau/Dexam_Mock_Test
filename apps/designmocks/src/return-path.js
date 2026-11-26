// Remembers where a student was when they chose to sign in, so the Google
// callback can return them there. Only Papers and workspace paths are allowed.
const key = "dmocks:return-after-sign-in";
const allowed = /^\/(?:papers(?:\/(?:uceed|ceed|nid|nift))?|dashboard(?:\/(?:practice|mocks|all-india|learn))?)(?:\?exam=(?:uceed|ceed|nid|nift))?$/;

export function safeReturnPath(path) {
  return typeof path === "string" && allowed.test(path) ? path : null;
}

export function rememberReturn(path) {
  const safe = safeReturnPath(path);
  if (!safe) return;
  try { window.sessionStorage.setItem(key, safe); } catch { /* storage unavailable */ }
}

export function takeReturn() {
  try {
    const path = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    return safeReturnPath(path);
  } catch { return null; }
}
