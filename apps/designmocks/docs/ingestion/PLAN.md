# Question-paper ingestion pipeline (UCEED and CEED)

Status: stages 1–4 built, stage 5 drafts and checks worked solutions, stage 6 records official-key approvals and private owner adjudications for keyless objective solutions, and stage 7 can dry-run or stage approved additions and corrections individually or in separate paper batches. Owner-adjudicated questions can only be staged as new additions. This file stays the reference until the last stage ships. Update it in the same change as the code.

## Scope

Extract objective questions, choices and figures from PDFs or ordered page photos. Match questions against official answer-key evidence, validate human-reviewed worked solutions and prepare a dry run against the canonical bank. The released attempt report can display worked steps after the existing release gates open.

## Related tools

| Piece | Where | What it does | Gap |
| --- | --- | --- | --- |
| Paper ingester | `tools/ingest_official_pdf.py` | PyMuPDF text + page renders, Apple Vision OCR for image-only pages, question markers, options, section/type maps, answer-key PDF parsing, optional local Ollama draft | Writes straight into a local SQLite; one monolith; no tests; figures are not separated from the question |
| Block cropper | `tools/crop_question_blocks.py` | Crops each question as one exact block from page renders, across page breaks | Whole question is one PNG; figure and options are not separate assets |
| OCR helper | `tools/ocr_vision.swift` | Apple Vision OCR with line boxes, local and free | macOS only |
| Vector pilot | `tools/build_visual_reconstruction_pilot.py` | Two NID figures traced to SVG with SSIM/diff comparison boards | Pilot only; NID scans |
| Answer engine | `tools/answer_engine.py`, `solver_*.py` | Queue of keyless questions solved twice and agreed | Answers only, no worked solution |
| Canonical bank | `server/data/exports/dexam-bank-export.json` | Canonical question, media and answer metadata | No solutions, no separate figures, no analysis |
| Bank addition path | `apps/designmocks/scripts/prepare-question-bank-addition.mjs` + `src/question-export-packet.mjs` | Verifies reviewed export packets and stages an addition outside the repo | Accepts PNG assets only |
| In-app intake | `supabase/functions/question-intake*`, `src/IntakeExtractionQueue.jsx` | Admin uploads an image; an OpenAI model extracts candidates for review | Closed by default (no approved model, cost or data processing) |
| Attempt insights | `src/attempt-insights.mjs` | Topic and section accuracy after a released attempt | No paper-level analysis, no time or difficulty view |

The file-based stages can be rerun and reviewed independently. Digital PDFs can contain both searchable text and raster figures. Keep original embedded pixels where possible and use local OCR for image-only or incomplete text layers.

## Stages

Each stage reads the previous stage's files from a private work folder **outside the repository** and writes its own. Nothing real is committed: tests use generated fictional papers.

```
<work>/<paper-id>/
  01-intake/     paper.json, pages/page-NNN.png, images/<sha>.<ext>, source/<original files>
  02-segments/   questions.json (boxes, text, options, figure regions per question)
  03-figures/    <question>/<figure>.png, .svg (if verified), verify.json, board.png
  04-key/        key.json (official answers matched to questions, mismatches)
  04-key-review/generated/   read-only PDF cell crops for unresolved or OCR-recovered keys
  05-solutions/  <question>.json (draft worked solutions, status)
  06-review/     <question>.json (human approvals with a fingerprint of the evidence)
```

