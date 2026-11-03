# PDF question regeneration workflow

This document is the repeatable procedure for turning an owned or licensed exam-paper PDF into structured Dexam questions. It deliberately separates semantic HTML text from source pixels.

## Output contract

Every imported question must contain:

1. A stable `paper_id`, `question_no`, and question ID.
2. Prompt text stored as text, never baked into a newly generated screenshot.
3. Structured options with stable IDs (`A-D` or `1-4`).
4. The question type (`NAT`, `MSQ`, `MCQ`, or `DESCRIPTIVE`).
5. A lossless PNG crop for source visual material when the question depends on a diagram, photograph, drawing, chart, or visual option, with a `crop_review` state (`pending`, `approved`, or `rejected`).
6. Source-page provenance and a review status.
7. An answer provenance status that distinguishes official keys, matched sources, and drafts.

The source crop is pixel-preserving. A reviewed crop (`crop_review = 'approved'`) is the publication format for picture questions; SVG reconstruction is optional and deferred. JavaScript is responsible for accessible layout, responsive sizing, full-screen zoom, navigation, and answer controls. JavaScript must not approximate or redraw a source diagram unless a human has explicitly approved a vector reconstruction.

## New PDF procedure

From the repository root. On a database created before 2026-10-28, run `python3 tools/migrate_crop_review.py` once first; it backs up the database with the SQLite backup API and adds the `crop_review` column.

```bash
python3 tools/ingest_official_pdf.py \
  --paper /absolute/path/to/questions.pdf \
  --answers /absolute/path/to/answer-key.pdf \
  --exam uceed \
  --year 2027 \
  --paper-id uceed-2027 \
  --title "UCEED 2027 official paper" \
  --db server/data/dexam.sqlite \
  --media-root server/data/media \
  --ocr --enhance-scans --enhancement-scale 2 \
  --replace

python3 tools/regenerate_visual_questions.py
python3 tools/build_generic_question_bank.py
python3 tools/build_question_recovery_queue.py
node tools/validate-data.js
```

Omit `--answers` when no key is available. Never relabel a generated or third-party-matched answer as official.

### Low-resolution and scanned PDFs

Always preserve the supplied PDF and the normal page render. `--enhance-scans` creates a separate grayscale PNG derivative, upscales it with Lanczos resampling, applies autocontrast, median denoising, contrast correction, and unsharp masking, and sends that derivative to OCR. It never overwrites the source. Use scale 2 normally and scale 3 only when characters remain too small. Enhancement can improve legibility but cannot restore information absent from the scan; ambiguous text remains `needs-verification` and must not be silently guessed.

If a scanned paper contains a useless embedded text layer (for example, only an advertising watermark while the questions are pixels), add `--ocr-all` so OCR replaces that layer. For the reviewed VDDS/DQ Labs layout only, add `--sanitize-coaching-watermarks`; it preserves the PDF and source render, while clearing the known promotional header/footer bands from the derived page used for question figures. Do not use margin sanitization on a new layout until representative pages confirm that no question content occupies those bands.

Do not use a binarized or enhanced derivative as the candidate-facing visual unless a reviewer confirms that it preserves every relevant line, colour, texture, label, and option. Candidate-facing figure crops normally come from the original render.

## Generic reusable bank

The imported SQLite records are private source records. Do not delete their exam and paper provenance. `tools/build_generic_question_bank.py` creates a separate topic-first artifact for reusable paper generation.

The generic artifact:

- exposes no exam field in question objects;
- removes exam names and paper boilerplate from question-facing text;
- excludes `DESCRIPTIVE` written tasks;
- excludes image-only placeholders;
- serves a picture question with its lossless PNG crop once a reviewer has approved that crop (see "Crop review" below); an approved SVG reconstruction is optional and not required;
- holds back a question whose prompt names a picture ("figure", "shown", "diagram", and the other cues in `VISUAL_RE`) but which has no crop yet, so a picture question is never served as text alone;
- emits `figurePaths` as `/media/...` URLs that the server can serve;
- groups all included questions by normalized topic;
- retains paper provenance only inside `privateSource`, which must never be rendered to candidates.

Run the generic-bank builder after every import, correction, answer-key update, crop review, or semantic-visual approval. Review `server/data/sources/generic-bank-report.json` before publishing. Its `readiness` block counts every question per exam and type by what it still needs, and `cropReviewQueue` is the number of crops waiting for review.

