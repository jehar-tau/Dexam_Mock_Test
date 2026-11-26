# DesignMocks

This is a separate brand, application, identity store and payment setup. Do not connect it to Dexam student accounts, staging fixtures, payment credentials or private data.

Use the approved Discovery visual language: paper/forest/orange palette, Figtree and Zilla Slab, original geometric SVG, readable type, light and dark modes. The owner approved ₹1,193 for one year on 4 November 2026. The current working assumption is one pass covering the catalogue, one payment, no automatic renewal.

Keep real sign-in and sales fail-closed until the separate provider project and server functions are configured. Never grant paid access from browser storage or a Razorpay success callback. Only a verified server event may grant access. Do not commit credentials, personal student data or the real reviewed question bank. Label original experience samples as samples.

Run relevant unit, build, browser, keyboard, reflow and accessibility checks. Preserve unused image/reference work outside public assets. Document launch prerequisites and unresolved owner decisions honestly.

## Student-visible delivery priority (owner feedback, 25 November 2026)

The owner is dissatisfied with the pace and with background PRs that leave the portal unchanged or disabled. For the Papers launch, measure progress by complete papers students can open at dmocks.com/papers and by working question, figure, marking, and explanation flows. Publish accepted UI changes after CI and verify the live route. Report the exact visible count and paper-specific blockers; do not count a PR, import, preparation, or hidden paper as a student release. Preserve Claude's bank records, plans, keys, explanations, marking, and figures exactly; stop and report a content validation failure instead of editing it. The owner's 25 November instruction batch-approves the named 18 CEED/UCEED year papers for release after their required checks.

The owner is a UX designer who judges the working interface, not code diffs.
For each small student-facing slice, provide a no-login working preview with
desktop and mobile views, collect visual feedback, and obtain approval of the
visible flow before merging or publishing to dmocks.com. Green CI and a PR
do not replace this review. After the approved slice passes exact PR and
merged-main checks, publish it directly to the public site without a separate
staging-promotion request. See docs/DIRECT_PUBLIC_RELEASE.md. Keep signup,
checkout, sales and unreleased paper starts closed until their own gates pass.

## Curated question source (owner decision, 25 November 2026)

The owner directed removal of the legacy question bank. The canonical export and active bank should contain only exact questions referenced by Claude's ingested, worked-solution year-paper plans. The current curated set is 3,302 questions across 49 plans (drawing tasks are DESCRIPTIVE records that objective plans ignore); the other 3,202 legacy export records are to be retired. On 25 Nov 2026 the owner replaced the DMocks 2024 reconstruction (nid-bdes-recalled-2024, 11 questions) with NID's own B.Des Sample Test Paper 2024 (nid-bdes-sample-2024, 19 questions). Do not refill Papers, topic practice, exam mocks, or All India mocks from that legacy pool. When Claude adds another solved paper, verify its plan against exact new source records before adding them to the curated export. Keep private plans and media outside Git.
