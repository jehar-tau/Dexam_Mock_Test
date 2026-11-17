# Community plan

The plan for turning DMocks Community from a moderated question-and-answer
board into each student's prep knowledge base: long-form posts, comments,
likes, saved folders, work for feedback, imported links and, later, a browser
extension.

**Taking over the work? Read [HANDOFF.md](HANDOFF.md) first.** It says where
the build stands and what to do next.

## The owner's vision (16 November 2026)

- Teachers and students write long-form posts about their experience and how
  to tackle the exams, like an article written inside the application.
- Others comment, like, and help a post reach more people.
- Readers save posts into folders or playlists for future reference, not
  just a bookmark.
- People bring in articles and links from the internet, so the feed keeps
  evolving.
- Students post their work and ask what and how to improve.
- Students post questions: time management, a specific problem, "is this
  college good", anything.
- It becomes each student's knowledge base for their prep.
- Later: a Chrome extension saves links from Instagram, Facebook or any
  article into the student's DMocks prep space; good saved articles can be
  pulled into the feed.
- Separately, for Learn: spoken feedback when a student answers wrongly,
  with a switch to turn audio off.

## Reading order

| # | Document | What it settles |
|---|---|---|
| 1 | [01-product-scope.md](01-product-scope.md) | What already exists, the phases, and what each phase ships. |
| 2 | [02-data-model.md](02-data-model.md) | Tables, server functions and client modules, phase by phase. |
| 3 | [03-safety-and-moderation.md](03-safety-and-moderation.md) | Rules for a community of young students: contact details, reporting, blocking, moderators, sanctions. |
| 4 | [04-release-gating.md](04-release-gating.md) | What stays behind the release flag and the checklist for releasing it. |
| 5 | [05-open-decisions.md](05-open-decisions.md) | Decisions only the owner can make, each with a recommendation. |
| 6 | [06-learn-audio-feedback.md](06-learn-audio-feedback.md) | The separate Learn track for spoken feedback. |

## Rules that never bend

1. Community is not released by merging code. It stays in `deferredModules`
   in `src/launch-scope.mjs` until the owner releases it, and every screen
   is reachable only through the post-launch preview until then.
2. No private messaging, no follower graph, no public activity trail, no
   public phone, email, city or social handle. First name only.
3. Every write goes through a server function that checks the signed-in
   account, rate limits, and the contact-details guard. The browser is never
   trusted.
4. Text is rendered as text. Article formatting is parsed into React
   elements by our own code; no user-supplied HTML is ever injected.
5. Nothing from the private question bank, an active assessment or a past
   paper is seeded into Community. Fixtures are original and fictional.
6. Keep the DMocks rules in `apps/designmocks/AGENTS.md`: separate brand, no
   credentials or student data in the repo, no new runtime dependency
   without the owner's say.
7. Unit tests, build and Playwright journeys (desktop Chromium and Pixel 7)
   pass before a phase is called built. Say what was not verified.

## Status board

Update this table in the same change as the work.

| Phase | Scope | Status |
|---|---|---|
| 0 | Moderated discussions: posts, threaded replies, helpful marks, images, reporting, admin moderation | Built before this plan, behind the preview |
| 1 | Articles, likes, saved folders, drafts, contact-details guard, block an author | Built behind the preview, 16 November 2026; evaluation with the owner pending |
| 2 | Accepted answers, work for feedback, teachers, moderator hold, pauses, editing, featured shelf | Built behind the preview, 17 November 2026; evaluation with the owner pending |
| 3 | Link import and private link saves | Built behind the preview, 17 November 2026; evaluation with the owner pending |
| 4 | Chrome extension | Planned |
| 5 | Prep space: notes, search, saved Learn items | Planned |
| L | Learn audio feedback (separate track) | Planned |