## Publication lanes and answer confidence

The builder produces four operational lanes:

1. `generic-question-bank.json`: objective questions with a usable prompt/options and an answer whose status is `official-key`, `matched-source`, `matched-source-positional`, or `independently-solved`. A picture question also needs an approved crop. This is the only objective bank served to candidates.
2. `needs-answer-key-bank.json`: clean, structured objective questions whose answer is absent or not sufficiently supported, including picture questions whose crop is already approved. These can be sent to the owner for a key or independently solved and reviewed later.
3. `part-b-question-bank.json`: drawing, design, and written tasks. These expose the prompt and any approved figure, then accept JPG, PNG, or PDF answer uploads. They are rubric-scored, not auto-scored.
4. `question-recovery-queue.json`: records still needing transcription, option repair, visual isolation, or crop review.

A picture question (non-empty `figure_paths_json`) is published by these rules, checked in this order:

1. `DESCRIPTIVE` goes to Part B. Image-only placeholders, MCQ/MSQ with fewer than two structured options, and prompts that are empty after brand removal are held back as before. A crop does not replace text options: when the options are printed inside the picture, the record stays under `structured-options-missing`.
2. Every figure file must exist (`visual-crop-file-missing` otherwise).
3. `crop_review = 'rejected'` holds it back as `visual-crop-rejected` for a new crop.
4. `crop_review = 'pending'` holds it back as `visual-crop-awaiting-review`. This is the crop-review queue.
5. `crop_review = 'approved'` sends it to lane 1 or lane 2 by answer confidence, carrying `figurePaths`.

A prompt that names a picture but has no crop at all is held back as `visual-crop-missing`.

### Crop review

`crop_review` lives on each `questions` row and defaults to `pending`. Only a human sets it, in the review console (`admin.html`, field **Crop review**, filter **Crop**), which writes through `PATCH /api/official/questions/:id` with `{"cropReview": "approved" | "rejected" | "pending"}`. The server refuses `approved` for a question with no crop.

Approve a crop only after comparing it with the source page at 100% and confirming that:

- it holds the whole figure, and every picture option with its label, exactly as printed: nothing rotated, mirrored, moved, cut off, added, or removed (see "Geometry, orientation and context must not change");
- it holds nothing else: no paper header, page number, printed question number or prompt text, neighbouring question, or answer marks;
- it is the lossless PNG from the original render, not an enhanced or binarized derivative.

Reject it otherwise. A rejected crop goes to `manual-crop-from-page`; after a new crop is saved, set the state back to `pending` and review again. `tools/regenerate_visual_questions.py` and `tools/attach_exam_figures.py` reset `crop_review` to `pending` whenever they change a question's crop, so an approval always refers to the pixels that are served.

An independently solved answer moves to the ready bank only after the solver records the method, a second pass reproduces the result without seeing the first answer, and any ambiguity in the question is resolved. A plausible guess is not high confidence. Current-affairs answers must also be checked against the date of the source paper.

## Target-paper blueprints (verified for the 2026 cycle)

These are generation targets, not permanent truths. Recheck the official brochure every admission cycle and version the blueprint by year.

### UCEED

- Total: 3 hours, 300 marks; both parts mandatory.
- Part A: 2 hours, 200 marks — 14 NAT (56), 15 MSQ (60), 28 MCQ (84). NAT has no negative marking; MSQ uses the official partial-marking ladder and -1 otherwise; MCQ is +3/-0.71.
- Part B: 1 hour, 100 marks — one 50-mark sketching task and one 50-mark design-aptitude task.
- Coverage: visualisation/spatial reasoning, practical/scientific knowledge, observation/design sensitivity, environment/society, analytical/logical reasoning, language, and creativity; Part B focuses on drawing and design aptitude.

### CEED

- Total: 3 hours; both parts mandatory.
- Part A: 1 hour, 150 marks — 8 NAT (32), 10 MSQ (40), 26 MCQ (78). NAT has no negative marking; MSQ uses the official partial-marking ladder and -1 otherwise; MCQ is +3/-0.5.
- Part B: 2 hours, 100 marks — five mandatory 20-mark tasks: Sketching, Creativity, Form Sensitivity, Visual Sensitivity, and Problem Identification. Candidate answers are manual/upload responses and must not be auto-scored.
- Final CEED score: 25% Part A and 75% Part B; only shortlisted Part A candidates have Part B evaluated.

