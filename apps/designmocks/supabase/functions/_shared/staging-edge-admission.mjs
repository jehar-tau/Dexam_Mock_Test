// Use the request's user-bound client. A service client would bypass the
// PostgREST admission hook and cannot identify the calling student.
export async function stagingEdgeDenied(setting, caller, signal) {
  if (setting === undefined || setting === "false") return false;
  if (setting !== "true") return true;
  try {
    const probe = caller.rpc("can_enter_staging_portal");
    const result = await (signal ? probe.abortSignal(signal) : probe);
    return Boolean(result.error) || result.data !== true;
  } catch {
    return true;
  }
}
