import { useEffect, useState } from "react";
import { platform } from "./platform.js";
import { passIsActive } from "./pass-rules.js";

export { duoClaimMessage, duoInviteLink, duoTokenPattern, passIsActive } from "./pass-rules.js";

// `unknown` until the read returns. A failed read counts as no pass, so the
// page shows the free view rather than a lock that the server would refuse.
export function usePassAccess(actorId, client = platform) {
  const [state, setState] = useState({ actorId: null, status: "unknown" });
  useEffect(() => {
    if (!actorId || !client) { setState({ actorId, status: actorId ? "free" : "unknown" }); return; }
    const controller = new AbortController();
    setState({ actorId, status: "unknown" });
    client.rpc("my_pass").abortSignal(controller.signal).then(({ data, error }) => {
      if (!controller.signal.aborted) setState({ actorId, status: !error && passIsActive(data) ? "active" : "free" });
    }, () => { if (!controller.signal.aborted) setState({ actorId, status: "free" }); });
    return () => controller.abort();
  }, [actorId, client]);
  return state.actorId === actorId ? state.status : "unknown";
}

