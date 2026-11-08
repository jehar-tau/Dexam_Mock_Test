# Private bank conversion and review

The canonical input remains `main:server/data/exports/dexam-bank-export.json`. Only an explicitly empty `holds` array is eligible. The owner's collection-level permission is recorded; raw source labels and per-version review history are preserved.

## Administrator preview

The bank inspector shows the intended exam/section, response type, marking and clock alongside the complete private question, answers and figures. An unconverted record is explicitly labelled **proposed**. Previewing does not publish a paper, start an attempt, create an upload or materialize a question.

The checklist calls out unsupported NID/CAT contexts, missing or pending keys, four unique text-labelled choices, required private figures and the separate runtime-materialization step. It keeps inactive/held/missing-media problems visible even for an earlier converted record. This is review guidance, not a replacement for the stricter server/operator compiler. The exact-version approval API remains authoritative. Unconverted records cannot be approved; required figures must be opened successfully before the UI offers approval. Rights confirmation alone never converts or publishes content.

## Reproducible local baseline — 8 November 2026

The read-only audit verifies the canonical export at accepted main `d91d3900726a3d705da30f7fa282744e533c72f0`, source SHA-256 `dd7702650b6e8ffeb348d0b558ecdd2bfbc1e565f2a392536518a3cebc8962be`, and all 2,085 eligible referenced PNGs. It runs the existing runtime compiler with that verified private media catalogue; it does not infer answer keys or change holds/approvals.

| Exam | Eligible | MVP objective scope | Other code-convertible | Needs conversion/context work |
| --- | ---: | ---: | ---: | ---: |
| UCEED | 865 | 830 | 10 | 25 |
| CEED | 782 | 672 | 99 | 11 |
| NIFT | 298 | 0 | 252 | 46 |
| NID | 637 | 0 | 0 | 637 |
| Total | 2,582 | 1,502 | 361 | 719 |

The earlier description of 1,080 records as unavailable to the objective MVP combines **361 supported conversions outside that offering** (252 NIFT B.Des. GAT MCQs and 109 UCEED/CEED drawing tasks) with **719 genuine conversion/context blockers**. Code convertibility is not hosted readiness, permission to broaden the first paid offer or approval to publish. The initial paid candidate remains UCEED Part A.

Private source keys, per-record hashes, local media checks and the baseline scripts remain in ignored `.dmocks-local-evidence/bank-conversion-2026-11-08/`. Do not commit real prompts, answers, generated runtime plans or images. Extra machine-readable NIFT drills outside the canonical export are excluded.

The structured diagnostics and local NIFT materialization rehearsal below are implemented. Remaining work is the authorized hosted reconciliation/materialization and explicitly authored/reviewed NID practice blueprint/task-rubric support. Unknown answers and unverified official rules remain explicit blockers. No direct mass approval or guessed key/rubric is permitted.

## Structured correction queue

`bank:diagnostics` is a read-only operator command. It verifies local canonical PNG bytes before running the same evaluator used by the runtime materializer. It emits aggregate counts only; an optional private JSON report contains stable keys, exact source hashes, diagnostic codes/locations, corrective actions and scope classification. It contains no prompts, options, answer keys or runtime payloads. A report records source, rule, media, runtime-plan and report digests so a later correction cannot silently reuse an older result.

```bash
mkdir -p private-import
npm run bank:diagnostics -- --ref origin/main --media-root "$DMOCKS_MEDIA_ROOT" --output private-import/conversion-queue.private.json
```

Set `DMOCKS_MEDIA_ROOT` to the owner's read-only canonical image folder. Output creation is exclusive with private permissions: existing reports, tracked/unignored repository paths, public/source/build directories, Git internals and public-directory symlinks are rejected. Choose a new private filename for a later run. The command has no apply/approval/provider-write option and never infers an answer or a numerical tolerance.

