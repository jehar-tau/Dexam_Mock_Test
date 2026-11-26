// Splits a released worked explanation back into its parts. The private plan
// builder writes: key idea, blank line, "1. step" lines, an optional
// "Options:" block ("A — correct: why"), then "Trap: ..." and "Faster: ...".
// Anything that does not follow that shape is shown as plain text instead.
const stepLine = /^(\d{1,2})\.\s+(.+)$/;
const optionLine = /^([A-Z0-9]{1,3})\s+[—–-]\s+(correct|wrong|incorrect|partly correct|partial)\s*:\s*(.+)$/i;

export function parseSolutionText(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const result = { keyIdea: "", steps: [], options: [], trap: "", faster: "" };
  let section = "key", current = null;
  const intro = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { current = null; if (section === "key" && intro.length) section = "body"; continue; }
    if (/^options:$/i.test(line)) { section = "options"; current = null; continue; }
    const trap = line.match(/^trap:\s*(.+)$/i), faster = line.match(/^faster:\s*(.+)$/i);
    if (trap) { result.trap = trap[1]; section = "tail"; current = "trap"; continue; }
    if (faster) { result.faster = faster[1]; section = "tail"; current = "faster"; continue; }
    if (section === "key") { intro.push(line); continue; }
    if (section === "options") {
      const match = line.match(optionLine);
      if (match) { result.options.push({ option: match[1], verdict: /^correct$/i.test(match[2]) ? "correct" : /^part/i.test(match[2]) ? "partial" : "wrong", why: match[3] }); continue; }
      if (result.options.length) { result.options.at(-1).why += " " + line; continue; }
      return null;
    }
    const step = line.match(stepLine);
    if (step && section !== "tail") { result.steps.push(step[2]); current = "step"; continue; }
    if (current === "step") { result.steps[result.steps.length - 1] += " " + line; continue; }
    if (current === "trap" || current === "faster") { result[current] += " " + line; continue; }
    return null;
  }
  result.keyIdea = intro.join(" ");
  if (!result.keyIdea || !result.steps.length) return null;
  return result;
}
