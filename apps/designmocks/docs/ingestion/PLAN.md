# Question-paper ingestion pipeline (UCEED and CEED)

Status: plan written 20 November 2026; stages 1–3 built (stage 3 on 21 November). This file stays the reference until the last stage ships. Update it in the same change as the code.

## What the owner asked for

1. Put in a question paper (PDF, or photos of one) and get every question out as text.
2. Figures: either a crop, or a recreation that is pixel-faithful and scalable (SVG), "in a format that you are easily able to use or convert or enlarge or diminish". Decide per figure.
3. Match answers against the official answer key the owner has for most UCEED and CEED papers.
4. A worked solution for every question, in the spirit of Roughworks, and a paper analysis with the useful charts only.

## What already exists (read before building anything)

| Piece | Where | What it does | Gap |
| --- | --- | --- | --- |
| Paper ingester | `tools/ingest_official_pdf.py` (repo root, 1,366 lines) | PyMuPDF text + page renders, Apple Vision OCR for image-only pages, question markers, options, section/type maps, answer-key PDF parsing, optional local Ollama draft | Writes straight into a local SQLite; one monolith; no tests; figures are not separated from the question |
| Block cropper | `tools/crop_question_blocks.py` | Crops each question as one exact block from page renders, across page breaks | Whole question is one PNG; figure and options are not separate assets |
| OCR helper | `tools/ocr_vision.swift` | Apple Vision OCR with line boxes, local and free | macOS only |
| Vector pilot | `tools/build_visual_reconstruction_pilot.py` | Two NID figures traced to SVG with SSIM/diff comparison boards | Pilot only; NID scans |
| Answer engine | `tools/answer_engine.py`, `solver_*.py` | Queue of keyless questions solved twice and agreed | Answers only, no worked solution |
| Canonical bank | `server/data/exports/dexam-bank-export.json` | 1,714 UCEED/CEED records (UCEED 2015–2026, CEED 2010–2026). 1,701 shown as one `block` PNG; 1,444 official keys, 141 independently solved; **no explanations** | No solutions, no separate figures, no analysis |
| Bank addition path | `apps/designmocks/scripts/prepare-question-bank-addition.mjs` + `src/question-export-packet.mjs` | Verifies reviewed export packets and stages an addition outside the repo | Accepts PNG assets only |
| In-app intake | `supabase/functions/question-intake*`, `src/IntakeExtractionQueue.jsx` | Admin uploads an image; an OpenAI model extracts candidates for review | Closed by default (no approved model, cost or data processing) |
| Attempt insights | `src/attempt-insights.mjs` | Topic and section accuracy after a released attempt | No paper-level analysis, no time or difficulty view |

Conclusion: the past UCEED/CEED papers are already ingested once, as whole-question crops. The new pipeline earns its keep in four places: (a) papers that are not in the bank yet (2027 onward, photos, other sources); (b) re-ingesting existing papers to split figures from text and options; (c) worked solutions, which no record has; (d) analysis. It reuses the root tools' proven heuristics but is rebuilt as small tested stages with a file-based work folder, so each stage can be rerun and reviewed on its own.

## Findings that shape the design

Measured on the owner's official PDFs (UCEED 2015–2026, CEED 2021–2026), 20 November 2026:

- Every paper is a digital PDF with a real text layer (Word or cairo export). OCR is only needed for photos, scans and the few pages typeset as images (CEED 2025 and UCEED 2025 embed parts of pages as hundreds of image tiles).
- Figures are **embedded raster images**, almost all JPEG, at 100–220 effective dpi (for example UCEED 2026 page 5: 800×400 px placed at 451×226 pt, about 128 dpi). PDF vector drawings appear only in the instruction tables on page 2.
- So the "original" figure is itself a raster. Extracting the embedded image's own bytes is the most faithful copy possible; rendering the page at 300 dpi only resamples it. A vector version is always a *recreation*, never an extraction.
- Roughworks (studied 20 November 2026, public paper pages) shows question figures as PNG crops and draws a **separate SVG for the solution**, with coloured markers, a legend and a step scrubber ("Step 1 of 4", play button) tied to a numbered step list. Their dashboard analysis needs a sign-in that did not carry into the app's browser pane; see open decision D6.

