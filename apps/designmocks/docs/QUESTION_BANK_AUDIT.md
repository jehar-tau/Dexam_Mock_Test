# DMocks question-bank reconciliation

Audit date: 5 November 2026

## What is proven

The `main` branch contains three independently consumable representations. Only the platform export is authoritative for DMocks:

| Representation | Questions |
| --- | ---: |
| `dexam-bank-machine-readable.json` | 4,737 |
| `server/data/exports/dexam-bank-export.json` | 4,521 |
| `server/data/exports/dexam-review.json` | 4,521 |

The authoritative export totals are UCEED 880, CEED 834, NIFT 2,118 and NID 689. The machine-readable representation currently has 216 additional NIFT original-batch records that are absent from both exports; the audit reports this drift but does not silently treat those records as eligible. There are also 105 Part B key case differences (`qB` versus `qb`) between the older representations. The review export marks 290 questions as owner-provided. None of the exports identifies “Cloudboard” or a Cloudboard push ID, so the repository cannot prove that every manually tested Cloudboard item is present without a source manifest from that workflow.

The authoritative source is the `main` branch of `https://github.com/jehar-tau/Dexam_Mock_Test.git`, file `server/data/exports/dexam-bank-export.json`. The only DMocks eligibility rule is `question.holds.length === 0`. Missing, malformed or non-array `holds` values fail closed. DMocks must not recreate eligibility from crop state, answer status or any other field.

Remote `main` commit `bbebb417c602df79ec1ad3aeb08dcbcf77b2af21` contains 2,582 eligible questions and 1,939 held questions:

| Exam | Total | Eligible (`holds=[]`) | Excluded |
| --- | ---: | ---: | ---: |
| UCEED | 880 | 865 | 15 |
| CEED | 834 | 782 | 52 |
| NID | 689 | 637 | 52 |
| NIFT | 2,118 | 298 | 1,820 |
| **Total** | **4,521** | **2,582** | **1,939** |

Hold reasons overlap, so their counts do not sum to 1,939. The largest are `awaiting-owner-review` 1,350, `structured-options-missing` 839 and `owner-flagged` 572. A hold-free record is an import candidate, not automatically a published question; the importer must still validate schema, stable ID, content hash, licence and referenced media.

Run the reproducible audit with:

```bash
npm run audit:bank
```

## What is not yet proven

The Dexam Exam app's last authoritative state record says 4,183 questions were imported and 695 were student-ready. That snapshot is older than the current 4,521-question export. Therefore:

- 338 current workstation questions are not accounted for in the recorded app import;
- readiness cannot be inferred from workstation holds alone because the app importer also applies licence, media, option, answer and provenance gates;
- no current import-run export or database query has been captured to prove the exact deployed/staging state;
- “all manually tested Cloudboard questions are in the app” remains unverified.

## Reconciliation gate

Before DMocks serves the bank:

1. Export the Cloudboard/Claude manual-push manifest with a stable source ID for each question. If none exists, create a one-time manifest from the source history.
2. Export the latest Exam-app `assessment_import_runs`, question external keys, versions, publication states and quarantine reasons from staging.
3. Compare all three sets by stable external key and content hash; never compare only counts.
4. Classify every difference as new, updated version, intentionally retired, quarantined or missing.
5. Import only records whose `holds` array is present and empty, through the existing idempotent Exam-app importer; do not copy rows manually.
6. Require zero unexplained IDs and a signed owner review of the ready/quarantined totals.

The existing Exam app remains the reference implementation and should be the migration source. DMocks should not create a second incompatible bank schema.