### NID B.Des DAT

- Use a two-stage model: DAT Prelims for shortlisting, followed by DAT Mains in multiple formats such as a studio setup.
- The official handbook does not guarantee a fixed reusable count/type grid. Therefore the generator must not hard-code question counts from a coaching source or an old paper.
- A practice Prelims should mix observation, visual/spatial reasoning, design sensitivity, creativity, communication, reasoning, and general awareness, with both objective and constructed responses where the selected official sample supports them.
- A Mains simulation is an upload/rubric session for studio sensitivity, making/drawing/design responses, and any announced in-person component. Preserve materials, time, deliverable, and rubric per task.
- Keep the stage weights in a year-versioned config; do not carry a previous year's 40/60 split forward without checking the current handbook.

### NIFT

- B.Des Stage 1: GAT Section A, 120 minutes, 100 questions — Communication Ability and English Comprehension 40, Quantitative Ability 20, Analytical and Logical Ability 15, General Knowledge and Current Affairs 25 — plus a 3-hour CAT with three tasks in the 2026 notice.
- B.Des final weighting: GAT 30%, CAT 50%, Situation Test 20%. The Situation Test is an upload/rubric simulation; it evaluates a model/prototype and its explanatory write-up rather than a single answer key.
- B.F.Tech: the same 100-question Section A (120 minutes), plus a 50-question/60-minute Section B: Quantitative Ability 15, Analytical and Logical Ability 15, Case Study 20. Final weighting is Section A 30%, Section B 70%.
- M.Des: 120-question/120-minute GAT — Communication/English 50, Quantitative 20, Analytical/Logical 25, General Knowledge/Current Affairs 25 — plus a 3-hour, three-task CAT. Final weighting: GAT 30%, CAT 40%, interview 30%.
- NIFT states that section counts and difficulty can vary by year. Store these as a `2026` blueprint, not a universal constant.

## Cross-exam assembly rules

Source exam is provenance, not a candidate-facing category. A source question may be used in another target mock when its topic, response mode, cognitive skill, difficulty, and time demand fit the target blueprint. For example, a spatial NAT from one source can fill a spatial NAT slot elsewhere, while a fashion-current-affairs MCQ should only fill a target slot that explicitly calls for that knowledge.

- Select by `topic + subtopic + type + difficulty + estimatedTime + visualDependency`, never by source label alone.
- Apply the target exam's marks and negative marking; do not inherit the source paper's scoring.
- Preserve the target's objective/subjective ratio and section timing.
- Do not convert a subjective drawing task into an MCQ merely to fill a quota.
- Prevent near-duplicates and avoid repeated source stems within one mock.
- Keep exam names, years, page headers, and source IDs out of candidate-facing question text.
- Save the generated paper's blueprint version and private source IDs so an editor can audit the mix.

## Recovery queue for excluded records

`tools/build_question_recovery_queue.py` converts every excluded record into batches of 25. Work in queue order and update only after comparing the result with its source page.

- `review-clean-crop`: compare the crop with its page and set `crop_review` to `approved` or `rejected`. Records with a trusted answer come first in each batch, because approving them moves them straight into the ready bank. `cropMarkerFound: false` means the detector fell back to a wide page block, so check its edges closely.
- `manual-crop-from-page`: isolate the figure manually because the crop was rejected or its file is missing.
- `generate-crop-from-page`: the prompt names a picture but no crop exists yet (for example, a paper imported after the last visual regeneration). Crop that paper with `regenerate_visual_questions.py`, then review the crops.
- `transcribe-and-structure-options`: rewrite the visible options as text and preserve their order.
- `transcribe-prompt-options-and-isolate-visual`: rebuild an image-only question from its page, including prompt and options.
- `transcribe-brief-and-create-rubric`: send written/drawing work to the studio bank with time, deliverable, and scoring criteria.

Only an approved crop may enter the generic bank. A crop must contain the figure or photograph, and any picture options, only—not the paper header, page number, printed question number, neighboring question, prompt, or answer markings.

## Text transcription rules

- Embedded PDF text is preferred over OCR.
- OCR is only a draft for scanned pages.
- Preserve punctuation, mathematical symbols, capitalization, units, paragraph breaks, and option order.
- Remove headers, footers, page numbers, coaching advertisements, and watermarks only when they are not part of the question.
- Do not silently repair ambiguous words or numbers. Mark the row `needs-verification` and compare it with the page crop.
- Image-only questions must keep a descriptive placeholder until a reviewer transcribes any visible wording.
- A question is `verified` only after its HTML text and options are compared with the source crop.

