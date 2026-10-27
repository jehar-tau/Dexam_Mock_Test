# Official paper workspace

This is a local research lane for official question papers that the user owns or is licensed to use. It is deliberately separate from the original practice bank in `practice-*.js`.

The extractor, schema, OCR helper, and review console are tracked in Git. The extracted papers, page images, source PDFs, SQLite database, and compiled OCR cache are local-only.

## Current local archive

The workspace currently contains **34 paper records and 2,992 question records**:

| Group | Papers | Questions | Notes |
|---|---:|---:|---|
| UCEED 2015–2026 | 12 | 874 | 57 answer-key matches from the 2026 key |
| NIFT 2012–2014 + samples | 22 | 2,118 | scanned OCR; no answer keys supplied |
| **Total** | **34** | **2,992** | 32 descriptive records, 57 answered records |

All papers have rendered page images. NIFT uses JPEG page images; UCEED uses PNG. The local media directory is about **417 MB**.

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

## Deduplication

The importer deduplicates repeated items **inside one paper**. The content hash includes the paper id so the same question can be retained in multiple papers with separate page and provenance records. This keeps each paper complete; cross-paper duplicate analysis can be done later at mock-generation time if needed.

## What is missing

1. NIFT answer keys. None were supplied.
2. UCEED answer keys for 2015–2025.
3. Independent explanations for every question. The 2026 UCEED key gives answers, not explanations.
4. OCR review and option completion for the NIFT data-sufficiency, assertion–reason, and figure-based questions.
5. Visual review for image-only UCEED questions where extracted text is empty or only a placeholder.
6. Topic/subtopic review. The current topic is a keyword-based first pass and should not be treated as final.
7. A reviewed bank of reference links. Do not add third-party links unless their use is permitted.

## Review workflow

1. Open `http://127.0.0.1:4174/admin.html`.
2. Use **Official question review** to filter by paper, type, status, or explanation state.
3. Open the page image for visual questions.
4. Correct the question text or options when OCR missed them. The editor writes back through `PATCH /api/official/questions/:id`.
5. Add an independently written explanation and mark it `verified`.
6. Keep the official answer key intact. If the key has alternatives such as `B,C or B,C,D`, preserve that in the answer field.
7. Never paste another site's explanation into the database. A reference URL is metadata, not a licence to copy.

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
