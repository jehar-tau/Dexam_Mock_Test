# Official paper workspace

This is a local research lane for official question papers that the user owns or is licensed to use. It is deliberately separate from the original practice bank in `practice-*.js`.

The extractor, schema, OCR helper, and review console are tracked in Git. The extracted papers, page images, source PDFs, SQLite database, and compiled OCR cache are local-only.

## Current local archive

As of 2026-10-28 the workspace contains **61 paper records and 4,183 question records**:

| Group | Papers | Questions | Answered |
|---|---:|---:|---:|
| UCEED 2015–2026 | 12 | 880 | 869 |
| CEED 2010–2026 | 18 | 834 | 252 |
| NIFT 2012–2014 + samples | 22 | 2,118 | 375 |
| NID 2016–2020 + samples | 9 | 351 | 18 |
| **Total** | **61** | **4,183** | **1,514** |

All papers have rendered page images. NIFT uses JPEG page images; the others use PNG. The local media directory is about **966 MB**.

### CEED

- 18 papers, 2010–2026. 2016 had two papers (`ceed-2016-paper1`, `ceed-2016-paper2`). The two supplied 2026 files are byte-identical, so 2026 was imported once.
- 834 records: 740 Part A questions and 94 Part B questions.
- Official keys for 2020–2025 (252 answers, every Part A question in those years). No keys were supplied for 2010–2019 or 2026.
- The 2021 key PDF is a scanned image. It was transcribed by hand to `server/data/sources/answer-keys/CEED2021_Answer_Key_transcribed.txt` and cross-checked against Apple Vision OCR.
- Key cells such as `7 OR 9`, `B OR B, C`, `94.2 (92.9 - 94.6)`, `DROPPED` and `FULL MARKS` are stored verbatim.

| Paper | Format | Import flags |
|---|---|---|
| 2010 | Q1 split into 1.1–1.7; Q2–6 drawing tasks | `--default-type DESCRIPTIVE --no-gap-fill` |
| 2011 | Scanned; same layout as 2010 | `--ocr --default-type DESCRIPTIVE --no-gap-fill` |
| 2012 | Scanned; 40 MCQs + Part B | `--ocr --default-type MCQ --no-gap-fill` |
| 2013 | `Question No. N`, options 1–4 | `--default-type MCQ --no-gap-fill` |
| 2014 | `Q1:` with A–D | `--default-type MCQ` |
| 2015–2024, 2026 | Sections read from the paper | none |
| 2016 paper 2 | Q47–48 are on an image-only page | `--ocr` |
| 2025 | Question numbers are not in the text layer | `--ocr --ocr-all --type-map 1-8:NAT,9-18:MSQ,19-44:MCQ` |

Every CEED import used `--exam ceed --year YYYY --paper-id ceed-YYYY --replace`, plus `--answers` for 2020–2025.

### UCEED

- 12 papers, 2015–2026.
- 874 question records.
- 57 answer-key matches in UCEED 2026.
- 11 descriptive / Part B records across the later papers.
- 2026 is the only supplied paper with an answer key.

### NIFT

The supplied NIFT PDFs are image-only. Several are compilations of multiple booklets, so they were split by page range into separate paper records.

| Source | Papers | Questions |
|---|---:|---:|
| `2012.pdf` | 6 | 572 |
| `2013.pdf` | 6 | 731 |
| `2014.pdf` | 4 | 296 |
| Standalone B.Des / B.F.T / M.Des / M.F.M samples | 6 | 519 |
| **Total** | **22** | **2,118** |

The 2012, 2013, and 2014 files repeat booklet instructions and reset question numbering. Treating each file as one paper would either collapse repeated numbers or turn the numbered instructions into questions. The page ranges below preserve each booklet separately.

| Paper | PDF pages | Default type |
|---|---:|---|
| `nift-2012-bdes-cat` — B.Des CAT | 1–5 | `DESCRIPTIVE` |
| `nift-2012-written-set1` — written booklet 1 | 6–23 | `MCQ` |
| `nift-2012-mdes-cat` — M.Des CAT | 25–29 | `DESCRIPTIVE` |
| `nift-2012-mdes-written` — M.Des written | 30–47 | `MCQ` |
| `nift-2012-written-set3` — written booklet 3 | 49–66 | `MCQ` |
| `nift-2012-written-set4` — written booklet 4 | 68–86 | `MCQ` |
| `nift-2013-bdes-cat` — B.Des CAT | 1–6 | `DESCRIPTIVE` |
| `nift-2013-written-set1` — written booklet 1 | 7–21 | `MCQ` |
| `nift-2013-written-set2` — written booklet 2 | 24–41 | `MCQ` |
| `nift-2013-written-set3` — written booklet 3 | 44–61 | `MCQ` |
| `nift-2013-written-set4` — written booklet 4 | 64–81 | `MCQ` |
| `nift-2013-written-set5` — written booklet 5 | 84–101 | `MCQ` |
| `nift-2014-bdes-cat` — B.Des CAT | 1–6 | `DESCRIPTIVE` |
| `nift-2014-bdes-written` — B.Des written | 7–24 | `MCQ` |
| `nift-2014-mdes-cat` — M.Des CAT | 27–32 | `DESCRIPTIVE` |
| `nift-2014-mdes-written` — M.Des written | 33–53 | `MCQ` |

