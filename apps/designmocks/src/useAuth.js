import { useEffect, useState } from "react";
import { platform } from "./platform.js";
import { observeAuthSession } from "./auth-session.js";
export function useAuthState() {
  const [state, setState] = useState({session:null,loading:Boolean(platform),authError:""});
  useEffect(() => {
    if (!platform) return;
    return observeAuthSession(platform.auth,setState);
  }, []);
  return state;
}
