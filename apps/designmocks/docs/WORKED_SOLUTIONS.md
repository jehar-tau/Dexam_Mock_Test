# Worked solutions on the website (26 November 2026)

The owner keeps editing papers and solutions. Everything below is regenerated
from the private ingestion files by script; nothing is hand-copied.

## What students see

After a paper is submitted, "View solution" in the answer review shows:

- **Key idea** (dark card), then numbered **steps**.
- **Option by option**: each option with Correct / Incorrect and why.
- **Common trap** and **Faster method** call-outs.
- When a reviewed worked solution exists, the steps play over the **question's
  diagram**: Play / Pause / Replay, Previous / Next step, a progress bar, and
  clickable step text. Lines and outlines draw on; other marks fade in.
  Reduced-motion users get the same steps without movement.

The text parts come from the released explanation, which the private plan
builder writes as: key idea, blank line, `1.` steps, `Options:` lines
(`A — correct: why`), `Trap:`, `Faster:`. On 26 Nov all 1,705 explanations in
the 29 portal plans parsed (828 with options, 971 with a trap). Anything else
falls back to plain text (`src/solution-text.mjs`).

## The animated overlays

Private source: `<paper>/05-solutions/qN.json` with an `overlay` drawn on
`<paper>/03-figures/qN/fig-K.png` (the diagram-only crop). On 26 Nov there
were 38: UCEED 2026 (30), UCEED 2025 (7), CEED 2025 (1). There are also 47
draft `qN.visual.json` variants for UCEED 2026, not yet reviewed.

Convert (read-only on private files; writes one private JSON):

    node scripts/ingestion-worked-solutions.mjs --work ~/dmocks-ingestion-work --paper uceed-2026 --out <private file>

It ties each solution to the exact figure by SHA-256 and size, drops `id`
attributes, scales the drawing if its box differs from the figure, and
reports anything it can't convert. On 26 Nov 37 of 38 converted; UCEED 2026
Q42 has 119 shapes, over the viewer's limit of 96. The largest converted
solution is about 1.5 KB, so a packed explanation stays under the current
10,000-character release limit.

## Still needed before real papers show animations

1. **Figure decision (owner).** The website shows each question's
   whole-question block image, which repeats the typed question text. The
   overlays were drawn on the diagram-only crops. Either switch those
   questions to the diagram-only crop (a bank asset change, checked question
   by question so no option drawing is lost), or attach the crop only as a
   hidden `solution` figure (the runtime already supports `role: "solution"`).
2. **Plan builder.** For converted questions, write the plan explanation with
   `encodeWorkedExplanation(text, solution)` (`src/worked-solution.js`), so the
   release carries the steps. This changes those papers' planSha256.
3. **Media and re-release (Codex).** Upload the crops to the private
   `paper-media` storage, verify SHA-256 and size, materialise the runtime,
   then re-release the changed papers with their new digests.
