import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { platform, stagingPortalMode } from "./platform.js";
import { useAuthState } from "./useAuth.js";
import { verifiedRoleCheck } from "./account-identity.js";

export function useStagingPortalAccess(session, path = "account") {
  const [decision, setDecision] = useState(null);
  useEffect(() => {
    if (!stagingPortalMode || !session) return;
    const controller = new AbortController();
    const finish = (status) => {
      if (!controller.signal.aborted) setDecision({ session, path, status });
    };
    verifiedRoleCheck(platform.auth, platform, session.user?.id, "can_enter_staging_portal", controller.signal).then(({ data, error }) => {
      const blocked = error?.code === "42501" && error.message === "Private staging requires an approved Google tester";
      finish(blocked ? "denied" : error ? "unavailable" : data === true ? "allowed" : "denied");
    }, () => finish("unavailable"));
    return () => controller.abort();
  }, [session, path]);

  if (!stagingPortalMode) return "allowed";
  if (!session) return "signed-out";
  return decision?.session === session && decision.path === path ? decision.status : "checking";
}

export function StagingAccessMessage({ access }) {
  if (access === "checking") return <p role="status">Checking staging access…</p>;
  if (access === "denied") return <p className="notice" role="status">Staging access is closed for this account.</p>;
  if (access === "unavailable") return <p className="notice" role="alert">Couldn’t verify staging access. Refresh your session and try again.</p>;
  return null;
}

export function StagingPortalGate() {
  const { session, loading } = useAuthState();
  const { pathname } = useLocation();
  const access = useStagingPortalAccess(session, pathname);
  if (!loading && access === "allowed") return <Outlet />;
  return <section className="wrap page-intro">
    <span className="eyebrow">PRIVATE STAGING</span>
    <h1>Staging <em>workspace.</em></h1>
    {loading || access === "checking" ? <StagingAccessMessage access="checking" /> : <>
      {access === "signed-out" ? <p>Sign in with an approved Google test account.</p> : <StagingAccessMessage access={access} />}
      <Link className="button" to="/account">Go to account</Link>
    </>}
  </section>;
}