## Stages

Each stage reads the previous stage's files from a private work folder **outside the repository** and writes its own. Nothing real is committed: tests use generated fictional papers.

```
<work>/<paper-id>/
  01-intake/     paper.json, pages/page-NNN.png, images/<sha>.<ext>, source/<original files>
  02-segments/   questions.json (boxes, text, options, figure regions per question)
  03-figures/    <question>/<figure>.png, .svg (if verified), verify.json, board.png
  04-key/        key.json (official answers matched to questions, mismatches)
  05-solutions/  <question>.json (draft worked solutions, status)
  06-review/     review.json (human decisions per question, exact hashes)
  07-export/     export packets for prepare-question-bank-addition
```

| # | Stage | Input → output | Status |
| --- | --- | --- | --- |
| 1 | **Intake** | PDF or page photos → hashed source copy, page renders, per-page text with word boxes, embedded-image inventory with native bytes and placement, vector-drawing inventory, a `needsOcr` flag per page | [x] built 20 Nov 2026 |
| 2 | **Segmentation** | Page text and boxes → one record per question: number, section, type, prompt text, options, figure placements, page regions, flags. OCR (Apple Vision helper) merged in where the text layer is broken | [x] built 20 Nov 2026 |
| 3 | **Figures** | Figure placements → canonical PNG (embedded pixels, or a page render when the page shows something else), a block crop of every question, an SVG trial with metrics and a comparison board | [x] built 21 Nov 2026 |
| 4 | Answer key | Key PDF → per-question official answer; match by number and section; report missing, extra and malformed keys; compare with the existing canonical record if one exists | [ ] |
| 5 | Solutions | Question + verified key → draft worked solution (format below); a draft that does not reach the official answer is held | [ ] |
| 6 | Review | Side-by-side review page: source block, extracted text, figures, key, solution; approve/fix per question with exact hashes | [ ] |
| 7 | Export | Approved questions → export packets for the existing `bank:prepare-addition` path (new papers) or correction packets (existing records) | [ ] |
| 8 | Analysis | Bank + attempts → paper analysis and attempt analysis views in the app | [ ] |

Stage 1 is deterministic and needs no model. Stages 2–4 are deterministic with optional local OCR. Stage 5 is the only stage that needs a language model (decision D3).

## Figure decision

Each figure gets exactly one **canonical asset**, the thing students see, chosen by this order:

1. **Native PDF vector** (drawing paths inside the figure region, no raster): export the paths as SVG directly. Lossless. Rare in these papers.
2. **Embedded raster** (the normal case): take the image's own bytes from the PDF, decode once and store as PNG (the bank requires PNG). No resampling. Keep the original JPEG bytes and its hash as evidence.
3. **Scan or photo**: crop from a 300–400 dpi render, deskew, clean the background; same as today's block cropper.

A **vector recreation** (SVG) is added on top, never instead, when the figure is line art or flat colour (cube nets, isometric drawings, patterns, grids, mechanisms, charts) and it passes all of these against the canonical PNG at the source's own pixel size:

| Check | Pass |
| --- | --- |
| Ink overlap (IoU of non-background pixels, both images classified with the same palette) | ≥ 0.98 |
| Edge distance (99th percentile of distances between Canny edges, both directions; the maximum is recorded too) | ≤ 1.5 source pixels |
| Structural similarity (SSIM, greyscale) | ≥ 0.95 |
| Flat-fill colour difference (ΔE 2000, region interiors only) | ≤ 3 |
| Human look at the comparison board (source, SVG, difference) | approved |

As built (21 Nov 2026): the maximum edge distance was replaced by the 99th percentile because JPEG noise puts single stray pixels several pixels away in every figure. The rule that text inside a figure must be real `<text>` was dropped. OCR misses single letters such as option labels and cannot read Devanagari, so it could not enforce the rule; traced letters also pass the pixel checks. Text that OCR does find is recorded, and the SVG is marked `textAsOutlines` for the reviewer.

