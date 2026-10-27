# Original bank plan

This file tracks how the app gets from the starter bank to a large, exam-pattern-aligned practice bank. The target is roughly **1,600 original questions**, built in batches so quality stays high and each batch loads cleanly into the existing engine.

> Batch 1 and batch 2 are already in `practice-batch-1.js` and `practice-batch-2.js`.
> Batch 3 has started in `practice-batch-3.js`, and I'll keep filling batches in the same style. Send your own bank if you want the importer to take over.

## Why batches

1. Quality: new questions are designed against the **exam pattern and topic mixes** that are already in `exams.js`.
2. Coverage: each batch adds enough drills to cover every major topic for that exam, not just the easy ones.
3. Safety: no scraping, no copied text, and no third-party content. Everything here is original or user-owned.

## Batch structure

Each batch is a self-contained file that appends to `window.PRACTICE_BANK`.

| File | What it contains | Approx. new questions |
|---|---|---:|
| `practice-data.js` | Starter original drills (all four exams) | 29 |
| `practice-batch-1.js` | Batch 1 drills across UCEED, CEED, NIFT, NID | ~125 |
| `practice-batch-2.js` | Batch 2 drills, focused on UCEED/CEED | ~120 |
| `practice-batch-3.js` | Batch 3 drills, focused on NIFT/NID + archive | ~250 |
| `practice-batch-4.js` | Batch 4 drills, building full-topic depth | ~300 |
| `practice-batch-5.js` | Batch 5 drills, then paper-wise expansion | ~300 |
| `practice-batch-6.js` | Final polish, tags, and paper expansion | ~400 |

The final batch also gets woven into longer/minor mock papers so the timed-paper experience grows in parallel.

## Official-paper lane

The original bank and the official-paper workspace are separate on purpose:

| Lane | Source | Storage | Purpose |
|---|---|---|---|
| Original bank | Generated for this project | `practice-*.js` | Licence-clean practice and mock papers. |
| Official workspace | PDFs the user owns or is licensed to use | Local SQLite + page images | Extraction, answer-key matching, independent solution review, and future pattern analysis. |

The official lane uses `tools/ingest_official_pdf.py` and `server/data/dexam.sqlite`. It preserves page images for visual questions, stores provenance, and never fetches third-party solutions. The SQLite database, extracted page images, and uploaded source PDFs are ignored by Git.

The next quality step for that lane is explanation drafting and verification. A local Ollama model can produce a first draft, which is stored as `ai-draft`; a human or stronger reasoning pass must then compare it with the official answer key and mark it `verified`.

## What the app already has

- **4 exam tracks** with official patterns and topic weights
- **5 timed mini mocks** + **Part B studio**
- **A JSON importer** for user-owned or licensed banks
- **Official-paper extraction and review console** for owned/licensed PDFs
- **Progress, bookmarks, topic accuracy** and **review**

## What needs to happen next

1. **Send your own bank** (JSON/CSV) — the importer already handles it.
2. **Pick a first target exam** if you want deeper coverage on one track (UCEED is typically the biggest audience).
3. **Decide how much full-length testing** you want and whether to add server timing/scoring later.

## How to loader the bank

- Add one question to `window.PRACTICE_BANK` or a batch file.
- Use the helper convention in `practice-batch-1.js`.
- Run **`node tools/validate-data.js`** after editing to confirm unique IDs, valid answers, and totals.
