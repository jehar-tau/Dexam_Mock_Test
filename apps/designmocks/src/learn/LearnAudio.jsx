import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { chooseVoice, readSpokenPreference, speechText, writeSpokenPreference } from './speech.mjs';

// Spoken feedback: after a wrong answer the written explanation is also read
// aloud, in the device's own voice. Off until the student turns it on; the
// choice is remembered on this device. Nothing is recorded or sent anywhere.
const LearnAudio = createContext({ available: false, on: false });

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function') ? window.speechSynthesis : null;
const storage = () => { try { return window.localStorage; } catch { return null; } };

export function LearnAudioProvider({ enabled, children }) {
  const engine = enabled ? synth() : null;
  const [on, setOn] = useState(() => Boolean(engine) && readSpokenPreference(storage()));
  const voice = useRef(null);
  useEffect(() => {
    if (!engine) return undefined;
    const pick = () => { try { voice.current = chooseVoice(engine.getVoices()); } catch { voice.current = null; } };
    pick();
    engine.addEventListener?.('voiceschanged', pick);
    const hidden = () => { if (document.visibilityState === 'hidden') { try { engine.cancel(); } catch { /* Nothing is playing. */ } } };
    document.addEventListener('visibilitychange', hidden);
    return () => { engine.removeEventListener?.('voiceschanged', pick); document.removeEventListener('visibilitychange', hidden); try { engine.cancel(); } catch { /* Nothing is playing. */ } };
  }, [engine]);
  // A speech engine that misbehaves must never break a lesson: failures are
  // caught, and spoken feedback switches itself off for this visit.
  const [failed, setFailed] = useState(false);
  const stop = useCallback(() => { try { engine?.cancel(); } catch { /* Nothing is playing. */ } }, [engine]);
  const speak = useCallback(text => {
    if (!engine || !on || failed) return;
    const words = speechText(text);
    if (!words) return;
    try {
      engine.cancel();
      const utterance = new window.SpeechSynthesisUtterance(words);
      utterance.lang = voice.current?.lang ?? 'en-IN';
      if (voice.current) utterance.voice = voice.current;
      utterance.rate = 0.95;
      engine.speak(utterance);
    } catch { setFailed(true); }
  }, [engine, on, failed]);
  const toggle = useCallback(() => setOn(value => {
    const next = !value; writeSpokenPreference(storage(), next); return next;
  }), []);
  useEffect(() => { if (!on) stop(); }, [on, stop]);
  const value = useMemo(() => ({ available: Boolean(engine) && !failed, on: on && !failed, toggle, speak, stop }), [engine, failed, on, toggle, speak, stop]);
  return <LearnAudio.Provider value={value}>{children}</LearnAudio.Provider>;
}

export function SpokenFeedbackSwitch() {
  const { available, on, toggle } = useContext(LearnAudio);
  if (!available) return null;
  return <button type="button" className="player-audio" aria-pressed={on} onClick={toggle} title={on ? 'Turn spoken feedback off' : 'Turn spoken feedback on'}>
    <span aria-hidden="true">{on ? '🔊' : '🔈'}</span> Spoken feedback</button>;
}

// Reads a wrong answer's explanation aloud once, and stops when the screen changes.
export function useSpokenFeedback(result) {
  const { on, speak, stop } = useContext(LearnAudio);
  useEffect(() => {
    if (!result || result.correct || !on) return undefined;
    speak(result.feedback);
    return () => stop();
  }, [result, on, speak, stop]);
}