| # | Stage | Input → output | Status |
| --- | --- | --- | --- |
| 1 | **Intake** | PDF or page photos → hashed source copy, page renders, per-page text with word boxes, embedded-image inventory with native bytes and placement, vector-drawing inventory, a `needsOcr` flag per page | [x] built 20 Nov 2026 |
| 2 | **Segmentation** | Page text and boxes → one record per question: number, section, type, prompt text, options, figure placements, page regions, flags. OCR (Apple Vision helper) merged in where the text layer is broken | [x] built 20 Nov 2026 |
| 3 | **Figures** | Figure placements → canonical PNG (embedded pixels, or a page render when the page shows something else), a block crop of every question, an SVG trial with metrics and a comparison board | [x] built 21 Nov 2026 |
| 4 | **Answer key** | Key PDF → per-question official key in the bank's notation (`A`, `A,B,D`, `B,C or B,C,D`, `11.5 to 12.5`, dropped), matched to stage 2 questions and compared with the bank; scanned keys read by OCR with safeguards. Consecutive missed labels are inferred only between printed endpoints. Empty numeric cells require two agreeing cropped OCR reads. A wholly missed row requires two agreeing reads of its label and two of its answer. All recovered cells are marked for visual review | [x] built 21 Nov 2026; missed-cell recovery added 22 Nov 2026 |
| 5 | **Solutions** | `solutions.py` provides an objective question, figures, key evidence and a structured draft template. Key disagreements are held, while answers proposed without a readable official key start as drafts | [~] drafting and validation tooling built |
| 6 | Review | The private solution review page shows the source question, key provenance and solution. An operator can approve a solution with a verified official key or record an independent owner adjudication when the key is missing or unreadable | [~] objective-solution approval built; full ingestion review still open |
| 7 | Export | Approved objective question and solution → verified private export directory with bank JSON, PNG media and receipt. Preserve step overlays as typed shapes linked to a canonical PNG | [~] additions and exact-version corrections can be staged individually or in paper batches. Reviewed Git promotion and media upload remain open |
| 8 | Analysis | Bank + attempts → paper analysis and attempt analysis views in the app | [~] released answer review can display visual worked solutions; paper analysis still open |

Stage 1 is deterministic. Stages 2–4 are deterministic with optional local OCR. A language model can assist with stage 5 drafting.

## Ordered page photos

Pass the photos to Stage 1 in reading order. The intake manifest records that order
and the SHA-256 of each upright PNG:

```sh
python3 apps/designmocks/ingestion/intake.py --exam uceed --year 2031 \
  --work ~/dmocks-ingestion-work --photos page-one.jpg page-two.jpg
python3 apps/designmocks/ingestion/segment.py --work ~/dmocks-ingestion-work --paper-id uceed-2031
python3 apps/designmocks/ingestion/figures.py --work ~/dmocks-ingestion-work --paper-id uceed-2031
```

Review every upright image listed in `01-intake/paper.json`. Record figure boxes in a
private JSON file. Include one entry for each page in intake order and use an empty
`figures` array after checking a page with no figures. Use integer pixel coordinates
from the upright PNG, with the origin at the top left and the right and bottom
edges excluded. List figures on each page in reading order.

```json
{"pages":[
  {"page":1,"renderSha256":"<SHA-256 from the page 1 record>","figures":[]},
  {"page":2,"renderSha256":"<SHA-256 from the page 2 record>","figures":[[30,90,220,300]]}
]}
```

For separately cropped image choices, use objects such as
`{"box":[30,90,220,300],"role":"option-A"}`. Label the complete set A–D. A
stem may use `"role":"stem"`. A single crop containing all four choices can
use a plain box when OCR picks up the four separate choice labels outside the crop.

Rerun Stage 2 with `--replace --photo-layout /path/to/private-layout.json`, then Stage 3
with `--replace`. Without a layout review, segments carry `photo-layout-unreviewed`
and the question blocks are available for inspection. Unresolved segmentation flags
block export. Review the question boundaries, wording, choices and all visible content,
including figure-only continuation pages. Stage 3 stores the actual pixel rectangles
and verified page render hashes with the crops. It preserves the upright pixels without
resizing. A crop or stitched block above the bank image limits requires smaller source
photos and a fresh intake. The official answer key still goes through Stage 4 as its
own independently verified PDF.

## Figure decision

Each figure gets exactly one **canonical asset**, the thing students see, chosen by this order:

1. **Native PDF vector** (drawing paths inside the figure region, no raster): export the paths as SVG directly. Lossless. Rare in these papers.
2. **Embedded raster** (the normal case): take the image's own bytes from the PDF, decode once and store as PNG (the bank requires PNG). No resampling. Keep the original JPEG bytes and its hash as evidence.
3. **Scan or photo**: crop from the page render. For photos, use the verified upright PNG and keep its source pixels. The crop evidence identifies the page render and the applied pixel rectangle.

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

**Solution drawings do not need the figure vectorised.** A solution's annotations (markers, highlights, arrows, labels, step reveals) are an SVG overlay in the canonical image's pixel coordinates, drawn on top of the PNG or SVG. The same annotation coordinates work when the figure remains a crop.

## Solution format

Fictional example:

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
  "overlay": { "figure": "q1-fig-1", "viewBox": "0 0 800 400", "steps": { "step-1": "<g>…</g>" } },
  "meta": { "topic": "", "subtopic": "", "difficulty": "easy|medium|hard", "seconds": 60, "technique": "" },
  "provenance": { "draftedBy": "", "status": "draft" }
}
```

Derive the answer from the question and use the verified official key to check it. The validator holds disagreements for human review. When the key is missing or unreadable, use `answer.source: "model-proposed"` for a model draft or `"human-proposed"` for a human draft supported by the reasoning. When the evidence is insufficient, leave the answer blank and set `provenance.status` to `held`. Steps stay under about 30 words each. MCQ and MSQ solutions check every option. NAT solutions show the arithmetic. Add an overlay when it clarifies a visual step.

`solutions.py` works with private files only. Run `brief` for each question, fill its template in `05-solutions/<question>.json`, then run `render` and review the question, key and worked steps together. The answer key retains the source PDF hash, printed value, page and extraction method. When the reasoning and source agree, a human reviewer can copy the fingerprint from the review page and record an approval:

```sh
python3 apps/designmocks/ingestion/solutions.py --work ~/dmocks-ingestion-work brief uceed-2031 q1
python3 apps/designmocks/ingestion/solutions.py --work ~/dmocks-ingestion-work render uceed-2031
python3 apps/designmocks/ingestion/solutions.py --work ~/dmocks-ingestion-work approve uceed-2031 q1 \
  --reviewer "$REVIEWER_NAME" --fingerprint "$REVIEWED_FINGERPRINT"
python3 apps/designmocks/ingestion/solutions.py --work ~/dmocks-ingestion-work check uceed-2031
```

`check` lists export-eligible solutions only while their approval matches the draft bytes, question, original key evidence and canonical images. Keyless drafts use the private review path below.

### Missing or unreadable official keys

The owner or a delegated human reviewer solves the question independently using the original paper and figures before opening the draft review. The existing `brief` command shows the question and source figures without the worked draft. Save the independent reasoning in a private UTF-8 text file. Open the rendered review, compare the answer and worked reasoning with the independent solve, and copy the adjudication fingerprint. If the answer or reasoning differs, resolve the discrepancy and review the resulting draft. Leave ambiguous questions held.

```sh
python3 apps/designmocks/ingestion/solutions.py --work ~/dmocks-ingestion-work adjudicate uceed-2031 q1 \
  --reviewer "$OWNER_REVIEWER_NAME" --fingerprint "$ADJUDICATION_FINGERPRINT" \
  --independent-answer "$INDEPENDENT_ANSWER" --reasoning ~/dmocks-private/owner-reasoning.txt
