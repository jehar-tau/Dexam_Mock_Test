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

Add `--runtime-media-root "$DMOCKS_CANONICAL_MEDIA_ROOT"` to compare the exact stored runtime payloads and objective-readiness flags for active canonical questions outside quarantine. The audit verifies the canonical source PNGs locally, compiles the same runtime plan as the materializer, and compares PostgreSQL JSONB fingerprints. It checks NID payloads against the current authored practice bindings in the target. Unbound NID records and records that cannot be converted are counted separately. A missing, unexpected or different runtime makes the audit fail. The report includes discrepancy keys and counts.

When using this option with `--approved-hosted`, set `DMOCKS_BANK_HASH_DATABASE_URL` to a disposable loopback PostgreSQL 17 database. The source runtime payloads are sent only to that local database. The hosted query is read-only and returns fingerprint and status metadata. This check still requires separate verification of hosted Storage bytes and student access.

The read-only staging observation at source commit `a6b1d37369336e097587fb53c2f7eee14305a40a` matched the exact compiled fingerprints and objective flags for 865 UCEED, 782 CEED and 298 NIFT active records. Of those, 856 UCEED, 775 CEED and 252 NIFT had materialized payloads. The 637 active NID records were unbound and had no runtime payload. This observation precedes student-facing acceptance.

On 14 November, the read-only staging comparison against canonical `main` at `4269820291e187dd53c7153a5e6ffdd046bdefeb` found all 2,582 eligible keys and content hashes in the completed import, with zero missing, changed or unexpected active records. The runtime check validated all 2,085 referenced source assets locally and matched 1,883 materialized UCEED, CEED and NIFT payloads and their objective flags. The other 62 records in those exams were unavailable as expected. All 637 active NID records had no stored runtime payload. The read-only management role could not run the private NID binding helper, so this run establishes stored-payload absence only for NID. The independent Cloudboard manifest and student delivery checks remain open. Hosted Storage byte verification is recorded below.

The 2,085 locally verified images match the hosted private `paper-media` catalogue by content-addressed path, registered dimensions, PNG type, byte count and recorded digest. The catalogue contained no extra registered images. On 14 November an authenticated read-only Storage audit downloaded every object and verified all 273,263,304 bytes against the canonical SHA-256 hashes, lengths and PNG dimensions, with zero discrepancies. The encrypted database and Storage backup and its isolated restore remain pending.