The standalone sample PDFs are imported as:

- `nift-bdes-cat-sample`
- `nift-bdes-written-sample`
- `nift-bft-written-sample`
- `nift-mdes-cat-sample`
- `nift-mdes-written-sample`
- `nift-mfm-written-sample`

No NIFT answer keys were supplied, so all NIFT answer fields remain pending.

## OCR for scanned papers

`tools/ocr_vision.swift` uses Apple Vision to recognize text and return JSON with normalized bounding boxes. The Python importer reconstructs reading order from those boxes, inserts row breaks at question markers, and renders each page at 170 DPI.

The helper is compiled on first use and cached at `server/data/.cache/ocr_vision`. It requires macOS with the Xcode command-line tools (`swiftc`). On other platforms the importer falls back to embedded text only, which is not sufficient for these NIFT scans.

The NIFT path also handles:

- numeric options written as `(1)`–`(4)` before the line-based parser runs;
- `Question No. N` markers and directions/page-code cleanup;
- OCR lines such as `05.` after question 104 being repaired to `105.`;
- `I5.` / `l5.` being repaired to `115.`;
- instruction pages resetting the question-number sequence so numbered instructions are not treated as questions.

OCR is a review aid, not a verification step. Some options remain outside the question block, especially:

- data-sufficiency questions whose `(1)`–`(4)` choices live in a directions block;
- assertion–reason questions with a shared option key;
- figure-based questions whose options are images;
- questions where OCR merged two prompts or dropped a number.

Page images are retained so these can be corrected in the review console. A few written papers also have fewer records than the nominal 150 because an OCR question marker was missed; for example, `nift-2014-bdes-written` currently has 141 records and `nift-bdes-written-sample` has 98 of its 100 questions.

## Type inference

When the paper states section ranges, the importer uses those ranges rather than guessing from option detection. This matters because many UCEED questions place their options inside images.

| Paper years | NAT | MSQ | MCQ | Part B |
|---|---:|---:|---:|---|
| 2015 | 1–20 | 21–50 | 51–100 | — |
| 2016 | 1–20 | 21–40 | 41–80 | — |
| 2017–2018 | 1–20 | 21–45 | 46–85 | — |
| 2019 | 1–20 | 21–40 | 41–85 | — |
| 2020–2023 | 1–18 | 19–36 | 37–68 | 1 drawing question |
| 2024–2026 | 1–14 | 15–29 | 30–57 | 2 drawing questions |

NIFT written papers use `MCQ` by default. NIFT CAT/drawing papers use `DESCRIPTIVE` and `--no-gap-fill`.

CEED papers state no "Questions X to Y belong to this section" ranges. The importer falls back to in-paper section headings ("Section II: MSQ", "PART A, Section II MULTIPLE SELECT QUESTIONS (MSQ)"): each section starts at the first question after its heading. `--type-map 1-8:NAT,9-18:MSQ,19-44:MCQ` overrides detection when a paper has no usable headings.

| CEED years | NAT | MSQ | MCQ | Part B |
|---|---:|---:|---:|---|
| 2015 | 1–5 | 6–15 | 16–50 | 4 mandatory + 4 optional |
| 2016 (both papers) | 1–10 | 11–20 | 21–50 | 3 mandatory + 4 optional |
| 2017, 2019 | 1–10 | 11–20 | 21–45 | 8 |
| 2018 | 1–8 | 9–16 | 17–41 | 8 |
| 2020–2023 | 1–8 | 9–18 | 19–41 | 5 |
| 2024–2026 | 1–8 | 9–18 | 19–44 | 5 |

Answer keys with `SECTION – I (NAT)` headings (CEED) are read like UCEED's `SECTION – A (NAT)`. Each section's numbering starts at its first listed question rather than at a fixed number.

## Deduplication

The importer deduplicates repeated items **inside one paper**. The content hash includes the paper id so the same question can be retained in multiple papers with separate page and provenance records. This keeps each paper complete; cross-paper duplicate analysis can be done later at mock-generation time if needed.

