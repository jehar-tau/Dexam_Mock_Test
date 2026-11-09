import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {useAccountServices} from './AccountAccess.jsx';
import {candidateProfileResponse} from './profileModel.mjs';

const resendDelay = 60_000;
const unavailable = 'Phone verification is temporarily unavailable. Please try again later.';
const uncertainSend = 'We couldn’t confirm that the text was sent. If you receive a code, enter it here.';
const uncertainVerify = 'We couldn’t confirm verification. Reload your profile to check your saved phone status.';

function retryDelay(retryAt) {
  const remaining = Date.parse(retryAt) - Date.now();
  // The server enforces the actual limit. Keep the UI usable with a skewed clock.
  return remaining > 0 ? Math.min(remaining, 86_400_000) : resendDelay;
}

export function CandidatePhoneVerification({phone, onVerified}) {
  const {functions, rpc, isCurrent, presentForCurrentAccount} = useAccountServices();
  const [challengeId, setChallengeId] = useState(null);
  const [code, setCode] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(false);
  const section = useRef(null);
  const codeInput = useRef(null);
  const status = useRef(null);
  const action = useRef(null);
  const id = useId();

  useLayoutEffect(() => () => action.current?.abort(), []);
  const hasFocus = () => document.activeElement === document.body || section.current?.contains(document.activeElement);
  useLayoutEffect(() => {
    if (challengeId && hasFocus()) codeInput.current?.focus();
  }, [challengeId]);
  useEffect(() => {
    if (!retryAfter) return;
    const timer = setTimeout(() => setRetryAfter(0), Math.max(0, retryAfter - performance.now()));
    return () => clearTimeout(timer);
  }, [retryAfter]);

  async function run(body, handle, onFailure) {
    if (action.current || !isCurrent()) return;
    const controller = new AbortController();
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 20_000);
    const signal = AbortSignal.any([controller.signal, timeout.signal]);
    const current = () => action.current === controller && !controller.signal.aborted && isCurrent();
    action.current = controller;
    setBusy(true);
    setMessage('');
    setInvalid(false);
    try {
      const {data, error} = await functions.invoke('candidate-phone', {body, signal});
      if (!current()) return;
      if (error) throw error;
      signal.throwIfAborted();
      await handle(data, signal, current);
    } catch (error) {
      if (current()) onFailure(error);
    } finally {
      clearTimeout(timer);
      if (current()) setBusy(false);
      if (action.current === controller) action.current = null;
    }
  }

  function send() {
    if (retryAfter || action.current || !isCurrent()) return;
    if (!globalThis.crypto?.randomUUID) {
      setMessage(unavailable);
      return;
    }
    const nextChallenge = globalThis.crypto.randomUUID();
    const allowEntry = message => {
      setChallengeId(nextChallenge);
      setCode('');
      setMessage(message);
    };
    void run({action: 'send', phone, challengeId: nextChallenge}, data => {
      switch (data?.status) {
        case 'sent':
        case 'unconfirmed':
          setRetryAfter(performance.now() + retryDelay(data.retryAt));
          allowEntry(data.status === 'sent' ? 'We sent a six-digit code to your saved phone number.' : uncertainSend);
          break;
        case 'cooldown':
        case 'limit':
          setRetryAfter(performance.now() + retryDelay(data.retryAt));
          setMessage(data.status === 'cooldown' ? 'Wait before requesting another code.' : 'Too many code requests. Please try again later.');
          break;
        case 'unavailable':
          setMessage(unavailable);
          break;
        default:
          throw new Error('Unexpected phone response.');
      }
    }, error => {
      if (error?.context instanceof Response) {
        setMessage(unavailable);
        return;
      }
      setRetryAfter(performance.now() + resendDelay);
      allowEntry(uncertainSend);
    });
  }

  function closeChallenge(message) {
    setChallengeId(null);
    setCode('');
    setMessage(message);
    if (hasFocus()) status.current?.focus();
  }

  function verify() {
    if (!challengeId || action.current || !isCurrent()) return;
    if (!/^[0-9]{6}$/.test(code)) {
      setMessage('Enter the six-digit code.');
      setInvalid(true);
      codeInput.current?.focus();
      return;
    }
    void run({action: 'verify', phone, challengeId, code}, async (data, signal, current) => {
      switch (data?.status) {
        case 'verified': {
          const saved = candidateProfileResponse(await rpc('my_candidate_profile', {}, signal));
          await presentForCurrentAccount(() => {
            if (!current()) return;
            if (saved.values.phone === phone && saved.phoneVerified) {
              onVerified(hasFocus());
            } else {
              closeChallenge(uncertainVerify);
            }
          }, signal);
          break;
        }
        case 'invalid':
          setInvalid(true);
          setMessage('The code didn’t match. Check the text and try again.');
          if (hasFocus()) codeInput.current?.focus();
          break;
        case 'expired':
          closeChallenge('This code is no longer valid. Request another code when available.');
          break;
        case 'unavailable':
          setMessage(unavailable);
          break;
        default:
          throw new Error('Unexpected phone response.');
      }
    }, () => setMessage(uncertainVerify));
  }

  return <div className="profile-field" ref={section}>
    <div>
      <button type="button" className="button quiet" onClick={send} aria-disabled={busy || undefined} disabled={Boolean(retryAfter)}>
        {challengeId ? 'Send another code' : 'Send verification code'}
      </button>
    </div>
    {challengeId && <>
      <label htmlFor={id}>Six-digit SMS code</label>
      <input ref={codeInput} id={id} value={code} readOnly={busy} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        aria-invalid={invalid} aria-describedby={id + '-status'}
        onChange={event => {
          setCode(event.target.value);
          if (invalid) {
            setInvalid(false);
            setMessage('');
          }
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            verify();
          }
        }}/>
      <div><button type="button" className="button quiet" onClick={verify} aria-disabled={busy || undefined}>Verify phone number</button></div>
    </>}
    <small ref={status} id={id + '-status'} role="status" tabIndex={-1}>{busy ? 'Checking phone verification…' : message}</small>
  </div>;
}
