# Free year-wise Papers: preparation and review

Year-wise Papers are free. Students browse the public catalogue and sign in to save a timed attempt; no annual pass is required. This release path does not open public registration or paid checkout.

The public frontend can list released free papers before Google admission opens.
Set `VITE_PUBLIC_CATALOG_ENABLED=true` only with the designated DMocks Supabase
URL and a publishable/anon browser key. This enables the anonymous
`free_year_paper_catalog` read and does not enable sign-in, starts, checkout or
sales. An unconfigured public build continues to show the source-backed sets
as in preparation; verify the live catalogue after a paper is registered.

The fixed paper must use every eligible objective question in one `exam + sourcePaperId + year` group from `main:server/data/exports/dexam-bank-export.json`. Questions with a nonempty `holds` list and drawing or descriptive items cannot enter the objective paper. The source bank rows must be current, owner approved, rights confirmed and converted to runtime questions. Referenced figures must exist in the private `paper-media` bucket. A written worked explanation and the historical marking for each objective question are reviewed separately from the general 2027 mock rules.

The [official UCEED 2024](https://www.uceed.iitb.ac.in/2024/assets/downloads/qps/UCEED_2024_Question_Paper.pdf), [2025](https://www.uceed.iitb.ac.in/2025/assets/downloads/qps/UCEED_2025_Question_Paper.pdf) and [2026](https://www.uceed.iitb.ac.in/2026/assets/downloads/qps/UCEED_2026_Question_Paper.pdf) papers each specify **57 Part A questions**. The preparation and release checks enforce that count for those years. Claude's approved PR #336 added UCEED 2025 Q36 to the canonical export on 24 November 2026; the private figure was uploaded and byte-verified separately.

Use a **private JSON plan outside the repository** with `format: "dmocks-free-year-paper-v1"`, `exam`, `year`, `sourcePaperId`, `partLabel`, `title`, `durationSeconds`, a `markingReference` pointing to that year's instructions, and `questions` in the paper's exact order. Each question entry has `externalKey`, current `contentSha256`, historical `marking` (`correct` and `wrong`), and its reviewed `explanation`. The CLI and database reject an incomplete source group, stale bank hash, duplicate, missing explanation or invalid mark. Keep the plan and solution evidence private.

From `apps/designmocks`:

1. `npm run papers:prepare-free -- --plan /private/path/year-paper.json --digest` checks the plan against `origin/main` and prints only its SHA-256 and metadata.
2. Review the exact plan, figures, historical marks, answer keys and worked explanations. Record the printed plan SHA-256.
3. With the private DMocks server environment loaded, run `npm run papers:prepare-free -- --plan /private/path/year-paper.json --expect PLAN_SHA256 --apply`. It creates a fixed but student-hidden paper and prints its `paperId` and `manifestSha256`. An exact retry returns that same paper.
4. Review the prepared paper and its manifest SHA-256 in staging. Only after owner approval, run `npm run papers:prepare-free -- --plan /private/path/year-paper.json --expect PLAN_SHA256 --release --review-manifest MANIFEST_SHA256` against the approved target. This second call registers the exact fixed paper; any changed content, key, marking, explanation, bank version or missing private figure blocks release.

The operator config uses `DMOCKS_SUPABASE_URL`, `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, `DMOCKS_PAPER_ALLOW_ORIGIN`, `DMOCKS_PAPER_ENVIRONMENT`, and for production `DMOCKS_PAPER_PRODUCTION_ACK`. Use the separate `PREPARE_FREE_YEAR_PAPER_ON_ORIGIN` and `RELEASE_FREE_YEAR_PAPER_ON_ORIGIN` acknowledgements for their respective production commands. Do not place credentials or real plans in the repository or chat.

On the designated private Test project while its operational health reports
`apiProfileReady: false`, the paper command also needs the existing expanded
staging bank audit: `DMOCKS_BANK_PROFILE=expanded-staging`,
`DMOCKS_BANK_AUDIT_DATABASE_URL` and `DMOCKS_BANK_AUDIT_DATABASE_CA_FILE`.
The server checks closed Test settings, restricted admission, disabled Test
checkout, current grant drift and service-only bank RPCs before preparation.
These variables do not bypass the exact paper origin or environment checks.

The `/papers` catalogue remains in preparation until step 4 succeeds. The existing attempt room then freezes the timer and answers, and shows worked explanations only after submission. The paid mock catalogue stays separate.

The owner confirmed on 24 November 2026 that CEED 2021 Q7 and Q8 accept the
entire ranges explicitly printed in parentheses in their keys. The verified
IIT objective converter preserves those exact decimal bounds. A canonical
`FULL MARKS` key awards every candidate the question's historical marks,
including an unanswered attempt; the server accepts this key only when the
current hold-free source explicitly says `FULL MARKS`. These conversion rules
do not substitute for the per-paper manifest and figure review.

NID historic year papers use their own private release plan as the clock and
per-question marking source. After Claude supplies a reviewed plan, run
`npm run runtime:nid-year -- --plan /private/path/plan.json --expect PLAN_SHA256`
to check its exact source group, then add `--apply` to register objective MCQ
runtime with the service-only writer. This accepts only the stored answer,
including explicit `X or Y` options, and does not invent partial credit for
second-best options. Descriptive tasks remain outside this objective runtime.
The NID paper still needs the separate owner-reviewed release steps above;
runtime materialization alone never lists it to students.
