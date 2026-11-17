# 11. Spoken feedback

The owner asked (16 November 2026) for audio when a student answers wrongly:
what went wrong and how to approach the question, with a switch to turn it
off. Built 17 November 2026; in the post-launch preview only.

## What it does

- After a wrong answer on a check or in practice, the written explanation
  that is already on screen is also read aloud. Right answers are not read.
- A "Spoken feedback" switch sits in the lesson player's header. It is off
  until the student turns it on, and the choice is remembered on that
  device (`dmocks.learn.spoken-feedback` in local storage).
- It stops when the student moves to the next screen, turns the switch off,
  leaves the lesson or hides the tab.
- The written feedback always stays on screen; audio is an addition.
- No new content was written. Every generated question already explains
  each wrong option; that text is what is spoken.

## How it speaks

The browser's built-in speech (`speechSynthesis`), in the device's own
voice: an Indian English voice where the device has one, then British, then
any English voice. Nothing is recorded, nothing is sent to a server, and
there is no new dependency or paid service (open decision 10: recorded or
generated audio would need a provider the owner chooses).

`src/learn/speech.mjs` turns notation into words before speaking: `×` as
"times", `÷` "divided by", `°` "degrees", `→` "to", `π` "pi", `²`
"squared", `³` "cubed", `√` "square root of", and `3–5`, `10 - 4`, `1/4`,
`25%` as "3 to 5", "10 minus 4", "1 over 4", "25 percent". Long
explanations stop at a sentence, at 600 characters.

If a device has no speech, the switch is not shown. If the speech engine
fails, the lesson carries on and the switch turns itself off for that visit.

## Files

| File | Purpose |
|---|---|
| `src/learn/speech.mjs` | Text preparation, voice choice, the remembered choice. Unit tested in `tests/learn-speech.test.mjs`. |
| `src/learn/LearnAudio.jsx` | Provider, switch and the hook the feedback uses. |
| `src/learn/LessonPlayer.jsx` | Provider in the player frame, switch in its header, speaking in `Feedback`. |
| `src/launch-scope.mjs` | `allowLearnSpokenFeedback`: on only with the post-launch preview. |
| `tests/e2e/learn-spoken-feedback.spec.js` | Desktop and Pixel 7 journeys with a stand-in voice, a failing engine, no speech, and the released build. |

## Releasing it

Learn is released; spoken feedback is not. To release it, change
`allowLearnSpokenFeedback` to return true (or tie it to `releasedModules`)
and run the checks. Before that:

- [ ] Try it on the low-cost Android phones students actually use; voices
      differ a lot between devices.
- [ ] Decide whether screen-reader users should be warned: the feedback is
      also announced by their reader, so with the switch on they hear it
      twice. The switch is off by default for that reason.
- [ ] Owner decision 10: stay with device voices, or choose a speech
      provider (cost and data processing to approve).
