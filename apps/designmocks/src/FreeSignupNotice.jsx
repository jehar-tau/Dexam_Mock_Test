import React, {useEffect, useRef, useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {controlledPublicPortalMode, platform, publishedNotices} from './platform.js';
import {useAuthState} from './useAuth.js';
import {verifiedAccountRpc} from './account-identity.js';
import {clearDeviceAnswers} from './attempt-answer-journal.js';
import {freeSignupNoticeState} from './free-signup-notice.js';
import {acceptNotice, ageGroups, guardianConsent} from './age-consent.js';

function AccountNotice({session, children}) {
  const [decision, setDecision] = useState(null);
  const [checked, setChecked] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [retry, setRetry] = useState(0);
  const action = useRef(null);
  const submitting = useRef(false);
  const actor = session.user.id;
  const version = publishedNotices?.version;

  async function readNotice(signal) {
    const {data, error} = await verifiedAccountRpc(platform.auth, platform, actor, 'free_signup_notice', undefined, signal);
    if (error?.code === '42501' && error.message === 'Private staging requires an approved Google tester') return 'denied';
    if (error) throw error;
    return freeSignupNoticeState(data, version);
  }

  useEffect(() => {
    const controller = new AbortController();
    action.current = controller;
    setChecked(false);
    const finish = status => {
      if (!controller.signal.aborted) setDecision({session, retry, status});
    };
    readNotice(controller.signal).then(finish, () => finish('unavailable'));
    return () => {controller.abort();};
  }, [session, retry]);

  const status = decision?.session === session && decision.retry === retry ? decision.status : 'checking';
  if (status === 'ready') return children;

  async function accept(event) {
    event.preventDefault();
    const controller = action.current;
    if (!checked || (guardianConsent && !ageGroup) || status !== 'pending' || !controller || controller.signal.aborted || submitting.current) return;
    submitting.current = true;
    setDecision({session, retry, status:'saving'});
    try {
      const result = await acceptNotice((name, args) => verifiedAccountRpc(platform.auth, platform, actor, name, args, controller.signal), version, {guardianConsent, ageGroup});
      if (result.error) throw result.error;
      const next = await readNotice(controller.signal);
      if (!controller.signal.aborted) setDecision({session, retry, status:next === 'pending' ? 'unavailable' : next});
    } catch {
      if (!controller.signal.aborted) setDecision({session, retry, status:'unavailable'});
    } finally {
      submitting.current = false;
    }
  }

  async function signOut() {
    try {
      const active = await platform.auth.getSession();
      if (active.error || active.data.session?.user?.id !== actor) throw new Error();
      const {error} = await platform.auth.signOut({scope:'local'});
      if (error) throw error;
      clearDeviceAnswers(actor);
    } catch {
      if (!action.current?.signal.aborted) setDecision({session, retry, status:'unavailable'});
    }
  }

  if (status === 'checking') return <p className="wrap" role="status">Checking your account notices…</p>;
  return <section className="wrap signup-notice" aria-labelledby="signup-notice-title">
    <h1 id="signup-notice-title">{status === 'denied' ? 'Account access' : 'Before you start'}</h1>
    <p className="signed-in">Signed in as {session.user.email}</p>
    {status === 'pending' || status === 'saving' ? <form onSubmit={accept}>
      <p>Review the <Link to="/terms" target="_blank" rel="noreferrer">Terms of Use</Link> and <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Notice</Link> for your free student account. Both links open in a new tab.</p>
      {guardianConsent && <fieldset className="age-group">
        <legend>Your age</legend>
        {ageGroups.map(group => <label key={group.value} className="terms-checkbox"><input type="radio" name="age-group" value={group.value}
          checked={ageGroup === group.value} disabled={status === 'saving'} onChange={() => setAgeGroup(group.value)} /> {group.label}</label>)}
      </fieldset>}
      <label className="terms-checkbox"><input type="checkbox" checked={checked} disabled={status === 'saving'}
        onChange={e => setChecked(e.target.checked)} /> {guardianConsent ? '' : 'I am 18 or older. '}I accept the Terms of Use and acknowledge the Privacy Notice.</label>
      <button type="submit" className="button" disabled={!checked || (guardianConsent && !ageGroup) || status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Accept and continue'}</button>
    </form> : status === 'denied' ? <p role="status">Sign-up is not open for this account yet.</p> : <>
      <p role="alert">{status === 'mismatch' ? 'The published notices have changed. Reload to see the current version.' : 'We couldn’t confirm your notice acceptance. Check again to continue.'}</p>
      {status === 'mismatch' ? <button className="button" onClick={() => window.location.reload()}>Reload notices</button>
        : <button className="button" onClick={() => setRetry(n => n + 1)}>Check again</button>}
    </>}
    <button className="text-button" onClick={signOut} disabled={status === 'saving'}>Sign out</button>
  </section>;
}

function SignedInNotice({children}) {
  const {session, loading} = useAuthState();
  const {pathname} = useLocation();
  if (loading) return <p className="wrap" role="status">Checking your account…</p>;
  if (!session) return children;
  return <AccountNotice key={session.user.id + pathname} session={session}>{children}</AccountNotice>;
}

export function FreeSignupNotice({children}) {
  return controlledPublicPortalMode ? <SignedInNotice>{children}</SignedInNotice> : children;
}
