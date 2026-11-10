# DMocks question-bank reconciliation

Audit date: 5 November 2026

The current canonical, media and compiler audit identifies 1,509 supported objective MVP records, 361 additional supported conversions and 712 conversion or context blockers. Hosted publication requires its separate review. [Bank conversion evidence](BANK_CONVERSION.md)

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

Build the exact import manifest without changing hosted state with `npm run bank:manifest --prefix apps/designmocks`. A hosted import requires the explicit `bank:import` command and the approved private bank target configuration. The database requires the canonical path and an explicitly empty `holds` array for each record. It records the Git commit and source hash and makes retries idempotent. Objective readiness, owner approval and paper publication are separate decisions. [Private bank target setup](MVP_DEPLOYMENT.md#select-the-private-bank-target)

The first asset-free adapter supported 161 objective records. Current runtime records require an administrator's content and rights review, and a changed canonical hash clears that approval. Records with unresolved figures, answer notation or missing keys stay unavailable for mocks.

## Local Exam app and workstation evidence

On 10 November, a read-only check of the local Exam app found all 4,521 current canonical keys with zero missing or unexpected keys. The latest completed local import on 4 November recorded the same raw export SHA-256 as the file on DMocks `origin/main` at `022ebfcdafed2f6ec763c13c8da0266a611168ca`. All 4,521 current per-question hashes match under the Exam app importer's own schema and hash function.

| Canonical selection | Exam app ready | Exam app quarantined |
| --- | ---: | ---: |
| Hold-free | 2,468 | 114 |
| Held | 0 | 1,939 |

The workstation SQLite database also contains 4,521 questions. Its export matches the Git file byte for byte. The workstation comparison accounts for 105 Part B identifier case aliases and found zero changed payloads when preserving frozen source PDF digests. The 105 workstation import runs had zero explicit Cloudboard or Claude labels. The independent manual-push manifest and current Exam app staging evidence are still pending.

The Exam app's per-question hash omits source identity and provenance. Its local whole-export digest corroborates the input file. DMocks stores a separate hash of each complete canonical question, including provenance. Compare hashes within their own contracts.

## Reconciliation gate

Before DMocks serves the bank:

1. Export the Cloudboard/Claude manual-push manifest with a stable source ID for each question. If none exists, create a one-time manifest from the source history.
2. Export the latest Exam-app `assessment_import_runs`, question external keys, versions, publication states and quarantine reasons from staging.
3. Compare all three sets by stable external key and content hash; never compare only counts.
4. Classify every difference as new, updated version, intentionally retired, quarantined or missing.
5. Import into DMocks only records whose `holds` array is present and empty through the idempotent DMocks bank importer.
6. Require zero unexplained IDs and a signed owner review of the ready/quarantined totals.

The existing Exam app remains the reference implementation and should be the migration source. DMocks should not create a second incompatible bank schema.

The offline comparison accepts `npm run bank:reconcile -- --canonical <bank-export.json> --snapshot <deployed-state.json> [--cloudboard <manual-push-manifest.json>]`. See the [snapshot example](DEPLOYED_BANK_SNAPSHOT.example.json) for the stable key, canonical question SHA-256 and state contract. An eligible question recorded only as retired counts as missing. Historical retired records excluded by the current source remain classified as retired. The report includes discrepancy keys and counts.

## Read-only DMocks target audit

From the DMocks app directory, provide `DMOCKS_BANK_AUDIT_DATABASE_URL` through the private environment for the intended loopback PostgreSQL database. Use the reviewed full commit for `DMOCKS_REVIEWED_BANK_COMMIT`.

```sh
npm run bank:reconcile-target -- --expect-source "$DMOCKS_REVIEWED_BANK_COMMIT"
```

The command reads the export from the pinned local `origin/main` ref and reads the target in one repeatable-read, read-only PostgreSQL session. It compares the last completed import's source digest, source and imported counts, exact key and hash membership, active records outside the canonical selection, and current local holds. An unfinished import also fails the comparison. The JSON report contains only counts, source and run metadata, and discrepancy keys. Exit 0 means the comparison passed, exit 2 means it found discrepancies, and exit 1 means it could not read or validate the inputs.

Use the existing approved standalone DMocks database and TLS requirements from [recovery setup](RECOVERY.md) for a hosted audit. Supply its CA path with `DMOCKS_BANK_AUDIT_DATABASE_CA_FILE` if required and use `--approved-hosted` after target approval. The report's `ready` state means a canonical runtime record has owner and rights approval. Media availability, paper release and student access have their own checks. Supply `--cloudboard <manual-push-manifest.json>` to compare an independently obtained manifest. The report shows `cloudboardTotal: null` when no manifest was supplied.