Items with the same wording but a **different question number** are kept as separate questions, for example three "Which option will replace the question mark?" items that differ only in their images. The earlier `uceed-2024` import dropped Q32, Q42, Q43, Q44, Q46 and Q56 this way. On 2026-10-28 they were added back without re-importing the paper, so the existing rows kept their answers and figures. They have official answers from `UCEED2024_Answer_Key.pdf` and figure crops made by `regenerate_visual_questions.crop_question`.

## What is missing

1. NIFT answer keys. None were supplied. CEED keys for 2010–2019 and 2026.
2. UCEED answer keys for 2015–2025.
3. Independent explanations for every question. The 2026 UCEED key gives answers, not explanations.
4. OCR review and option completion for the NIFT data-sufficiency, assertion–reason, and figure-based questions.
5. Visual review for image-only UCEED questions where extracted text is empty or only a placeholder, and crop review (`crop_review`) for every picture question. CEED and NID have no question crops yet.
6. Text options for MCQ/MSQ whose options are printed only inside the picture; these stay out of the bank even with an approved crop.
7. Topic/subtopic review. The current topic is a keyword-based first pass and should not be treated as final.
8. A reviewed bank of reference links. Do not add third-party links unless their use is permitted.

## Review workflow

1. Open `http://127.0.0.1:4174/admin.html`.
2. Use **Official question review** to filter by paper, type, status, or explanation state.
3. Open the page image for visual questions. For a question with a figure crop, the editor shows the crop: compare it with the page and set **Crop review** to `approved` or `rejected` (use the **Crop** filter to list `pending` crops). Only approved crops are served; the criteria are in `docs/PDF_QUESTION_REGENERATION.md` under "Crop review".
4. Correct the question text or options when OCR missed them. The editor writes back through `PATCH /api/official/questions/:id`.
5. Add an independently written explanation and mark it `verified`.
6. Keep the official answer key intact. If the key has alternatives such as `B,C or B,C,D`, preserve that in the answer field.
7. Never paste another site's explanation into the database. A reference URL is metadata, not a licence to copy.
8. Rebuild the lanes after a review session: `python3 tools/build_generic_question_bank.py` then `python3 tools/build_question_recovery_queue.py`.

## Publication lanes

`tools/build_generic_question_bank.py` reads this database and writes the candidate-facing lanes. A question reaches the ready bank (`generic-question-bank.json`) only with a usable prompt, at least two structured options for MCQ/MSQ, a trusted answer (`official-key`, `matched-source`, `matched-source-positional`, or `independently-solved`), and, if it depends on a picture, a crop with `crop_review = 'approved'` whose files exist. SVG reconstruction is optional and deferred. Picture questions with a pending crop wait in `question-recovery-queue.json` under `review-clean-crop`. The full rule is in `docs/PDF_QUESTION_REGENERATION.md`, "Publication lanes and answer confidence".

## Re-import example

```bash
python3 tools/ingest_official_pdf.py \
  --paper "/path/to/2013.pdf" \
  --exam nift \
  --year 2013 \
  --paper-id nift-2013-written-set4 \
  --title "NIFT 2013 written paper booklet 4" \
  --page-start 64 \
  --page-end 81 \
  --default-type MCQ \
  --no-gap-fill \
  --ocr \
  --image-format jpeg \
  --db server/data/dexam.sqlite \
  --media-root server/data/media \
  --replace \
  --json
```

## Local paths

```text
server/data/dexam.sqlite     SQLite question bank (ignored by Git)
server/data/media/           rendered page images (ignored by Git)
server/data/sources/         uploaded source PDFs (ignored by Git)
server/data/.cache/          compiled OCR helper and caches (ignored by Git)
```

Runtime `server/data/user-bank.json` and `server/data/mocks.json` are also ignored. The original static bank remains in `data.js` and `practice-*.js`.

## Export to dexam-platform (F038)

`python3 tools/export_platform_bank.py` writes `server/data/exports/dexam-bank-export.json` in the platform's schema v1. It exports every question; anything the generic-bank rules would hold back (crop awaiting review, missing options, image-only, and so on) travels as `holds`, and the platform quarantines on those plus its own checks. Import it from the platform repository with:

```bash
pnpm assessment:import --file "<this repo>/server/data/exports/dexam-bank-export.json" --media "<this repo>/server/data/media" --dry-run
```

Re-run the export and import after every crop review, answer-key update or correction. The import is idempotent: unchanged questions are skipped, and a changed question becomes a new version that replaces the old one for new attempts.