The SVG must be sanitised: no scripts, no external references, no embedded raster. Photos, shaded renders, textures, hand sketches and anything that fails a check stay as the crop only. Where the answer depends on a fine detail (as in a question about slightly different corner radii) the crop stays primary even if the SVG passes, because a trace can smooth exactly the detail being tested.

Recreation method, cheapest first: potrace (locally installed, operator machine only) on a smooth 4× upscale, one layer per flat colour. A colour counts when it covers at least 1% of the pixels; anti-aliased edge pixels join their nearest colour. Next, a parametric SVG authored by a model or by hand for geometric figures (cube nets, grids), held to the same checks (not built yet). Never a generative image model.

**Solution drawings do not need the figure vectorised.** A solution's annotations (markers, highlights, arrows, labels, step reveals) are an SVG overlay in the canonical image's pixel coordinates, drawn on top of the PNG or SVG. This gives Roughworks-style annotated solutions for every question, including those whose figure must stay a crop.

## Solution format

Own wording, modelled on the structure Roughworks uses (studied, not copied):

```json
{
  "schema": 1,
  "answer": { "value": "B", "source": "official-key" },
  "keyIdea": "One or two sentences: what to notice first.",
  "steps": [
    { "text": "A short instruction or observation.", "overlay": "step-1" }
  ],
  "optionCheck": [ { "option": "A", "verdict": "wrong", "why": "Short reason." } ],
  "trap": "The common mistake, if there is one.",
  "fastTrack": "A quicker route under exam time, if there is one.",
  "overlay": { "viewBox": "0 0 800 400", "steps": { "step-1": "<g>…</g>" } },
  "meta": { "topic": "", "subtopic": "", "difficulty": "easy|medium|hard", "seconds": 60, "technique": "" },
  "provenance": { "draftedBy": "", "reviewedBy": "", "status": "draft|verified|held", "reachesKey": true }
}
```

Rules: the worked answer must equal the official key, or the solution is `held` and the key is re-checked (both can be wrong; the key is not overruled silently). Steps stay under about 30 words each. MCQ and MSQ solutions check every option. NAT solutions show the arithmetic. Visual questions get an overlay. The bank's existing `explanation` field carries this object once the runtime renders it (stage 8 work in the app).

## Analysis

Two views. Recommended set below; the owner ticks the final list (decision D5).

Paper analysis (from the bank, no student data):

| Chart | Recommendation |
| --- | --- |
| Marks by section and response type (NAT/MSQ/MCQ) | keep |
| Topic share of marks, this paper | keep |
| Topic trend across years (heat map, UCEED 2015–2026) | keep — shows what is rising |
| Difficulty mix by section | keep |
| Suggested time per question versus marks (where to spend the clock) | keep |
| Correct-option letter frequency | drop — trivia, invites guessing |

Attempt analysis (after a released mock; extends `attempt-insights.mjs`):

| Chart | Recommendation |
| --- | --- |
| Score by section with negative marks shown separately | keep |
| Accuracy versus attempt rate per topic (four quadrants) | keep |
| Marks left on the table: easy questions skipped or wrong | keep — most actionable |
| Time per question against the suggested time | keep, once per-question time is recorded |
| Trend across a student's mocks | keep, once there are two or more |
| Percentile or rank against others | later — needs enough attempts to mean anything |

## Owner decisions

| # | Decision | Recommendation | Status |
| --- | --- | --- | --- |
| D1 | Where the pipeline runs | Operator-only tool on the owner's Mac (Python + PyMuPDF, already in `requirements.txt`), private work folder outside the repo; not a hosted function | proposed |
| D2 | SVG in the bank | Add an optional verified `figure-vector` asset beside the required PNG; runtime shows SVG when present, PNG otherwise | **approved 20 Nov 2026** |
| D3 | Who drafts solutions | Claude in a local Claude Code session on the owner's subscription, writing private files, then human review. No paid API, no new service | **approved 20 Nov 2026** |
| D4 | Order of work | Re-ingest UCEED 2026 end to end first (comparable with its existing records), then solutions for the existing 1,714 records paper by paper | **approved 20 Nov 2026** |
| D5 | Analysis charts | The keep list above | **approved 20 Nov 2026**: all four groups (paper marks and topics, topic trend by year, attempt marks breakdown, attempt time and trend) |
| D6 | Roughworks dashboard | Study it through Claude in Chrome, where the owner is signed in, before stage 8 | open |
| D7 | Re-ingest existing papers | Yes, as corrections that keep provenance and keys; the block PNG stays as a fallback asset | open |

