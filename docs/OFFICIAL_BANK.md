# Official paper workspace

This is a local research lane for official question papers that the user owns or is licensed to use. It is deliberately separate from the original practice bank in `practice-*.js`.

## Current local import

The workspace currently contains the user's UCEED collection from 2015 to 2026:

- 12 papers
- 874 unique question records after cross-paper deduplication
- 57 answer-key matches in UCEED 2026
- 11 descriptive / Part B records across the later papers
- page images for every paper page
- 285 MB of local page images (not committed to Git)

The 2026 paper is the only one with an answer key in the supplied folder. The other papers have no official key in this workspace yet, so their answer fields remain pending.

## Type inference

When the paper states section ranges, the importer uses those ranges rather than guessing from option detection. This matters because many UCEED questions place their options inside images.

| Paper years | NAT | MSQ | MCQ | Part B |
|---|---:|---:|---:|---|
| 2015 | 1-20 | 21-50 | 51-100 | — |
| 2016 | 1-20 | 21-40 | 41-80 | — |
| 2017-2018 | 1-20 | 21-45 | 46-85 | — |
| 2019 | 1-20 | 21-40 | 41-85 | — |
| 2020-2023 | 1-18 | 19-36 | 37-68 | 1 drawing question |
| 2024-2026 | 1-14 | 15-29 | 30-57 | 2 drawing questions |

Individual papers can differ slightly; the importer parses the actual instructions where they are present and falls back to declared section counts.

## What is missing

1. Official answer keys for 2015-2025.
2. Independent explanations for every question. The 2026 key gives answers, not explanations.
3. Visual review for image-only questions, especially where the extracted text is empty or only a placeholder.
4. Topic/subtopic review. The current topic is a keyword-based first pass and should not be treated as final.
5. A reviewed bank of reference links. Do not add third-party links unless their use is permitted.

## Review workflow

1. Open `http://127.0.0.1:4174/admin.html`.
2. Use **Official question review** to filter by paper, type, status, or explanation state.
3. Open the page image for visual questions.
4. Add an independently written explanation and mark it `verified`.
5. Keep the official answer key intact. If the key has alternatives such as `B,C or B,C,D`, preserve that in the answer field.
6. Never paste another site's explanation into the database. A reference URL is metadata, not a licence to copy.

## Local paths

```text
server/data/dexam.sqlite     SQLite question bank (ignored by Git)
server/data/media/           rendered page images (ignored by Git)
server/data/sources/         uploaded source PDFs (ignored by Git)
```

The extractor and API are tracked; the user-supplied paper data is not.
