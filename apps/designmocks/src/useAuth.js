import { useEffect, useState } from "react";
import { platform } from "./platform.js";
export function useAuthState() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(platform));
  useEffect(() => {
    if (!platform) return;
    let alive = true;
    platform.auth
      .getSession()
      .then(({ data }) => {
        if (alive) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const { data } = platform.auth.onAuthStateChange((_, next) => {
      if (alive) {
        setSession(next);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { session, loading };
}
