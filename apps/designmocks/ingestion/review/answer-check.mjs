// Compares a learner's answer with an official key in the bank's notation
// ("A", "A,B,D", "B,C or B,C,D", "16.8", "470 to 480", "22 or 23").
// Shared by the local review page (in the browser) and its unit tests.

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function branches(raw) {
  return String(raw ?? "").split(/\s+or\s+/i).map(part => part.trim()).filter(Boolean);
}

function letters(value) {
  return [...new Set(String(value).toUpperCase().replace(/[^A-D]/g, "").split("").filter(Boolean))].sort().join(",");
}

export function parseKey(raw, type) {
  if (raw == null || raw === "") return null;
  if (type === "NAT") {
    const accepted = branches(raw).map(branch => {
      const range = branch.match(/^(\S+)\s+to\s+(\S+)$/i);
      if (range && NUMBER.test(range[1]) && NUMBER.test(range[2])) return { low: Number(range[1]), high: Number(range[2]) };
      if (NUMBER.test(branch)) return { low: Number(branch), high: Number(branch) };
      return null;
    });
    return accepted.every(Boolean) ? { type, accepted } : null;
  }
  if (type === "MCQ" || type === "MSQ") {
    const accepted = branches(raw).map(letters);
    return accepted.every(Boolean) ? { type, accepted } : null;
  }
  return null;
}

// answer: a number string for NAT, an array of letters for MCQ/MSQ.
export function checkAnswer(raw, type, answer) {
  const key = parseKey(raw, type);
  if (!key) return { result: "no-key" };
  if (type === "NAT") {
    const text = String(answer ?? "").trim();
    if (!NUMBER.test(text)) return { result: "not-a-number" };
    const value = Number(text);
    return { result: key.accepted.some(({ low, high }) => value >= low && value <= high) ? "correct" : "wrong" };
  }
  const chosen = letters((answer || []).join(""));
  if (!chosen) return { result: "unanswered" };
  if (key.accepted.includes(chosen)) return { result: "correct" };
  if (type === "MSQ") {
    // UCEED/CEED partial credit: only correct options chosen, but not all of them.
    const picked = chosen.split(",");
    const partial = key.accepted.some(set => picked.every(letter => set.split(",").includes(letter)));
    if (partial) return { result: "partial" };
  }
  return { result: "wrong" };
}

export function describeKey(raw, type) {
  const key = parseKey(raw, type);
  if (!key) return null;
  if (type === "NAT") return key.accepted.map(({ low, high }) => (low === high ? `${low}` : `${low} to ${high}`)).join(" or ");
  return key.accepted.join(" or ");
}