```

Adjudication requires an intact original PDF or ordered photo set, the current segmentation, a source block and any canonical figures, and a valid draft for a question with no unresolved segmentation flags. If a key PDF has been supplied, its preserved bytes and the relevant key record must support the missing or unreadable status. Resolve orphaned key files or conflicting key evidence before proceeding. Leave officially dropped questions held.

The operator command records the reviewer's name, answer, reasoning and fingerprint in the private Stage 6 receipt. Keep the work folder writable only by trusted operators and run the command only after human review. The tool checks the recorded answer and evidence hashes. Independence and the quality of the reasoning require human judgment.

A matching receipt appears as **owner-adjudicated** in `check` and the review page. Changed evidence requires a new review. Stage 7 has a separate, explicit addition path for this decision; it cannot replace an existing official answer. The staged bank record carries the normalized answer, decision and review fingerprints, while the reviewer's identity and private reasoning stay in Stage 6.

## Stage 7 dry run and private staging

From the repository root, use the app's installed Node dependencies to check an approved objective question against a pinned canonical bank. Pass the human-reviewed fingerprint and rights note. A correction also needs the current canonical question's content SHA-256 from the bank review workflow.

```sh
python3 apps/designmocks/ingestion/export.py uceed-2031 q1 \
  --work ~/dmocks-ingestion-work \
  --fingerprint "$REVIEWED_FINGERPRINT" \
  --expect-source "$REVIEWED_ORIGIN_MAIN_SHA" \
  --source-classification "$REVIEWED_SOURCE_CLASSIFICATION" \
  --rights-note "$REVIEWED_RIGHTS_NOTE"
```

For a new addition, supply the reviewed classification `owner-authorized` or `official-unlicensed`. The source classification describes the paper and the rights to use it. Official answer-key evidence is verified separately.

Stage 7 accepts a PDF or ordered page photos from the reviewed intake. For photos it checks the filename, byte length and SHA-256 of every original, including pages outside the selected question. The packet records the source type as `photo`. The bank provenance SHA-256 hashes the ASCII prefix `dmocks-paper-photos-v1` and the original SHA-256 hex digests in page order, with a newline between each item and no trailing newline. PDF provenance continues to use the original PDF's SHA-256.

For an owner-adjudicated question without a readable official key, use its **adjudication fingerprint** from the private review page and add `--owner-adjudicated`. This works only after the owner has recorded an independent answer and written reasoning with `solutions.py adjudicate`. Run it first without `--output`, inspect the dry run, then repeat with a new private output folder. It cannot be used with `--replace-expect` or to bypass a held question. The preparer checks the answer and figures and stages a Git-review-required record; it does not publish the answer or open a student paper.

```sh
python3 apps/designmocks/ingestion/export.py uceed-2031 q1 \
  --work ~/dmocks-ingestion-work \
  --owner-adjudicated --fingerprint "$ADJUDICATION_FINGERPRINT" \
  --expect-source "$REVIEWED_ORIGIN_MAIN_SHA" \
  --source-classification "$REVIEWED_SOURCE_CLASSIFICATION" \
  --rights-note "$REVIEWED_RIGHTS_NOTE"
```

For a correction, pass `--replace-expect "$CURRENT_QUESTION_SHA256"` and omit `--source-classification`. The correction path requires the same paper, exact original source digest, question number, type, prompt, choices and canonical image bytes. It preserves the existing record's identity, provenance, rights labels and media path. The replacement key retains its official notation and source evidence. The dry run refuses flagged segments and questions that need image bytes outside the reviewed set.

For an existing visual question whose canonical asset is a whole-question block, also pass
`--media-root /path/to/server/data/media`. The preparer verifies the original block from that
private media root. If the worked solution annotates a separately extracted figure, it adds
that exact reviewed PNG as a solution-only asset. The active paper still shows only the
original question block; the extra figure is used in the released worked-solution view.
Without `--output`, the export stays a dry run and does not write to the canonical bank.
After checking the dry-run result, repeat the same command with `--output` pointing to a
new private directory outside the repository and every Git worktree. The bank preparer
creates `dexam-bank-export.json`, verified `media/` PNGs and `receipt.json` there, with
private file permissions. The command rejects an existing output directory, changed
approval, changed source commit, incomplete objective answer or changed media bytes.
An exact no-op returns `mode: no-op` and creates no directory. Staging does not commit
to Git, upload media or publish a paper; review the receipt and proposed diff first.

```sh
python3 apps/designmocks/ingestion/export.py uceed-2031 q1 \
  --work ~/dmocks-ingestion-work \
  --fingerprint "$REVIEWED_FINGERPRINT" \
  --expect-source "$REVIEWED_ORIGIN_MAIN_SHA" \
  --source-classification "$REVIEWED_SOURCE_CLASSIFICATION" \
  --rights-note "$REVIEWED_RIGHTS_NOTE" \
  --output ~/dmocks-private/approved-uceed-2031-q1
