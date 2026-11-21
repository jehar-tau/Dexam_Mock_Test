// Spoken feedback for Learn: what to say, and which device voice says it.
// Pure, so it can be tested without a browser.

export const SPOKEN_FEEDBACK_KEY = "dmocks.learn.spoken-feedback";
export const SPEECH_MAX = 600;

// Turns the written explanation into words a speech engine reads naturally.
export function speechText(feedback) {
  let text = String(feedback ?? "")
    .replace(/(\d)\s*[×x]\s*(\d)/g, "$1 times $2")
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/√\s*(\d+)/g, "the square root of $1")
    .replace(/√/g, " square root of ")
    .replace(/(\d)\s*°/g, "$1 degrees")
    .replace(/°/g, " degrees")
    .replace(/→/g, " to ")
    .replace(/←/g, " from ")
    .replace(/π/g, " pi ")
    .replace(/²/g, " squared")
    .replace(/³/g, " cubed")
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    .replace(/(\d)\s*[−-]\s+(\d)|(\d)\s+[−-]\s*(\d)/g, (_, a, b, c, d) => `${a ?? c} minus ${b ?? d}`)
    .replace(/(\d)\s*\+\s*(\d)/g, "$1 plus $2")
    .replace(/(\d)\s*=\s*(\d)/g, "$1 equals $2")
    .replace(/\s=\s/g, " equals ")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 over $2")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/[*_#`]/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > SPEECH_MAX) {
    const cut = text.slice(0, SPEECH_MAX), stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
    text = stop > 200 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "") + ".";
  }
  return text;
}

// Prefers an Indian English voice, then British, then any English voice.
// Returns null when the device has no English voice.
export function chooseVoice(voices) {
  const list = Array.isArray(voices) ? voices.filter(voice => voice && typeof voice.lang === "string") : [];
  const lang = voice => voice.lang.toLowerCase().replace("_", "-");
  return list.find(voice => lang(voice) === "en-in") ?? list.find(voice => lang(voice) === "en-gb") ??
    list.find(voice => lang(voice).startsWith("en-") && voice.default) ?? list.find(voice => lang(voice).startsWith("en")) ?? null;
}

export function readSpokenPreference(storage) {
  try { return storage?.getItem(SPOKEN_FEEDBACK_KEY) === "on"; } catch { return false; }
}
export function writeSpokenPreference(storage, on) {
  try { storage?.setItem(SPOKEN_FEEDBACK_KEY, on ? "on" : "off"); } catch { /* The switch still works for this visit. */ }
}
