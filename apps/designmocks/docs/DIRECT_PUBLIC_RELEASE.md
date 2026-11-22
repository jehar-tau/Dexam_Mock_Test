# Direct public release workflow (owner decision, 22 November 2026)

The owner wants accepted DMocks website changes published directly to
`https://dmocks.com`. A separate development, staging and production environment
programme is deferred until the complete application is built. The existing
owner-only staging surface remains available for diagnostics, but it is no
longer a required stop for a frontend release. This decision supersedes older
instructions in this repository that require an additional staging-promotion
approval for each public frontend update.

## Each website change

1. Work in a feature branch or isolated worktree. Keep Claude's Learn and
   Community checkout untouched. Run relevant unit, accessibility, desktop and
   mobile browser checks locally.
2. Open a PR. Wait for its exact-head GitHub checks to pass. The repository
   does not currently enforce required checks, so do **not** use
   `gh pr merge --auto`: it may merge while checks are pending.
3. Merge the reviewed PR, then wait for the resulting main commit's checks to
   pass. If a later main commit only changes workflows, compare the application
   tree before claiming the previous build still matches.
4. Build the public frontend from the verified main application tree. Check the
   build and static archive against that tree, save a Sites version, deploy it
   directly to the public DMocks Site, and smoke-test the changed routes at
   `https://dmocks.com` on desktop and mobile. Record the PR, main commit,
   checks, archive digest, Site version and live result. Roll back the Site
   version if the public check fails.

The owner has given a standing decision for this workflow. Routine frontend
releases do not need another approval request. The 15-minute Codex automation is
a polling fallback; Sites has no configured instant public publish-on-push
hook. Do not describe a merged PR as live until the Site deployment and live
checks succeed.

## Separate product activation

Publishing code does not publish a paper, admit students, grant access or turn
on checkout. Keep public registration, paid checkout, sales and unreleased
papers closed until the matching content, identity, policy, payment and hosted
acceptance checks pass. Do not put secrets in the frontend bundle. Database
migrations, Edge Functions, project settings, Google callbacks and payment
switches need their own exact-source checks and recovery plan before changing
the live service. Record any owner decision required for final paper content,
legal notices, paid services or the actual sales opening.

The current public Site is version 9. It serves the year-wise Papers catalogue
and the five-question sample. The catalogue is a collection view: its year
sets are not released timed papers until the fixed-paper acceptance passes.

## Controlled public portal testing

`VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED=true` is a separate production build
profile for testing the student portal at dmocks.com with approved Google
testers. It pins the exact public origin and the designated DMocks Test
Supabase project, keeps checkout closed, and checks the server's
`can_enter_staging_portal` admission decision before every protected route.
Revoking a tester removes their access on the next route check or reload.
This switch does not open public registration or sales. Keep it off in the
ordinary public build until the hosted Google callback, Data API and media
origins have passed the exact-domain tester journey; publish a tested build
with a public browser key only after those checks. A browser flag alone never
grants server access.