```

Stage two to 100 **approved new additions** from one paper with `export_batch.py`.
List the selected objective questions and their exact Stage 6 fingerprints in a private
JSON manifest. All additions share the reviewed source classification and rights note.

```json
{"questions":[
  {"key":"q1","fingerprint":"<64-character reviewed fingerprint>"},
  {"key":"q2","fingerprint":"<64-character reviewed fingerprint>"}
]}
```

```sh
python3 apps/designmocks/ingestion/export_batch.py uceed-2031 \
  --work ~/dmocks-ingestion-work \
  --manifest ~/dmocks-private/uceed-2031-approved-additions.json \
  --expect-source "$REVIEWED_ORIGIN_MAIN_SHA" \
  --source-classification "$REVIEWED_SOURCE_CLASSIFICATION" \
  --rights-note "$REVIEWED_RIGHTS_NOTE" \
  --output ~/dmocks-private/approved-uceed-2031-additions
```

For questions already in the canonical bank, stage two to 100 **approved corrections**
together with `export_batch.py`. Put only the selected review keys, their current Stage 6
fingerprints, and each exact current bank question content SHA-256 in a private JSON
manifest. Every item must retain the same original paper source digest, question number, prompt,
choices and source classification. The command reads each approval again and sends all
packets to one canonical bank check against the same pinned `origin/main` commit.

```json
{"questions":[
  {"key":"q1","fingerprint":"<64-character reviewed fingerprint>","replaceExpected":"<64-character current question SHA-256>"},
  {"key":"q2","fingerprint":"<64-character reviewed fingerprint>","replaceExpected":"<64-character current question SHA-256>"}
]}
```

```sh
python3 apps/designmocks/ingestion/export_batch.py uceed-2031 \
  --work ~/dmocks-ingestion-work \
  --manifest ~/dmocks-private/uceed-2031-approved.json \
  --expect-source "$REVIEWED_ORIGIN_MAIN_SHA" \
  --media-root /path/to/server/data/media \
  --rights-note "$REVIEWED_RIGHTS_NOTE" \
  --output ~/dmocks-private/approved-uceed-2031-batch