## Decisions log

- 20 Nov 2026: plan written. Pipeline lives in `apps/designmocks/ingestion/` as Python stages with `unittest` tests run by `npm run test:ingestion`. Work folders and real papers stay outside the repo; the tool refuses to write inside a Git worktree.
- 20 Nov 2026: owner approved D2 (PNG plus verified SVG), D3 (Claude drafts solutions in a local session, human review), D4 (UCEED 2026 re-ingest first) and D5 (all recommended analysis charts). D1, D6 and D7 stand as proposed until the owner says otherwise.
- 20 Nov 2026: stage 2 built and evaluated on 18 papers (above). OCR results are cached in `<work>/.cache` by page-render digest; the Swift helper is compiled once into `<work>/.tools`.
- 21 Nov 2026: stage 3 built. The canonical PNG handles Word crops (clip paths), transparency masks and page text over blank margins without falling back to a page render. Changed two verification rules (see the figure decision): 99th-percentile edge distance, and text inside figures is flagged rather than disqualifying.
- 20 Nov 2026: figures default to the embedded image's native bytes; SVG only as a verified addition; solution annotations are overlays and do not depend on vectorising.

## Stage 1 evaluation (20 November 2026)

Run on six of the owner's official papers in a private folder outside the repository (`~/dmocks-ingestion-work`, not committed). About 3 seconds and 20–45 MB per paper at 200 dpi.

| Paper | Pages | Figure placements | Unique images | Not extractable | Pages flagged for OCR |
| --- | ---: | ---: | ---: | ---: | --- |
| UCEED 2026 | 32 | 47 | 48 | 0 | none |
| UCEED 2025 | 26 | 35 | 36 | 0 | 1–4, 8 |
| UCEED 2015 | 42 | 73 | 73 | 0 | none |
| CEED 2026 | 29 | 45 | 45 | 0 | none |
| CEED 2025 | 31 | 47 | 50 | 0 | 15 pages |
| CEED 2021 | 28 | 44 | 44 | 0 | none |

What it showed:

- Every figure placement in all six papers came out as the image's own embedded bytes; none needed a crop from the render.
- The first OCR rule (little text, mostly image) missed real problems. CEED 2025 and UCEED 2025 have lines that are visible on the page but absent from the text layer, including question labels such as "Q.19", section headings and the marking scheme. A second rule now compares the render's dark pixels with what the text layer, figures and ruled lines explain. Clean papers score 0; the affected pages score 0.2–4%. Checked by eye on CEED 2025 page 13 and UCEED 2025 page 8: every flagged region was genuinely missing text.
- Consequence for stage 2: segmentation must merge OCR lines into the text layer on flagged pages before looking for question markers, or questions such as CEED 2025 Q.19 will be lost.

## Stage 2 evaluation (20 November 2026)

Run on all 18 official papers on the owner's machine (UCEED 2015–2026, CEED 2021–2026) and compared with the canonical bank by key. Only scores and keys were printed; no question content left the private folder.

| Measure | Result |
| --- | --- |
| Questions found | 1,173 (888 UCEED, 285 CEED), no gaps in any paper's numbering |
| Type (NAT/MSQ/MCQ/descriptive) agreeing with the bank | 100% of the 1,164 questions both have |
| Median prompt similarity with the bank, per paper | 0.95–1.00 (CEED 2025, the paper with a broken text layer, is 0.95) |
| Figure placements assigned to exactly one question | 100% on the six papers checked (UCEED 2015/2025/2026, CEED 2021/2025/2026) |
| Questions flagged for review | 1–8 per paper: text only inside the figure, animated figures shown as one still, option-count anomalies |

The remaining text differences are mostly on the bank's side: page footers inside options ("Birch Bark 2015 \| 31 May 2015"), section intros and the next question inside a prompt, and figure text pasted into a prompt. These become correction candidates once stage 7 exists.