## Visual extraction rules

- Render pages to PNG without lossy recompression.
- Crop by detected question-number boundaries.
- Retain original colour, line thickness, labels, and pixel geometry.
- Do not use generative image tools for official diagrams.
- If several questions share a page, verify that the crop stops before the next question.
- If a figure spans pages, keep multiple ordered figure paths.
- Keep the full page render as provenance even after producing the question crop.
- Serve an approved crop byte-for-byte. Do not recompress, resample, recolour, or re-crop it after approval; any change resets `crop_review` to `pending`.

## High-fidelity visual reconstruction stack

SVG is vector geometry, not a pixel format. A literal pixel-for-pixel SVG is either an SVG that embeds the original raster image or an inefficient grid of coloured rectangles; neither makes the visual meaningfully editable. Choose the representation from the source content:

- Diagrams, line art, grids, geometric puzzles, arrows, and symbols: reconstruct as semantic SVG.
- Flat black-and-white artwork with clean boundaries: preprocess with OpenCV and trace with Potrace, then manually correct paths and labels.
- Photographs, shaded drawings, textures, paintings, and irregular natural objects: use a lossless, tightly cropped PNG. Do not vectorise these merely to claim SVG output.
- Mixed visuals: use SVG for labels, lines, and geometry, with an embedded or linked lossless raster only for the photographic region.

Recommended implementation:

1. Python with PyMuPDF renders the source region at 300-600 DPI.
2. OpenCV performs deskewing, illumination correction, denoising, thresholding, contour detection, and perspective correction. Pillow handles lossless crops and colour management.
3. Potrace provides an initial path trace for monochrome shapes. Inkscape is the preferred manual correction and inspection tool.
4. Generate final SVG as XML from Python or TypeScript. Browser JavaScript should render and interact with the SVG; it should not guess the original geometry at runtime.
5. Keep visible wording in HTML whenever possible. Text inside a diagram may remain SVG `<text>` only when its position is part of the problem. Use an embedded font or convert approved labels to paths when exact typography is essential.

### Geometry, orientation and context must not change

A recreated image is a copy of the source in a cleaner format, never a redesign. In visual-reasoning questions the answer usually depends on exactly where things are and which way they face: a rotation, mirror, fold, path, sequence, or "which option replaces the question mark" puzzle. If an element moves, turns, flips or disappears, the question changes, and the official answer may become wrong. A reconstruction that changes any of the following is rejected:

- **Orientation:** no rotating, mirroring, flipping or transposing of the figure or any element in it. Keep a shape that is printed tilted tilted, keep rotated labels rotated, and keep every arrow pointing the same way.
- **Position and layout:** every element stays at its source coordinates and keeps its arrangement relative to everything else. Do not re-centre, re-space, re-align, reflow, snap to a grid, or reorder anything, including the options A–D and their labels.
- **Proportions and scale:** scale only uniformly. Keep the aspect ratio, relative sizes, angles, line lengths, line weights and gaps between elements.
- **Context and content:** add nothing and remove nothing. Keep the reference figure, the `?` marker, arrows, dashed or hidden lines, dimension labels, letters, numbers and colours. Colour is content when the question refers to it.
- **Coordinate system:** the SVG `viewBox` maps one-to-one onto the source crop. `tools/figure_to_svg.py` writes the viewBox in PDF points and records the crop as `data-bbox-pt`, so every element can be traced back to its place on the page.
- **Clean-up steps:** deskew and perspective correction may only undo scan or photo distortion. They apply to the whole page, never to one element, and are logged with the angle used. Digital (non-scanned) figures are left alone. Never "straighten" a figure that is drawn at an angle on purpose. Line straightening, snapping and path simplification must not move any endpoint or corner by more than 1 px at the source crop's resolution.
- **Text labels:** when a label becomes SVG `<text>`, it keeps its original position, baseline, size and rotation. Its width is fixed with `textLength` so a different font cannot shift it.

When in doubt, keep the clean PNG crop. An exact raster is always better than a vector that has moved. Publication does not wait for SVG: a picture question is served with its approved PNG crop, and an SVG replaces it only after passing the accuracy gate below.

### Accuracy gate

