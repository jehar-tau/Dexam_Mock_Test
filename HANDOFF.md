# DesignMocks Agent Handoff

This file is the durable handoff between Codex, Claude Code, and future coding-agent sessions. Read it before making changes, then inspect the live repository state because this document may lag behind the working tree.

## Working directories

- Repository root: `/Users/snehalkumarshinde/Desktop/Projects/DesignMocks Codex/Dexam_Mock_Test`
- DesignMocks app: `/Users/snehalkumarshinde/Desktop/Projects/DesignMocks Codex/Dexam_Mock_Test/apps/designmocks`
- Start agents from the repository root so they can see repository-wide instructions, history, and changes.

## Goal

Continue building and validating the independent DesignMocks (`DMocks`) website and student portal described in `apps/designmocks/README.md`, while preserving its security, privacy, product, and launch constraints.

The approved product direction is an original Discovery-style experience using the paper/forest/orange palette, Figtree and Zilla Slab, geometric SVG artwork, readable typography, and complete light/dark modes. The approved offer is ₹1,193 for one year, paid once, with no automatic renewal.

Treat `apps/designmocks/README.md` and its linked launch, provider, verification, operations, and product-decision documents as the current source of truth for completed work and remaining launch gates. Do not infer that locally implemented functionality is production-approved.

## Mandatory constraints

Before editing, read:

1. `apps/designmocks/AGENTS.md`
2. `apps/designmocks/README.md`
3. The documentation relevant to the requested task

In particular:

- DesignMocks is separate from Dexam student accounts, fixtures, payment credentials, and private data.
- Keep public registration, real sales, and paid access fail-closed until the separately documented provider and server acceptance work is complete.
- Never grant paid access from browser storage or a Razorpay success callback. Only a verified server event may grant access.
- Razorpay integration is deferred; checkout must remain disabled until the owner explicitly resumes it.
- Do not expose or commit credentials, personal student data, the reviewed question bank, private images, generated runtime plans, or ignored environment files.
- Do not put service-role keys, Google client secrets, or Razorpay secrets in Vite variables, source code, shell arguments, chat, or this file.
- Do not blindly apply migrations or provider operations. Use the explicit standalone project and follow the provider documentation.
- Preserve unrelated existing changes and reference work outside public assets.

## Resume procedure

At the beginning of every Codex or Claude Code session:

1. Run `git status --short --branch` and inspect `git diff` plus `git diff --cached`.
2. Read recent commits with `git log -10 --oneline --decorate`.
3. Read this file, `apps/designmocks/AGENTS.md`, and `apps/designmocks/README.md`.
4. Identify the user's latest requested outcome. Do not invent a new launch scope from the general project description.
5. Inspect the implementation and relevant docs before changing code.
6. Preserve existing work, then implement and verify the requested outcome.
7. Update this file only when the durable goal, constraints, run instructions, or meaningful pending work changes.

Suggested agent prompt:

> Continue the DesignMocks work from the current repository state. Read `HANDOFF.md`, `apps/designmocks/AGENTS.md`, and `apps/designmocks/README.md`; inspect Git status, diffs, and recent commits; preserve existing changes; then pursue the latest requested outcome through implementation and appropriate verification. Keep registration, checkout, paid access, secrets, private data, provider promotion, and deployment fail-closed unless the owner explicitly authorizes the relevant step.

## Run and verify

From the repository root:

```bash
npm run designmocks:install
npm run designmocks:dev
```

The local website is at `http://127.0.0.1:4190/`; the development-only portal preview is at `http://127.0.0.1:4190/portal-preview`.

From `apps/designmocks`:

```bash
npm ci
npm run dev
npm run build
npm run check
```

`npm run test:database` needs an empty, disposable localhost PostgreSQL 17 in `DESIGNMOCKS_TEST_DATABASE_URL`. CI provides one; locally, a throwaway `postgres:17` Docker container works. Copy both `tests/` and the whole `supabase/` folder into it, because the suite also runs `supabase/tests/controlled_signup.sql`.

