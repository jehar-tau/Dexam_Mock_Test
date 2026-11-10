# DMocks handoff to Claude

10 November 2026. The owner asked Codex to pause and transfer the work. The private repository is [jehar-tau/Dexam_Mock_Test](https://github.com/jehar-tau/Dexam_Mock_Test). The product in this handoff is DMocks at [dmocks.com](https://dmocks.com/). On the owner's Mac, the primary checkout is `/Users/snehalkumarshinde/Desktop/Projects/DesignMocks Codex/Dexam_Mock_Test`. The DMocks application is `apps/designmocks`. Its Supabase project, accounts, bank storage and merchant setup are separate from the legacy Dexam application.

## Exact prompt to give Claude

```text
Take over the DMocks launch goal in the private GitHub repository jehar-tau/Dexam_Mock_Test. Read docs/DMOCKS_CLAUDE_HANDOFF.md on handoff/dmocks-claude-2026-11-10, then fetch and start from current origin/main. Read apps/designmocks/AGENTS.md and the product plan and checklist it references.

Make DMocks launch-ready by executing the approved product plan end-to-end. Reconcile and operationalize the question bank. Build admin PDF and photo intake, review and promotion, and AI-assisted question drafting with human approval. Complete the student portal, exam mocks, All India events, topic practice, Learn, Community, question and bug reporting, Google onboarding, profiles, the paywall, drawing uploads, and human and AI-assisted review. Establish separate dev, staging and production infrastructure, security, testing, monitoring and deployment. Deliver private early testing first, then the frozen paid MVP, then the deferred features. Use the exact owner-approved first UCEED Part A paper after hosted Test acceptance.

Continue independently on authorized work. Start with the failing mobile accessibility check in PR #134. Work in small feature branches, preserve owner changes, and merge only after local and exact GitHub checks pass. Add unit, database authorization, and relevant desktop and mobile end-to-end coverage. Keep public registration, real content publication, model inference and Live sales closed until their separate approvals. Ask only for a required owner decision, final legal or policy review, private credentials or OTP, a paid service, or a production-impact action. Bring forward the decisions and evidence in the handoff. Keep an exact branch, CI, and hosted-state record for returning the work to Codex.
```

## Start here

1. Fetch the repository. Check the current main SHA, open PRs and exact CI before editing. As handed off, `origin/main` and the owner's local `main` are `2de7d8ed70714975bc498a07c988dcb1c35daea5` with tree `86ddac824310ce50403be8666f6a013dca736582`. PR #133 merged the reviewed migration-plan verifier. The first post-merge run timed out in two question-review browser tests. On a larger disposable runner, the exact same source passed 484 browser journeys with zero failures, skips or retries, plus the PostgreSQL suite. The native local Supabase dry run matched 25 installed and 52 pending migrations on the 77-migration source. [PR #133](https://github.com/jehar-tau/Dexam_Mock_Test/pull/133) · [Verified main CI](https://github.com/jehar-tau/Dexam_Mock_Test/actions/runs/42777700343/attempts/2)
2. Fix and verify [PR #134](https://github.com/jehar-tau/Dexam_Mock_Test/pull/134). Its exact head is `4ab0a1848968aae7a524225c854827cae88fb7c0`, tree `f2e02d226d97bc14dae58f7f44c0a30c7ab0ab64`. The 19 focused tests and verified 16-file staging archive passed locally. Disposable stock GoTrue and PostgREST passed on desktop Chromium and Pixel 7 with eight approved tester routes per viewport, outsider and wrong-host denial, and closed checkout. The archive SHA-256 is `60b2d18c3f5317b7b265963d9d5021f6c7b9c67b7341cd49236583f155a447b8`. GitHub CI had 483 passes and one mobile Axe color-contrast failure at width 320 in `tests/e2e/drawing-reviewer.spec.js:125` for `.quiet` and `.button[type="button"]:nth-child(2)`. Reproduce in both themes, check for a transition or a true contrast defect, and fix the cause with the assertion retained. The PR remains open and automatic merging was stopped. [Failed GitHub run](https://github.com/jehar-tau/Dexam_Mock_Test/actions/runs/42778057942)
3. After staging merges, integrate exact main into `feature/dmocks-checkout-artifact-pr` at `eea99b5abd4ea9dd1dc5b4838124a5c029f82226`, tree `5eb8e6ae1241faf569ca0fad95786f21b809cd93`. The 29 focused tests passed on its preceding identical tree. The exact checkout artifact built and verified with fictional settings. Rebuild after integration and rerun actual disposable GoTrue, PostgREST and Deno create-order acceptance with fictional Razorpay on desktop and mobile. Verify account and notice binding, outsider denial, pending order without a pass, audited expiry and closure. Earlier local acceptance exists. Hosted Test remains outstanding.
4. Integrate `feature/dmocks-guardian-pre-admission` at `dc6748f43d4cf291b1f49f6bc886cf03d15e14c6` when compatible with current main. Migration `202611100164_guardian_pre_admission.sql` adds a private pre-account approval keyed to verified Google subject. It requires a current adult or guardian decision and keeps the tester allowlist. It records an opaque proof reference and consent version without storing a birth date, documents or guardian contact. The full PostgreSQL 17 suite passed across 78 migrations with 51 SQL test calls, concurrency and both recovery round trips. Stock GoTrue v2.197.0 passed signed fictional Google ID-token and OAuth authorization-code paths. Denials left no account, and adult and guardian approvals each created one account across retries. The app has no live verifier or consent collection yet. Decide the real verification method, retention, revocation, treatment of existing accounts and who can agree to terms or pay for a minor before hosted admission. Do not bypass the gate using privileged account creation or manual identity linking.
5. The pushed `fix/dmocks-question-quality-ci` at `29a8fd38a76ecba202b25de0bb50dde25ba7036a` is an optional test-only candidate for the two 30-second outer test timeouts from PR #133's first main run. Baseline and patched versions each passed 20 focused desktop/mobile cases. The unchanged source subsequently passed exact main CI. This candidate is separate from the #134 contrast failure.
6. Preserve the older stacked source tips listed below. Some contain several previously reviewed features with different base commits. Compare each delta against current main and take a bounded slice at a time. Prioritize remaining paid MVP and controlled-hosting gates before post-launch features. Keep the user's untracked `tools/dmocks-execution-dashboard/` and the existing local servers intact.

## Available for early testing

- [Local student portal preview](http://127.0.0.1:4192/portal-preview) uses demo data and needs no real login. The [drawing upload preview](http://127.0.0.1:4192/drawing-uploads-preview) is separate.
- [Private UCEED paper review](http://127.0.0.1:4196/) presents the approved paper for inspection. It is a review build.
- [Public five-question sample](https://dmocks.com/sample) is signed-out and free. The owner explicitly approved public Site version 6 on 9 November. Its information pages and draft notices are published. Signup and checkout are closed in that build. Keep that publication independent of staging.

## Bank and the first paid offering

- Use `main:server/data/exports/dexam-bank-export.json` in this repository as the canonical import source. The owner-supplied snapshot contained 4,521 records and 2,582 with an explicitly empty `holds` array. Recount and hash the exact fetched export before importing. Absent, invalid or nonempty `holds` means ineligible. Never infer eligibility from reviewed status or clear flags in bulk.
- The owner says the supplied papers are adapted student recollections and authorizes use of the hold-free questions in DMocks. Preserve raw provenance and licence labels and the owner's statement. Release requires exact active approval, verified scoring/runtime and every required private figure. Keep content-rights review distinct from question correctness.
- Private source figures are on the owner's Mac under `~/Documents/Default Project/Dexam_Mock_Test/server/data/media`, about 7,615 files and 1.7 GB in the supplied inventory. The local `server/review-state.json`, `server/data/exports/review-split/` and `server/data/dexam.sqlite` are workstation evidence. The machine-readable full bank has additional NIFT drills outside the canonical export. Keep these artifacts private. Use the reviewed importer, private media manifest and per-record conversion and correction workflow. Continue the requested unavailable-record triage, admin usage visibility, verified NIFT materialization and authored NID blueprint and rubric work. Report actual counts and remaining reasons.
- The owner approved the **exact** UCEED Part A Practice Mock 01 questions, figures and answer key as the first paid offering after hosted Test acceptance. It has **57 questions, 120 minutes and 200 points**. The paper has already been rehearsed on a disposable backend with desktop/mobile, account isolation, offline recovery, scoring and immutable results. Do not substitute another paper or advertise full UCEED coverage. Import and verify only the exact approved manifest and private bytes on the approved target.
- The paid offer is **₹1,193 INR for 12 calendar months**, one payment with no automatic renewal, covering the explicitly published catalogue. Server-created orders are bound to account, amount, currency and mode. Only verified signed provider events grant or revoke the matching pass. Preserve duplicate protection, lost response recovery, valid remaining clock on reconnect, payment receipts and support, and existing attempt results after a full refund.

## Hosted and legal release gates

1. The deployment-target decision is already pending. The existing standalone Supabase project's dashboard labels the branch production while the app plan assigns it to staging. The public and retained preview hostnames have shared a Site. Confirm the exact target and separate private artifact/hostname before any hosted change. Read `supabase/project.json` and the provider guide. Capture an encrypted read-only ledger and database/private-media backup, prove restore in isolation, and verify the complete ordered migration plan with the native CLI dry run. Promote only the reviewed migrations, functions, origin config and matching deployment profile. Historical counts in the guides are checkpoints, not a current hosted inventory.
2. Controlled real Google login previously passed for the approved business tester on the local and owner-private hosted build, including callback/PKCE, reload, refresh, cancellation, sign-out and returning login. Recheck exact approved hosted origin, confirmed Google identity and server allowlist on the final private build. Keep `testers`, `test` and sales-closed settings, and reject signed-out and outsider access. Real guardian verification needs the separate approval workflow described above. The owner chose **verified parent or legal guardian consent before creating an under-18 account**.
3. The user authorized payment integration and reported KYC done. The recorded Razorpay dashboard checks show merchant activation and Test capture settings. Replace the previously exposed Test key pair, enter fresh secrets and webhook secret directly in the approved secret store, and complete any provider or OTP step with the owner. Run read-only CORS/anonymous/unsigned probes, then open only an expiring allowlisted Razorpay Test window. Perform real Google sign-in, notice acceptance, capture, signed webhook, one pass, exact paper, reconnect, submission/result, receipt/support, refund and revocation. Confirm delivery and closure. A fictional transport or a browser callback cannot clear this gate.
4. Operator and support facts were already provided in the Udyam certificate at `/Users/snehalkumarshinde/Downloads/Print _ Udyam Registration Certificate.pdf` and at `inquiry@designexam.com`. The public notices are visibly draft. Use the already extracted approved business details. Keep the certificate, PAN, banking and personal contact details private. Obtain final notice, privacy/retention, purchase, cancellation/refund, tax/invoice and minor consent decisions. The proposed voluntary policy was seven calendar days for a full change-of-mind refund while the first paid mock is unstarted, with approved refunds initiated within two business days. It remains a proposal. Handle duplicate charges and service problems separately.
5. Verify operational monitoring with the approved alert destination and actual delivery, incident and support handling, backup retention and recovery ownership. The initial expected load is 100–200 users and fewer than 100 concurrent sessions. The long-term ceiling is about 50,000 registered users over three to five years. Keep dev, staging and production independent, use no-cost infrastructure where adequate, and get approval before incurring costs.
6. Record explicit final go-live approval before changing public registration, publishing the real catalogue or enabling Live sales. Keep these switches separate. A staging merge or Test acceptance alone does not authorize public release.

## Wider product requirements after the first offering

- Student sidebar with Overview, exam-wise mocks, All India Mocks, topic practice, Learn and Community. Overview shows the student's attempts, progress, topic feedback and published ranks. Use the existing Dexam student flow as a reference. Take the clear Learn and Community sections and progress patterns from Chess.com. Use threaded, moderated question discussions inspired by Reddit or Quora.
- Exam-wise mocks assemble a randomized exam-appropriate paper from the verified bank. All India events use one identical fixed paper for all students in each NID, NIFT, UCEED or CEED event, one attempt per account, with a configurable entry window such as 10 days and a separate grading and release window of about 10 days. Publish top 10 only under the approved ranking and consent rules. Show private individual ranks on the exam overview.
- Topic practice offers 10, 20 or 30 questions and 15, 30 or 45 minutes. Public or free access should include the sample and the agreed free mock allowance. Multiple mocks, All India participation and topic practice are paid under the original plan. Free or limited Learn and Community access remains a product choice. Claude Design theory documents were to be supplied by the owner.
- Signup uses Google. Collect the student's name, verified phone, city, appearing year and selected exams at the appropriate approved step. Protect user and staff scopes independently. Keep answers saved by revision and queue them locally through connectivity failures. A server-owned clock continues across power or network failure. At expiry submit saved progress and prevent another All India attempt from that account.
- Support multiple private drawing images, deletion/replacement and a configured 10–15-minute upload-only grace for all-drawing papers. Scope assigned teachers to anonymous submissions. Freeze marking rubrics, record teacher marks, and allow human override of AI advice. Investigate a locally hosted image model only within approved consent, rights and cost limits. Keep inference and automatic grades closed until separately verified.
- Admin can intake PDFs/photos, extract into drafts, review and promote exact approved questions, and generate new drafts from verified basis questions. No automatic promotion. Students can report incomplete or incorrect questions in attempts. Count unique reporters, quarantine new delivery at the configured threshold such as five, and raise priority around ten. Preserve previous attempts and require human resolution. Admin can view bug reports, respond privately to the reporter and mark them fixed. Community has posts, images, comments, moderation and reporting. Keep private material and exam results protected.

## Checks, runbooks and local evidence

Read the app's [AGENTS.md](../apps/designmocks/AGENTS.md), [product execution plan](../apps/designmocks/docs/PRODUCT_EXECUTION_PLAN.md), [launch checklist](../apps/designmocks/docs/LAUNCH_CHECKLIST.md), [post-launch roadmap](../apps/designmocks/docs/POST_LAUNCH_ROADMAP.md), [verification log](../apps/designmocks/docs/VERIFICATION.md), [provider setup](../apps/designmocks/docs/PROVIDER_SETUP.md), [MVP deployment](../apps/designmocks/docs/MVP_DEPLOYMENT.md), [recovery](../apps/designmocks/docs/RECOVERY.md), [checkout acceptance](../apps/designmocks/docs/CHECKOUT_ACCEPTANCE.md), [operations runbook](../apps/designmocks/docs/OPERATIONS_RUNBOOK.md) and [bank conversion](../apps/designmocks/docs/BANK_CONVERSION.md). Use current main versions when they change.

From `apps/designmocks` use Node 24, `npm ci`, `npm run check`, and `DESIGNMOCKS_TEST_DATABASE_URL=<empty disposable PostgreSQL 17 on localhost> npm run test:database`. Add scoped unit and database authorization coverage and desktop/mobile browser cases for changed behavior. Keep negative authorization, reconnect, concurrency, retries, keyboard, mobile reflow and accessibility coverage. Verify the exact PR head/merge tree and the matching main run. Use the full browser scope for broad deferred modules as needed. Do not skip assertions, accept retries as proof, or use a hosted database for tests.

GitHub-hosted CI allowance was exhausted with a zero spend budget. The workflow supports an exact temporary runner label per reviewed PR head or main event. A one-job, private-repo runner in a disposable rootless Linux VM worked. The last successful exact main run used six guest CPUs and 6 GiB. Only one full browser suite should run at a time on this Mac. At handoff the temporary routing variable and ephemeral runners were removed and the base VM is stopped. If reusing the same Mac, inspect the owned scripts under `/private/tmp/dmocks-ci-runner.1WuxJP`; they are operational scratch, not a required dependency. Otherwise use an approved CI runner. Do not change billing without approval.

On the owner's Mac, the Git-ignored `.dmocks-local-evidence/latest-launch-checkpoint.json` and `.dmocks-local-evidence/ci-recovery-2026-11-10/` retain exact evidence. See also `first-uceed-paper-2026-11-08/`, `site-public-release-2026-11-09/`, `guardian-pre-admission-2026-11-10/gotrue-proof.json`, `staging-artifact-pr-2026-11-10/`, `drawing-removal-recovery-2026-11-10/`, `intake-source-retry-2026-11-10/` and `purchase-support-2026-11-10/` under that evidence directory. Treat workstation evidence and logs as private. The earlier staging and checkout fixture runners are scratch paths on this Mac and may expire. Reproduce from Git and the runbooks if needed.

## Transfer back to Codex

When Claude hands back the work, ask it for a short status record with the current main SHA, all pushed branches and open PRs, exact passing or failing CI URLs, local test results, environment actions taken, policy and paper decisions, remaining blockers and the next smallest safe slice. Include a fresh pointer to the branch inventory and report any uncommitted work or live test windows. Share references and sanitized evidence, never tokens or credentials.

Resume the existing paused goal in Codex when usage is available. Paste this instruction with Claude's status record and this handoff.

```text
Resume the existing DMocks launch goal. Read the Claude handoff and Claude's final status. Fetch current origin/main and inspect the exact PR and CI state before editing. Preserve all Claude and owner changes. Verify what was actually applied to each environment, close any expired Test window if already authorized, and continue from the next unfinished safe slice. Reuse existing decisions and ask only for the owner gates that still apply.
```

## Preserved source refs

The following unfinished and checkpoint source tips were pushed to the private repo. Handoff namespace branches preserve the exact source of older and stacked work. Their presence does not indicate a merge, hosted deployment or current CI acceptance. Use the bounded PR and feature branches above first.

| Remote branch | Exact commit |
| --- | --- |
| `feature/dmocks-checkout-artifact-pr` | `eea99b5abd4ea9dd1dc5b4838124a5c029f82226` |
| `feature/dmocks-guardian-pre-admission` | `dc6748f43d4cf291b1f49f6bc886cf03d15e14c6` |
| `fix/dmocks-question-quality-ci` | `29a8fd38a76ecba202b25de0bb50dde25ba7036a` |
| `handoff/dmocks-2026-11-10/codex/all-india-ranking-consent-db` | `d7370e6dbac9b26d5de4a94a19d6aa3a1f999a3b` |
| `handoff/dmocks-2026-11-10/codex/attempt-access-regressions` | `a5d65168db956fbf6edb8cf797e0c51d2f9c2d7d` |
| `handoff/dmocks-2026-11-10/codex/checkout-artifact-tests` | `3c710fb30bac6f2f26a18c2db22102017451fb81` |
| `handoff/dmocks-2026-11-10/codex/drawing-removal-receipt-tests` | `1fab4ff8e369513d88e86e9c848e1415c40a33d9` |
| `handoff/dmocks-2026-11-10/codex/intake-source-receipt-tests` | `01c4a090dcfec0c07a977743ac104bafd13e33d3` |
| `handoff/dmocks-2026-11-10/codex/launch-monitoring-db` | `1bea056d2b66ed2126b4a8a760a30952a826966a` |
| `handoff/dmocks-2026-11-10/codex/migration-plan-regressions` | `a301de8968daa10765ff079f46f6a88de6afcea1` |
| `handoff/dmocks-2026-11-10/codex/purchase-history-db` | `7fa64fdbc1847ab5c4ab08e70cd913305e40f74c` |
| `handoff/dmocks-2026-11-10/codex/purchase-history-integrated-db` | `b40c0f1961ca5c6a85277b0d10069ee13178096f` |
| `handoff/dmocks-2026-11-10/codex/purchase-support-db` | `296ced138417b5ec5a23034326c9dff9c859e2c1` |
| `handoff/dmocks-2026-11-10/codex/question-export-packet-db` | `9f9ee67fd50d4fe7979ec0ba82cca69417b32448` |
| `handoff/dmocks-2026-11-10/codex/staging-tracked-verifier` | `fc3efb64c69d53732c104e86452302133a1c2d71` |
| `handoff/dmocks-2026-11-10/dmocks/candidate-phone-status` | `f87db505bddc6a28ed515a361255c1ae633558e9` |
| `handoff/dmocks-2026-11-10/docs/dmocks-combined-paid-rehearsal` | `15cb7dd269d8dd3e3d4b7075862c865847085eb5` |
| `handoff/dmocks-2026-11-10/docs/dmocks-guardian-admission` | `152a3c315405674371a0f43224f2e9d64fcadeb0` |
| `handoff/dmocks-2026-11-10/docs/dmocks-public-release-v6` | `63dfb0f9331ef51e7bcf883727cc153b5185b9bb` |
| `handoff/dmocks-2026-11-10/docs/nonpayment-release` | `0c141c5badc28c8ab41986385240eaa190b07d37` |
| `handoff/dmocks-2026-11-10/feat/dmocks-phone-challenge-db` | `54ccebe050e325962ba1db018daf0ebd7d2c4ec1` |
| `handoff/dmocks-2026-11-10/feat/dmocks-phone-challenge-ui` | `42cc49cb73bb5fb42e0116428cc81cc9ab185d3c` |
| `handoff/dmocks-2026-11-10/feature/dmocks-all-india-ranking-consent` | `6918695f30d0e5a254848157954373954f2a9977` |
| `handoff/dmocks-2026-11-10/feature/dmocks-attempt-identity` | `d582a80d5d06f525cad8372733a649ec8714da2c` |
| `handoff/dmocks-2026-11-10/feature/dmocks-attempt-reply` | `859a2d146422e072e3181aedd91b751f08a0d796` |
| `handoff/dmocks-2026-11-10/feature/dmocks-backend-source-preflight` | `2d895dececa21584a893f4d97b6fbe762f308937` |
| `handoff/dmocks-2026-11-10/feature/dmocks-bank-target-reconciliation` | `da62cdcdfc66a908dba43959b2a2df453aefe2fe` |
| `handoff/dmocks-2026-11-10/feature/dmocks-checkout-artifact` | `5428e4eee3f828c60678b037cafe4e02a370e69a` |
| `handoff/dmocks-2026-11-10/feature/dmocks-configured-commerce-smoke` | `62c01149e287c176007ca1a6d0aea43c3b6b0f52` |
| `handoff/dmocks-2026-11-10/feature/dmocks-customer-purchase-history` | `129d02c5fff7e31436bac7341d887e59a390054c` |
| `handoff/dmocks-2026-11-10/feature/dmocks-drawing-removal-recovery` | `11e2f3136451f7a37fb69e466a2a6abbebb6a2d0` |
| `handoff/dmocks-2026-11-10/feature/dmocks-explicit-answer-alternatives` | `b55e1e921e4d6c740320562d3586d4d5c7b0926f` |
| `handoff/dmocks-2026-11-10/feature/dmocks-explicit-answers-compiler` | `eb9b87683031a82539b5214679dabb6a1d28e412` |
| `handoff/dmocks-2026-11-10/feature/dmocks-explicit-answers-db` | `98db1faed759daa9dd601d4060cbccb5d01e9b9e` |
| `handoff/dmocks-2026-11-10/feature/dmocks-intake-source-receipts` | `c8ec14bcf956b16baa5ebea161db651ffa656a8d` |
| `handoff/dmocks-2026-11-10/feature/dmocks-local-drawing-advice` | `48d2895cfd5dee8bbbf1a98e4bbec568557410ee` |
| `handoff/dmocks-2026-11-10/feature/dmocks-local-drawing-advice-db` | `b379a48dd0bc9c17ef684d41e43fa19cc4912c6c` |
| `handoff/dmocks-2026-11-10/feature/dmocks-ollama-drawing-model` | `415e763be66220e7b17d76571a7961792c7a09a9` |
| `handoff/dmocks-2026-11-10/feature/dmocks-operations-delivery` | `7c21945a450de85f2e73d8a834a8322bde171001` |
| `handoff/dmocks-2026-11-10/feature/dmocks-phone-verification-edge` | `6655b1e75f9208b198d02783e4c4085b0d0e6a96` |
| `handoff/dmocks-2026-11-10/feature/dmocks-purchase-support` | `6456116df4bb55e7b620d898c5228515cd057e0e` |
| `handoff/dmocks-2026-11-10/feature/dmocks-question-export-packet` | `64b7f876e530db1831be7dfb2eb677ecdc114253` |
| `handoff/dmocks-2026-11-10/feature/dmocks-question-model-auth-browser` | `3b0f3fb8c61c859da30b7dbc1b2a062fd4b25007` |
| `handoff/dmocks-2026-11-10/feature/dmocks-question-model-authorization` | `279a8d585aca5b6516a725c745a8bd948b66c140` |
| `handoff/dmocks-2026-11-10/feature/dmocks-question-model-authorization-db` | `912bf3c671b449f8597af97bc9dbb3ceccc03c42` |
| `handoff/dmocks-2026-11-10/feature/dmocks-release-migration-plan` | `0a978f196162137f8bf73bfd316c493642a9e54b` |
| `handoff/dmocks-2026-11-10/feature/dmocks-staging-artifact` | `dd7170e186dfe0f5deef7f07a463d5f4c51802bb` |
| `handoff/dmocks-2026-11-10/feature/dmocks-support-reference` | `6bac030ed300b90022dcbc379806e6fbbfc5865e` |
| `handoff/dmocks-2026-11-10/feature/question-export-operator` | `01cde12646e28400fe304d837915b6fb3948e168` |
| `handoff/dmocks-2026-11-10/fix/dev-portal-preview-navigation` | `6c38293c26a041d1ae2080478482f70fbe2c0cc0` |
| `handoff/dmocks-2026-11-10/fix/dmocks-account-purchase-consent` | `a3880261c5d079ccc0ae8f0b8958d896f0b3af4d` |
| `handoff/dmocks-2026-11-10/fix/dmocks-customer-notice-links` | `e825c582a649d28b2b8aeecf78b1f5379dd0c87e` |
| `handoff/dmocks-2026-11-10/fix/dmocks-expiry-clock` | `02372d4b01c470c112365f18e6d17b340efe426e` |
| `handoff/dmocks-2026-11-10/fix/dmocks-visible-choice-instructions` | `d956a2db8f4bbb87bb2f40421a388ae8d668ba67` |
| `handoff/dmocks-2026-11-10/fix/nid-revocation-ci-synchronization` | `ff69060407257e7f672c10a800f413348ad974b3` |
| `handoff/dmocks-2026-11-10/integration/dmocks-full-staging-rehearsal` | `aeef5ed28d49f499f179d8198bf35db906e814d1` |
| `handoff/dmocks-2026-11-10/integration/dmocks-purchase-history-rehearsal` | `80d697943bdd0e95d68d43c71e673b51cfb007dd` |
| `handoff/dmocks-2026-11-10/integration/dmocks-question-export-rehearsal` | `d08a26a052b031829e45d12b17998b3ebedc6558` |
| `handoff/dmocks-2026-11-10/test/all-india-ranking-consent` | `0858788756a90e3516909b79f60a36726a5d6518` |
| `handoff/dmocks-2026-11-10/test/dmocks-purchase-history-browser` | `c9d2d061fe9f060322e3071627a339c57cd91bfc` |
| `handoff/dmocks-2026-11-10/test/dmocks-question-export-browser` | `675ce86b8f1136de83642706cab799bddc52eb16` |
