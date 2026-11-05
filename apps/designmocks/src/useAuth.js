import { useEffect, useState } from "react";
import { platform } from "./platform.js";
export function useAuthState() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(platform));
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!platform) return;
    let alive = true;
    platform.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data.session);
          if (error) setAuthError("Google sign-in could not be completed. Please try again.");
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setAuthError("Could not check your session. Please refresh to try again.");
          setLoading(false);
        }
      });
    const { data } = platform.auth.onAuthStateChange((_, next) => {
      if (alive) {
        setSession(next);
        if (next) setAuthError("");
        setLoading(false);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { session, loading, authError };
}