The current queue contains 719 distinct records. Overlapping issue occurrences are: 637 unverified contexts, 333 missing drawing figures, 185 missing required visual assets, 44 missing keys, 34 unsupported key notations, 23 pending keys, 10 unmodelled sections, eight option-count problems and three option-label problems. These counts overlap and must not be summed as questions. A source problem is corrected and reviewed in the canonical bank; its new hash then goes through import, media verification, materialization and exact-version review. Existing admin **Request correction** records the human decision; this read-only report does not masquerade as a saved or completed correction.

All 2,582 real canonical runtime outputs, including their keys, media and marking, compare byte-for-byte in stable JSON with the prior compiler. The refactor adds diagnostics without making a previously blocked question usable or changing an existing conversion.

## NIFT materialization rehearsal

An owned disposable localhost Supabase fixture imported the exact 2,582-question canonical manifest and privately uploaded/download-verified all **134 NIFT-referenced figures / 29,742,800 bytes**. The existing guarded production materializer ran through a localhost-only transport adapter and actual service-only database APIs: **252 of 298 NIFT records materialized; 46 remain explicitly unavailable**. Every saved runtime payload matches its compiled source/hash/context. Replaying the materializer and the canonical importer preserves the conversions. Anonymous, student and admin writes, stale hashes and incorrect marking are rejected. Real admin search returns the same 252/46 split and verified media metadata.

The rehearsal changes no canonical payload/hold, approval flag, released paper or attempt. All owner/rights approvals remain false. It is local materialization proof, not hosted promotion or expansion of the first paid offering. The owned stack, volumes, keys and temporary provider files are removed after verification; credential-free evidence remains ignored.

## NID context boundary

The [official 2027–28 Integrated Pathway/B.Des. handbook](https://admissions.nid.edu/NIDA2027/download/BDES_IntegratedPathway_AdmissionsHandbook2027_28.pdf), printed pages 27 and 35 (PDF pages 32 and 40), confirms an English paper-and-pencil/pen Prelims using text and visuals. It puts the duration on the admit card and says assessment criteria/mark breakdown are not shared. It therefore does not establish a fixed question count, clock, per-question marking or official drawing rubric for this compiler. Those values must not be borrowed from UCEED/NIFT or guessed.

A future NID practice context needs an explicitly authored, reviewed practice blueprint and task rubric, clearly distinguished from official NID scoring; an official-format claim additionally needs an adequate current authoritative source. The 637 eligible NID records remain in the correction/context queue. Their source rights are already resolved and must not be asked again. Source facts were verified by text and rendered-page inspection; the private evidence records the handbook hash.

## Verification

The preview slice passes 344 JavaScript tests, four Python fixtures, eleven server-function type checks, build/isolation, zero production dependency findings and all 370 selected desktop/mobile journeys without failures, skips or retries. Its twelve bank-review journeys are now part of the default MVP browser gate; previously they were excluded from that gate. All 72 migrations plus the unchanged companion paid-MVP profile pass 44 database authorization suites.

An independent disposable localhost Supabase fixture uses fictional questions/actors and real Auth, PostgREST, private Storage, Edge and the actual SDK. API checks deny anonymous/student bank reads, unconverted approval and stale-version inspection. Desktop/mobile checks open a real private figure, save exact-version approval, explain proposed NID/NIFT usage, keep unconverted approval disabled, clear previews on SDK sign-out and deny a student account. Keyboard, WCAG and 320px reflow pass. No paper is published or attempt started; real Google/Razorpay and hosted acceptance are not claimed. Fixture readiness/selector corrections are retained in private evidence. Feature/main CI and matching-tree acceptance remain required for delivery.

The operator-diagnostics follow-up passes 350 JavaScript tests, all 370 selected desktop/mobile journeys without failures/skips/retries and the same Python/type/build/isolation/audit/72-migration/44-suite gates. Six new units cover independent diagnostic causes, exact numeric/context preservation, metadata-only report contents, changed/held-source rejection and private output boundaries including tracked files and symlink escapes. The real canonical parity/CLI checks and local NIFT API rehearsal above exercise the operator flow end to end. No new public UI or database grant/migration is added.
