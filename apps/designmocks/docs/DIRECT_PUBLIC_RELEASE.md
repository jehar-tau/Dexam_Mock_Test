# Visual review and direct public release workflow (owner update, 24 November 2026)

The owner wants accepted DMocks website changes published directly to
`https://dmocks.com`. A separate development, staging and production environment
programme is deferred until the complete application is built. The existing
owner-only staging surface remains available for diagnostics, but it is no
longer a required stop for a frontend release. This decision supersedes older
instructions in this repository that require an additional staging-promotion
approval for each public frontend update.

The owner is a user experience designer and reviews the working interface,
not source diffs. Every small student-facing slice must be shown in a working,
no-login preview before it is merged or published. Show desktop and mobile
screens and interactions, and identify preview data. A PR or green CI does not
replace visual review. Record the owner's approval or requested changes.

## Each website change

1. Work in a feature branch or isolated worktree. Keep Claude's Learn and
   Community checkout untouched. Run relevant unit, accessibility, desktop and
   mobile browser checks locally. Prepare a no-login working preview of the
   exact slice, including relevant empty, active and result states.
2. Show the owner the changed student flow at desktop and mobile widths.
   Incorporate feedback and show the corrected flow again. For backend work
   that changes student behavior, demonstrate it through the matching UI.
3. Open a PR. After the visible slice is approved, wait for its exact-head
   GitHub checks to pass. The repository
   does not currently enforce required checks, so do **not** use
   `gh pr merge --auto`: it may merge while checks are pending.
4. Merge the reviewed PR, then wait for the resulting main commit's checks to
   pass. If a later main commit only changes workflows, compare the application
   tree before claiming the previous build still matches.
5. Build the public frontend from the verified main application tree. Check the
   build and static archive against that tree, save a Sites version, deploy it
   directly to the public DMocks Site, and smoke-test the changed routes at
   `https://dmocks.com` on desktop and mobile. Record the PR, main commit,
   checks, archive digest, Site version and live result. Roll back the Site
   version if the public check fails.

The owner's standing decision is to publish visually approved slices directly
to dmocks.com after these checks, without a separate staging promotion
request. The 15-minute Codex automation is
a polling fallback; Sites has no configured instant public publish-on-push
hook. Do not describe a merged PR as live until the Site deployment and live
checks succeed. A PR merged before this update but not yet deployed still
needs visual review before its production behavior changes.

## Separate product activation

Publishing code does not publish a paper, admit students, grant access or turn
on checkout. Keep public registration, paid checkout, sales and unreleased
papers closed until the matching content, identity, policy, payment and hosted
acceptance checks pass. Do not put secrets in the frontend bundle. Database
migrations, Edge Functions, project settings, Google callbacks and payment
switches need their own exact-source checks and recovery plan before changing
the live service. Record any owner decision required for final paper content,
legal notices, paid services or the actual sales opening.

The current public Site is version 18, built from main
`4118e08ca208918fba4044e870abce3fd012c938` after main CI
`45201758426` passed. It serves the year-wise Papers catalogue, the
five-question sample and the controlled student portal. The catalogue is a
collection view: its year sets are not released timed papers until the
fixed-paper acceptance passes. Live Chrome acceptance loaded the protected
Overview, exam-wise mocks, All India mocks, topic practice and Learn pages
with an already authenticated allowlisted Google account. A fresh Google
sign-out, account-choice callback and protected Overview return subsequently
passed in Chrome. An authenticated private-media request is still outstanding.

## Controlled public portal testing

`VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED=true` is a separate production build
profile for testing the student portal at dmocks.com with approved Google
testers. It pins the exact public origin and the designated DMocks Test
Supabase project, keeps checkout closed, and checks the server's
`can_enter_staging_portal` admission decision before every protected route.
Revoking a tester removes their access on the next route check or reload.
This switch does not open public registration or sales. Version 18 has this
switch enabled with a public browser key and an exact-domain server gate. The
hosted Google authorization redirect and callback, protected Data API pages,
and exact media CORS preflight passed; authenticated own/other media checks
remain to be accepted. A browser flag alone never grants server access.