Every reconstruction is rendered at the source crop's exact pixel dimensions and compared with the source using:

- pixel-difference heatmap and differing-pixel percentage;
- structural similarity (SSIM);
- edge-map overlap for line drawings;
- manual overlay at 50% opacity and inspection at 100%, 200%, and mobile display sizes;
- checks for dimensions, line width, labels, option order, colour, and whitespace;
- a geometry check: each element's bounding box and centre in the render must sit within 2 px of the source, and the overlay must line up with no visible shift, rotation or mirror. Any moved, turned, flipped, missing or added element fails the gate, whatever the overall difference score.

Automatic tracing is only a draft. A visual becomes `approved-semantic-svg` after a human comparison confirms that no answer-relevant detail changed. If that gate cannot be met, retain the clean PNG crop rather than publish an inaccurate SVG.

## Browser rendering rules

The timed player renders prompt and options as semantic HTML. `figurePaths` are rendered between the prompt and answer control. Images use `object-fit: contain`, keep their intrinsic aspect ratio, and open in the native full-size viewer. Alt text identifies the image as source material for the current question without attempting to reveal the answer.

## Required quality checks

For every imported paper:

1. Compare question count against the paper.
2. Check first, middle, and last questions in every section.
3. Review every row marked image-only or `needs-verification`.
4. Check every visual crop with `markerFound: false` in the regeneration report, and work the `review-clean-crop` queue so no crop is served unreviewed.
5. Confirm option order and answer-key mapping.
6. Test one NAT, MSQ, MCQ, and descriptive question in the timed player.
7. Test image zoom on desktop and mobile widths.
8. Run `node --check app.js`, `node --check server.js`, and `node tools/validate-data.js`.
9. Keep the timestamped database backup and regeneration report until review is complete.

## Roughworks-derived presentation principles

The public Roughworks presentation was used only as a behavioural reference. The reusable principles are structured question metadata, searchable HTML text, a paper palette, type-specific answer controls, responsive visual media, and post-submission review. Do not copy Roughworks code, branding, private data, or question content.

## Failure handling

- Missing marker: preserve the full source block and require visual review.
- OCR mismatch: keep the crop, mark the text for verification, and do not guess.
- Missing image: stop publication for that question.
- Multi-question crop: adjust the detector or add an explicit crop override; do not permanently hand-edit the generated PNG without recording the source coordinates.
- Re-import: use `--replace`, then rerun visual regeneration. The scripts create a recoverable SQLite backup before changing question rows.

## Printed blocks and owner review (2026-10-29, platform D-060)

- `tools/crop_question_blocks.py` crops every question (UCEED, CEED, NID; NIFT picture questions and CAT) as one exact block from its page renders.
  - Each block runs from the question's number to the next question's, across page breaks.
  - Headers, footers and section headings are left out.
  - Drawing tasks lose their blank answer boxes.
  - Confidence flags go to `block_meta_json`. A changed block resets `crop_review` to `pending`.
- `tools/repair_instruction_questions.py` fixed UCEED 2015–2017, where the ingest had stored the paper's instructions as Q1–Q6.
- `tools/load_original_drawing_mocks.py` loads Dexam's original NID DAT drawing mocks from `content/nid-dat-drawing-mocks.json`. They follow the 2026 pattern: six tasks, 100 marks, 3 hours.
- **Export:** `tools/export_platform_bank.py` serves a question as its printed block (`display: block`) once `crop_review = approved`. It also writes `dexam-review.json` for the platform's local review page.
- **Owner verdicts:** `tools/apply_owner_verdicts.py` applies the verdicts saved by that page (`server/data/reviews/owner-verdicts.json`).

## Number-free blocks and task collections (2026-10-29, platform D-061)

- **OCR helper:** `server/data/.cache/ocr_vision2`, built from `tools/ocr_vision.swift`. It also returns each leading question number's exact box. `crop_question_blocks.py` paints that box white, so no block carries its source number. This includes "Question No. 8" headings and sub-part labels such as "21A)".
- **Task collections:** `tools/ingest_task_collection.py` ingests owner-provided task collections (scanned PDFs, column-aware). Each task is clean text, or an exact crop when it has a picture. Every task gets a drawing type and is held until the owner reviews it.
- **Drawing types:** the export gives every drawing task the topic `drawing-<type>`, which the platform uses to mix NID DAT drawing mocks.
