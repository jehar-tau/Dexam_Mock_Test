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

Next work is structured per-record compiler diagnostics/correction queues, verified NIFT materialization and verified NID delivery/rubric support. Unknown answers and unverified official rules must remain explicit blockers. No direct mass approval or guessed key/rubric is permitted.

## Verification

The preview slice passes 344 JavaScript tests, four Python fixtures, eleven server-function type checks, build/isolation, zero production dependency findings and all 370 selected desktop/mobile journeys without failures, skips or retries. Its twelve bank-review journeys are now part of the default MVP browser gate; previously they were excluded from that gate. All 72 migrations plus the unchanged companion paid-MVP profile pass 44 database authorization suites.

An independent disposable localhost Supabase fixture uses fictional questions/actors and real Auth, PostgREST, private Storage, Edge and the actual SDK. API checks deny anonymous/student bank reads, unconverted approval and stale-version inspection. Desktop/mobile checks open a real private figure, save exact-version approval, explain proposed NID/NIFT usage, keep unconverted approval disabled, clear previews on SDK sign-out and deny a student account. Keyboard, WCAG and 320px reflow pass. No paper is published or attempt started; real Google/Razorpay and hosted acceptance are not claimed. Fixture readiness/selector corrections are retained in private evidence. Feature/main CI and matching-tree acceptance remain required for delivery.