Found in the papers but **missing from the bank** (owner to confirm): UCEED 2017 q51; UCEED 2019 q43, q71, q85; UCEED 2020 q37, q62; UCEED 2021 q52, q66; UCEED 2025 q36. The bank's UCEED 2021 `qb2` has no counterpart in the paper, which has one Part B question.

Lessons built into the code, each found on a real paper:

- Numbered instructions ("1. … 10.") flow into the question numbering. The questions are the longest run in one marker style, "Q.n" is preferred, and of two equal runs that share markers the later one wins.
- Section headings can split across two lines ("Section 3:" then "Multiple Choice Questions"), and a section's intro must not join the previous question.
- Part B either continues the numbering (UCEED), restarts at Q.1 (CEED), or is one unnumbered question under "PART B" (UCEED 2020–2023). Numbered evaluation criteria are not questions; lettered sub-tasks are not options.
- Broken text layers lose single labels such as "Q.03", too small for any ink threshold. If any page of a paper needs OCR, stage 2 reads every page; a "Q.19" read by OCR is kept even when the text layer has the rest of the line; a lone "55" fills the slot of a lost "Q.55". Full-page scans are body text, not figures.
- The bank's `visualDependency` reflects whole-question images, not real figures (UCEED 2026 q35 is plain text), so it cannot be used to check figures.

## Stage 3 evaluation (21 November 2026)

All results are in the private work folder; boards are at `03-figures/<key>/fig-N.board.png`.

- **Canonical PNG.** All 274 figures in UCEED 2026, 2020 and 2015 and CEED 2026 and 2025 hold the embedded image's own pixels, checked by a lossless round trip and against the page with one pixel of tolerance. None needed a page render. Three cases came from the papers:
  - Word crops (17 in UCEED 2020 alone). The whole image is embedded and a clip path shows part of it; one embedded image was a full desktop screenshot cropped to a font sample. The PNG is the embedded pixels cut to the clip, and it matches the page.
  - Transparency masks. The colour data alone is black where the mask hides it, so it is composited on white as the page shows it.
  - Page text over an image's blank margin, often the next question's prompt. This belongs to the page, so it is noted and ignored. Anything drawn over the picture itself still forces a page render.
- **SVG trial.** 40 of 274 figures verified (UCEED 2026: 8 of 47; 2020: 13 of 62; 2015: 7 of 73; CEED 2026: 6 of 45; 2025: 6 of 47). 45 were not eligible (photos, shaded renders, textures); the rest failed a check. Most failures are hairlines that lose more than 2% of their ink, small grey details merged into a neighbouring colour, and gradients flattened into one grey. The boards show the checks reject the right things.
- **Caveat from looking at the boards.** A verified trace can still taper hairline gaps and round their ends (UCEED 2026 q29). Each SVG therefore stays `approval: pending` until a person approves its board in stage 6, and the PNG stays primary for questions about fine detail.
- **Cost.** About 30 seconds per paper, mostly tracing and the OCR of each figure (cached).

## Running stages 1 to 3

```bash
pip3 install -r apps/designmocks/ingestion/requirements.txt   # operator machine only
brew install potrace                                         # stage 3 SVG trials
python3 apps/designmocks/ingestion/intake.py --paper /path/to/UCEED_2026_Question_Paper.pdf --exam uceed --year 2026 --work ~/dmocks-ingestion-work
python3 apps/designmocks/ingestion/segment.py --paper-id uceed-2026 --work ~/dmocks-ingestion-work
python3 apps/designmocks/ingestion/figures.py --paper-id uceed-2026 --work ~/dmocks-ingestion-work
npm --prefix apps/designmocks run test:ingestion
```

Photos instead of a PDF: pass `--photos page1.jpg page2.jpg …` in page order. Output goes to `<work>/<exam>-<year>/01-intake/`. The command prints a one-line JSON summary and refuses a work folder inside any Git repository, an existing intake without `--replace`, encrypted PDFs and files that are not PDFs. Photos are turned upright from their EXIF orientation and re-encoded without EXIF (no location or device data is kept).