Choose verification proportional to the change. The complete `npm run check` includes unit, readiness, build, isolation, server-type, and Playwright checks and may take substantially longer than a focused check. Follow `apps/designmocks/README.md` for database, hosted-provider, accessibility, and private-media procedures; never point destructive or bootstrap checks at a real provider database.

## Current durable status

As of 8 November 2026:

- Sequential UCEED/CEED Part A → Part B sessions (PR #53), the combined exam report (#54) and audited launch-readiness gates (#55) are merged to `main`.
- NIFT 2027 B.Des. GAT (100 MCQ, 120 minutes, +1/−0.25) is merged in PR #56. Its blueprint stays unreleased. The NIFT CAT, B.F.Tech. Section B, other NIFT programmes and NID are not modelled.
- Any runtime write resets a bank question's `owner_approved` and `rights_confirmed` (`dm_private.reset_bank_review_on_change`), so freshly materialized questions need `admin_review_bank_question` again before a blueprint counts them.
- The app includes the public catalogue/offer experience, timed sample, protected workspace foundations, reporting/moderation/operations work, and server-side payment/provider foundations described in the README.
- Controlled Google login and the private canonical bank/image import have documented acceptance, but later local provider migrations and capabilities still require deliberate staging promotion and representative hosted acceptance.
- Public registration, the released portal, sales, and checkout remain closed.
- Razorpay remains explicitly deferred.
- Remaining launch work and owner decisions are tracked in the app documentation; read those files instead of treating this summary as exhaustive.

## Ending a session

Before switching agents or pausing for quota reset:

1. Leave the working tree in a coherent state; do not discard another agent's changes.
2. Run the most relevant verification available and record failures honestly.
3. Update the section below with the exact latest request, completed work, files changed, checks run, failures, and next action.
4. Prefer a normal commit when the work is complete and the user has requested or approved committing. Otherwise leave a clear diff for the next agent.

## Latest session checkpoint

- PR #56 merged the NIFT 2027 B.Des. GAT contract in `74a81fd`. Offline compilation produced 155 of 298 eligible NIFT records. Hosted materialization, replay, rights review and blueprint release are pending.
- PR #57 bound drawing uploads to the authenticated student and added versioned teacher claims, grading and audited overrides. PR #58 linked that workflow to fixed All India drawing windows and combined cohort results. Both merged after GitHub CI.
- PR #59 added a device journal for unsynced answers. The server revision wins conflicts and the original server deadline determines which answers count.
- PR #60 restricted Overview and Learn performance to released attempts. PR #61 restricted signed-in testers to the account flow in the controlled-login build. A fictional browser session exercises direct-route denial, refresh and sign-out.
- PR #62 added `/review/drawings` and audited administrator access controls. An isolated Supabase stack passed Auth, drawing upload and removal, private image signing, grading and access revocation using synthetic accounts.
- PR #63 added the Learn editor for private drafts, versioned edits, rights-confirmed publication and withdrawal. Students keep their completion when a withdrawn lesson is revised and republished.
- PR #64 added the private staging build with exact hostname, project and server tester admission. The read-only hosted inventory found 25 migrations, three active Edge Functions and the older missing AI schema migration `202611060006`. The provider dry run through `202611060128` listed 27 pending migrations. The existing private Site shares the preview and `dmocks.com` hostnames.
- AI drafting checks reference rights at request and completion. Its service records canonical held drafts. Human approval and a rights note create the Git review artifact. The real importer and UCEED compiler accepted the artifact in isolated Supabase with a fictional model response.
- PDF/photo intake now has structured corrections, manual transcription of several questions per source, authenticated original downloads and retained question-only PNG crops. Migration `202611060130` validates canonical answers and figures, preserves source lineage and review holds, and serializes per-source review/retry operations. Artifacts still enter the bank through a reviewed Git change. Synthetic isolated Supabase acceptance passed real Auth/Storage/Edge, concurrent figure uploads and review decisions, manual retry deduplication, and the actual importer/private-media/runtime-writer handoff. The extraction response was fictional. Its live model deployment and hosted acceptance are pending.
- Question extraction and AI drafting now have five-minute expiry, bounded service recovery, explicit admin retries and private processing tokens. Matching workers reject late completions and failures from an older retry. AI retries retain creator authorization and reference-rights checks. Synthetic Supabase acceptance passed real Auth/Edge source upload, HTTP overloads, the operations runner, concurrent held responses and legacy service compatibility. Migration `202611060131`, both model workers and the operations runner require a coordinated approved staging rollout.
- The complete `/admin` bank browser replaces the first-25 list with searchable pagination, exam/type/topic/status filters, full canonical questions and answers, compiled keys/marking and private figures. A written review checks an exact version covering source/runtime/review state/local holds; incomplete media cannot be approved. Migration `202611060132` and `bank-review-media` need promotion with the frontend. Isolated synthetic Supabase acceptance passed real Auth, the importer/compiler/runtime writer, private PNG signing and byte verification, both HTTP review overloads, stale/missing-object denial and administrator revocation. Students and drawing-only teachers cannot access the bank.
- Delivered-version reports now trigger a hold at five unique students and high priority at ten, with a twenty-per-hour account cap. Every new attempt path is fenced against the report threshold; fixed All India papers pause admission while existing snapshots/clocks/results remain unchanged. Admin review opens the full delivered snapshot and signed private figures, checks both case and bank versions, audits human actions and separates corrected-source release from fresh bank approval. Student receipts omit answer-dependent review identifiers. Migration `202611060133`, `reported-question-media` and the matching frontend require a coordinated staging rollout. Isolated Supabase acceptance passed a deliberately queued threshold/admission race, actual Auth/import/compiler/runtime writes, both resolver HTTP overloads, signed PNG bytes, corrected-source replay, new-version counts and access revocation.
- Account export schema 2 now withholds All India/combined-exam marks through their release boundary, preserves own answers/report text without private review hashes, and exports published cohort and Part B human scores plus released feedback. The browser verifies ownership/schema/release fields and aborts pending downloads on account changes or navigation. Migration `202611060134` requires the matching frontend. Isolated real Auth/PostgREST acceptance passed cohort publication, a full-count 57-question Part A with two drawing tasks, upload/partial-teacher-release holds, final 89/300 and 85/100 marks, cross-account denial and enabled-reviewer isolation. No hosted or payment state changed.
- Local evidence includes 179 JavaScript tests, four Python fixtures, 308 browser journeys, all eleven server-function type checks, zero production dependency findings and all 68 migrations with transactional suites on disposable PostgreSQL 17.
- The last read-only hosted ledger has 25 applied versions. Comparison with the 68 current migration files leaves 43 pending, including the older AI schema gap; this is not a fresh hosted dry run. The current private Site shares the preview hostname and `dmocks.com`; a staging promotion still needs a deliberate provider and hosting decision.
- Overview exam percentages now use published cohort marks and count a complete Part A/Part B session once with its combined human-inclusive result. Negative/zero ordinary scores remain exact; cards render even without objective accuracy. Migration `202611060135` and the matching frontend require staging promotion. Disposable PostgreSQL regressions and desktop/mobile dashboard, WCAG and reflow journeys pass.
- Part B paper, recent history and export now use released human marks and the frozen drawing maximum through the private visibility query. Partial review marks/comments/criteria stay sealed through full-exam release, and the UI labels drawing results. Downloads reject inconsistent totals and part/report marks. Migration `202611060136` requires the matching frontend. Real isolated Auth/Storage/PostgREST acceptance passed a full 57-question session, early reviewer denial, partial/full teacher release, 85/100 and 89/300 results, role isolation and unchanged frozen data. The owned stack was removed; credential-free counts/source are in ignored `.dmocks-local-evidence/`.
- Topic practice now prefers ready canonical questions absent from the signed-in student's own delivered snapshots, then uses randomized review questions. Active attempts count as delivered, legacy missing keys are not guessed, and selected questions remain unique. Catalogue eligibility, explicit count/time/null validation, paywall/profile/cap checks and quality admission fences are preserved. Migration `202611060137` and the matching explanatory frontend require promotion. Real isolated Auth/PostgREST acceptance passed paired students, partial/exhausted fallback, counts/timers, legacy records, simultaneous starts and immutable prior snapshots. Credential-free source/counts are in ignored `.dmocks-local-evidence/`; the owned stack was removed.
- Drawing uploads now filter complete containers, strip unnecessary metadata and fully decode still PNG/JPEG/WebP using pinned Wasm before private Storage. Compressed pixels, rendering colour profiles and orientation-only EXIF are retained. Request/profile/decoder bounds, actionable retries and sanitized-size receipts preserve the original private scopes and fixed clocks. Actual isolated Auth/Edge/Storage acceptance passed metadata removal, independent pixel comparisons, malformed-image denial, large synthetic rasters, concurrent final-page uploads, a deliberately queued post-decode cutoff/cleanup race, anonymous teacher signing and reviewer revocation. The local Docker bundle is about 10.9 MB in CLI Brotli format. The owned stack and its credentials were removed; credential-free source/counts remain in ignored `.dmocks-local-evidence/` outside the app. General malware scanning/quarantine, resumable transfer and hosted resource acceptance remain open; the image parser is not an antivirus scanner. No model calls or real student files were used.
- Private student and anonymous teacher inspection now corrects orientation per browser/format, with rotate/mirror, fit/zoom/actual size, scrolling and contrasting backgrounds. Complete validated dimensions/orientation are registered for new uploads; legacy metadata stays null. Migration `202611060138`, both drawing Edge Functions and the frontend require coordinated promotion. Owner signing and teacher assignment are rechecked after asynchronous signing. Isolated real Auth/Storage/Edge and desktop/mobile browser acceptance passed new/legacy pages, owned exports, unchanged clocks/grades and a real queued-signing revocation race. Tests compare all eight orientations across three formats against independent pixels, check keyboard/WCAG/mobile controls, and clear private views on account changes, expiry, removal and navigation. Credential-free source/counts remain in ignored `.dmocks-local-evidence/`; the owned stack and credentials are removed after verification.
- Community uploads now fully decode/filter PNG/JPEG/WebP under the existing three-image/5 MiB policy, retain render metadata and sanitized hashes, and bind actual private object MIME/size. The eleven-argument registrar reuses identical receipts and rejects conflicting positions; the legacy signature stays compatible. Author/parent locks serialize registration with moderation, and signing rechecks visibility after Storage. The frontend keeps saved post/reply text during attachment retries, clears on account/navigation changes, expires links by server time and corrects WebP orientation. Isolated actual Auth/Storage/Edge/PostgREST and desktop/mobile browser acceptance passed full formats, private access, lost committed acknowledgements without duplicate text/objects, reply images, both queued moderation races, legacy metadata, WCAG and reflow. Migration `202611060139`, `community-media`, the shared decoder/drawing bundle and frontend require coordinated staging promotion. Credential-free source/counts remain in ignored `.dmocks-local-evidence/`; the owned stack and credentials are removed after verification.
- Community text creation now has account-bound replay receipts; nested replies use bounded snapshot/anchor reads, redaction fences and preserved view/focus during late completions. Migration `202611060140` and the matching frontend need staging promotion. Actual isolated Auth/PostgREST and desktop/mobile SDK proof passed concurrent replay, quotas, queued parent moderation, snapshot clocks, saved later-page images and helpful state. Independent read-only reviews were addressed; the guarded fixture and all private keys/actors were removed after retaining credential-free evidence.
- Administrator Community report review now opens complete current target/parent/discussion content and private images, records a version-bound written hide/dismiss decision and keeps one inspected-snapshot audit per report. Missing images block dismissal; containment remains available. Migration `202611060141`, `community-media` and the matching frontend require coordinated staging promotion. Actual isolated Auth/PostgREST/Edge/Storage and desktop/mobile proof passed hidden context, role/metadata/object fences, queued revocation, competing decisions and late decoded registration.
- Next safe Community work: member image inspection and broader moderation actions. Author follow-up additions are implemented locally. Physical removal must preserve reported evidence and follow the pending retention plan. Current pending image selections remain only within the open page/session. Preserve validated image receipts, owner/moderation scope, expiry and closed registration/payments. Scanning/quarantine, resumable transfer and representative hosted resource acceptance remain separate gates.
- Provider promotion needs a reviewed migration plan including the older gap, matching Edge Functions, a private staging artifact and synthetic acceptance. Content rights, owner theory export and deferred payments are tracked in the launch checklist.

### Integration checkpoint — 8 November 2026

PR #77 merged Community text replay/threaded reading after exact-head CI (`9810d6382cceb516d0c4d1401cb58d0d3bc904fa`, run 42406653866). Merge `ad34da6ae7cde23bed45745c7645e70db1d5b518` has the identical tested tree; main run 42407499200 passed. Its owned real-provider fixture and all credentials were removed after credential-free evidence was retained.

PR #78 merged exact Learn exam/topic context and two-worker browser CI after PR run 42408137071 passed at `6e2039e75bec4a6cfc423bfb1b2000b77e2c0483`. Its main run 42408895793 caught a late-start/Home navigation race (215/216 passed); retain that failure honestly. PR #79 fixed the gap before React cleanup by comparing the original browser address and history-entry key as well as AbortSignal. The new deterministic desktop/mobile fixture fails before the fix and passes after it. Tested `f20570fb06aa3fca1f11e19346b9bbdd2af39884` merged as `6f762e9d07f25907f9ebc551c153fce70056814a` with an identical tree; PR run 42410151462 and main run 42410996340 both passed all 218 journeys. Its isolated fix worktree was removed; credential-free source/receipt is `.dmocks-local-evidence/practice-navigation-fix-2026-11-08/`.

PR #80 implements migration 141, current private report/context/media inspection, a UTC-stable evidence digest, written version-checked hide/dismiss, one private inspected-snapshot audit, closed legacy resolution, post→comments→report→Storage fencing, final admin checks and a second Edge signing fence. The browser validates exact image identities/display, clears failed/expired/stale access, preserves keyboard recovery and uses the approved theme controls. Its accepted local CI-mode evidence was 159 JavaScript tests, four Python fixtures, 240 browser journeys, eleven server types, all 65 migrations/authorization suites and zero production dependency findings. Independent read-only security/browser findings were addressed; exact-head PR and main CI both passed. Inspect GitHub/ignored receipts for later delivery gates.

Actual isolated Auth/PostgREST/Edge/Storage acceptance passed new/legacy rasters, hash-verified downloads, hidden parent inspection, unchanged versions after downloads, missing-object containment, queued administrator revocation and competing decisions. A decoded upload deliberately queued before a decision registered once and invalidated the older inspected version without resolving its report. Actual desktop/mobile SDK inspection, versioned reasons/audits, focus, both-theme WCAG and 320px reflow passed. Credential-free proofs/source/screenshots are `.dmocks-local-evidence/community-report-review-2026-11-08/`. The owned `.dmocks-report-3r8jq0rn` stack, containers, volumes, keys, actors and raw logs were removed. Original isolated UI preparation may be removed after verifying the integrated source commit; preserve unrelated worktrees and root dependencies.

The primary agent owns shared files, branches, commits, PRs, merges, providers and this handoff; independent reviews and isolated preparation are authorized. Next implement member report reasons/details and a bounded/filterable Community feed, then author attachment management and broader moderation actions. Preserve text request identity, snapshot clocks, moderation fences, private-image limits and legacy compatibility. Public registration, payments, content approval, model calls and hosted promotion stay closed. The last hosted ledger still has 25 migrations; 65 source files leave 40 pending by comparison, not a new hosted dry run. Provider/hosting promotion, rights, theory/Cloudboard exports, OTP/model choices and policies remain separate owner gates.

- Member Community reporting now collects an explicit reason and optional details for the exact post/reply. Migration `202611060142` preserves the quota/signature, acknowledges owned duplicates before quota/visibility without replacing notes, and locks post before comment. The modal freezes uncertain payloads for identical retries, clears on account/navigation/Close and keeps acknowledgements open. Complete local checks pass 167 JavaScript, four Python, 258 browser journeys, eleven server types, all 66 database migrations/suites and zero production dependency findings. Actual isolated Auth/PostgREST and desktop/mobile SDK acceptance passed concurrent duplicates, lost committed acknowledgements, queued moderation, focus, both themes, WCAG and reflow. Credential-free evidence is retained; the owned fixture and private keys/raw logs are removed.
- PR #80 is merged in `6fb0b69198385ee10a9fe3263b8f0ef335c5e49f`; its exact tested head and main workflow both passed. Member reporting and bounded/filterable feed work follow this merge, preserving report, image, replay and thread fences. Registration, checkout and provider promotion remain closed.

- PR #81 is merged in `b3a0d47174f914fb3160b8db0cffaaacdcf64581`; exact-head PR workflow `42415482796` and main workflow `42416239768` both passed.
- The filtered Community feed now reads at most 25 discussions per page with exact exam/topic filters, raw microsecond cursors, snapshot/revision fencing and independent feed intents. Migration `202611060143` drains uncommitted creators before snapshots, assigns post clocks after author/Auth/global admission, and reads through MVCC without post/comment row locks. Display/order/status changes invalidate accumulated pages; new posts/replies/votes/images do not. All 173 JavaScript, four Python, 280 browser journeys, eleven server types, 67 database migrations/suites and the zero-finding production audit pass locally. Actual isolated Auth/PostgREST races and desktop/mobile SDK acceptance passed commit/rollback drain, queued creators/readers/moderation, fresh post-wait redaction, exact cursors, 61-row traversal, late-post exclusion, filters, drafts/focus, themes, WCAG and320px. The owned provider fixture/keys/logs were removed; credential-free evidence is retained. PR and main CI remain this slice's delivery gate.

- PR #82 is merged in `05238ba6f53dc5ec7b06a8d5010855ad99818dcd`; exact-head PR workflow `42417782126` and main workflow `42418601647` both passed. The tested and merge trees match.
- Follow-up Community image additions use migration `202611060144`, narrow author-only occupied-position reads, immutable file/position plans and the unchanged private uploader. Owned post/reply additions preserve original text, assets, loaded replies and unsent drafts; new view/filter/account choices fence late completions. Four pre-fix desktop/mobile cases reproduced a draft-reset issue; bounded header/exact-row refresh fixed it. Final local checks pass 179 JavaScript, four Python, 308 browser journeys, eleven server types, all 68 migrations/authorization suites and zero production dependency findings. Real Auth/PostgREST/Edge/Storage and desktop/mobile SDK acceptance passed lost acknowledgements, non-sequential/legacy positions, original hashes/text, ownership/status/role denial, competing-position cleanup, stale administrator review, queued moderation, unsent drafts, inline raster display, focus, themes, WCAG and320px. The owned fixture and all private keys/logs were removed; only credential-free evidence remains. PR and main CI still gate delivery of this slice.
- Members currently see Community images inline. The next safe UI slice is a scoped full-image inspector using the existing raster controls, with URL/identity, expiry, account/navigation and delayed-close guards. Broader moderation and physical attachment removal/replacement remain separate; preserve open-report evidence and wait for the retention design before deletion.
