export function isAdminAccessFailure(error) {
  const status = error?.context?.status ?? error?.status;
  return error?.code === "42501" || status === 401 || status === 403 ||
    error?.code === "P0001" && error?.message === "Admin access required";
}

export function adminRequestMessage(error) {
  if (error?.code === "23505") return "This item already exists. Refresh before trying again.";
  if (error?.code === "22023") return "Check the entered details and try again.";
  if (isAdminAccessFailure(error)) return "This item is unavailable or this action is not permitted. Refresh before trying again.";
  return "Couldn’t complete this administrator request. Refresh and try again.";
}

const ended = () => Object.assign(new Error("This administrator request is no longer current."), { name: "AbortError", code: "admin_access_ended" });

// A scope never reopens. An explicit retry creates a new scope, so an older
// successful read cannot revive private views after a denial or account change.
export function createAdminAccessScope({ check, isCurrent = () => true, onChange = () => {}, verificationTimeoutMs = 10000 }) {
  const controller = new AbortController();
  let disposed = false, status = "checking", hadAccess = false, verification = null;
  const current = () => !disposed && !controller.signal.aborted && isCurrent();
  const snapshot = () => ({ status, hadAccess });
  function assertCurrent() {
    if (!current() || status !== "allowed") throw ended();
  }
  function close(next) {
    if (!current()) return;
    status = next;
    controller.abort();
    onChange(snapshot());
  }
  function verify() {
    if (!current()) return Promise.resolve(false);
    if (verification) return verification;
    const timeout = new AbortController(), signal = AbortSignal.any([controller.signal, timeout.signal]);
    const timer = setTimeout(() => timeout.abort(), verificationTimeoutMs);
    let abort;
    const interrupted = new Promise((_, reject) => {
      abort = () => reject(ended());
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    const task = (async () => {
      try {
        const allowed = await Promise.race([Promise.resolve().then(() => check(signal)), interrupted]);
        if (!current()) return false;
        if (allowed !== true) { close(allowed === false ? "denied" : "unavailable"); return false; }
        status = "allowed"; hadAccess = true; onChange(snapshot());
        return true;
      } catch {
        if (current()) close("unavailable");
        return false;
      } finally {
        clearTimeout(timer); signal.removeEventListener("abort", abort);
      }
    })();
    verification = task;
    void task.finally(() => { if (verification === task) verification = null; });
    return task;
  }
  async function run(operation, requestSignal) {
    assertCurrent();
    const signal = requestSignal ? AbortSignal.any([controller.signal, requestSignal]) : controller.signal;
    signal.throwIfAborted();
    try {
      const value = await operation(signal);
      assertCurrent(); signal.throwIfAborted();
      return value;
    } catch (error) {
      if (!current()) throw ended();
      signal.throwIfAborted();
      // A missing or unavailable target can use the same permission status as
      // role loss. Only a fresh role check may close the whole administrator desk.
      if (isAdminAccessFailure(error)) await verify();
      assertCurrent();
      throw error;
    }
  }
  function dispose() { disposed = true; controller.abort(); }
  return Object.freeze({ verify, run, assertCurrent, dispose, invalidate: () => close("unavailable"), isCurrent: () => current() && status === "allowed", signal: controller.signal, snapshot });
}