```

Omit `--output` for a dry run. Both batch paths recheck every selected question against
its Stage 6 approval, verify its media and use one pinned `origin/main` commit. A stale
bank version, held or flagged question, missing or changed media, missing or changed
approval, or incomplete objective review rejects the entire batch. Failed staging
leaves no partial directory.

For visual solutions, the packet carries the full plain-text explanation and typed steps with drawing shapes. Each overlay uses the exact PNG's hash and dimensions. Supported SVG shapes and short text labels are converted to data, with no links, styles or embedded images. A visual correction either reuses a matching existing figure or adds the reviewed extracted PNG as a solution-only asset. The runtime validates the shapes again and freezes the solution in the private explanation snapshot. The unannotated PNG may be signed with the other question media during an active attempt; the worked steps remain in the private explanation and appear only after the existing result release gates open. The text remains readable if the figure fails to load.

The command reports whether the existing checks accept the proposed addition or correction. It deletes its temporary packet and media copies when it finishes. A staged output persists outside the repository for review; committing the reviewed export, uploading media and publishing a paper remain subsequent work.

## Analysis

Proposed paper and attempt analysis views.

Paper analysis (from the bank, no student data):

| Chart | Recommendation |
| --- | --- |
| Marks by section and response type (NAT/MSQ/MCQ) | keep |
| Topic share of marks, this paper | keep |
| Topic trend across years (heat map) | keep — shows what is rising |
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

## Operator review

Run the pipeline locally with a private work folder. Drafting can be done by a human or in a local model session. Every accepted solution still needs an explicit human approval tied to the reviewed inputs. Staged export is available; committing it to the canonical bank and staged publication require a separate review.

## Validation notes

The ingestion test suite generates fictional PDF, photo, figure, key and solution fixtures. Any comparisons with the private question bank stay in the operator work folder.

- Intake flags unexplained page ink for OCR when visible writing is missing from the PDF text layer. Segmentation checks the OCR lines for missing question markers and keeps instructions and evaluation criteria outside question prompts.
- Canonical images keep embedded pixels where possible, including clipped images and transparency masks. SVG trials can lose fine details even when similarity scores pass. Review the private comparison board before approving a trace.
- Scanned key rows are matched by table position. Missed labels or answer cells are recovered only under the guarded OCR checks above. `key_review.py` renders the source PDF crop for every unresolved or recovered cell, with the current extraction status. It verifies the preserved PDF and segmentation hashes before rendering. This page does not approve or change a key. Inspect it before accepting a worked solution.
- Matching the official answer confirms the final value. Review the worked reasoning, arithmetic, figures and annotations before signing off. A numeric answer inside the printed accepted range can pass the key comparison.

### Manually transcribing an unresolved key cell

For a cell whose printed answer remains unreadable to OCR, write a proposal JSON in the private work folder. Include the current `key.json` source SHA-256, and only keys still marked `missing` or `unreadable`:

```json
{"schema":1,"paperId":"uceed-2031","sourceSha256":"<source PDF SHA-256>","entries":[
  {"key":"q1","printed":"12"}
]}
```

`key_transcription.py prepare` renders each proposed value alongside its original PDF crop and fingerprints the exact source PDF, segments, extracted key manifest and crop pixels. It does not change the key. After a human checks that packet, `approve` requires its fingerprint and the reviewer's name. Approval records a private receipt and a backup of the extracted key, then updates only those unresolved cells. Worked solutions still need their own human review; this does not publish a paper. A changed PDF, segments, extracted key, crop, packet or receipt invalidates the decision.

```bash
python3 apps/designmocks/ingestion/key_transcription.py --paper-id uceed-2031 --work ~/dmocks-ingestion-work prepare --decisions ~/dmocks-ingestion-work/uceed-2031/proposed-key-cells.json
python3 apps/designmocks/ingestion/key_transcription.py --paper-id uceed-2031 --work ~/dmocks-ingestion-work approve --packet /private/path/from/prepare/packet.json --fingerprint "$REVIEWED_FINGERPRINT" --reviewer "$HUMAN_REVIEWER" --compare-bank
```

## Running stages 1 to 4

```bash
pip3 install -r apps/designmocks/ingestion/requirements.txt   # operator machine only
brew install potrace                                         # stage 3 SVG trials
python3 apps/designmocks/ingestion/intake.py --paper /path/to/fictional-paper.pdf --exam uceed --year 2031 --work ~/dmocks-ingestion-work
python3 apps/designmocks/ingestion/segment.py --paper-id uceed-2031 --work ~/dmocks-ingestion-work
python3 apps/designmocks/ingestion/figures.py --paper-id uceed-2031 --work ~/dmocks-ingestion-work
python3 apps/designmocks/ingestion/answer_key.py --paper-id uceed-2031 --key /path/to/fictional-key.pdf --work ~/dmocks-ingestion-work --compare-bank
python3 apps/designmocks/ingestion/key_review.py --paper-id uceed-2031 --work ~/dmocks-ingestion-work
npm --prefix apps/designmocks run test:ingestion
```

Photos instead of a PDF: pass `--photos page1.jpg page2.jpg …` in page order. Output goes to `<work>/<exam>-<year>/01-intake/`. The command prints a one-line JSON summary and refuses a work folder inside any Git repository, an existing intake without `--replace`, encrypted PDFs and files that are not PDFs. Photos are turned upright from their EXIF orientation and re-encoded without EXIF (no location or device data is kept).
