# 5. Open decisions for the owner

Each has a recommendation. Decisions 1 to 4 shape phase 1 or its release;
the rest can wait for their phase. Record answers here with the date, and
copy release-level ones into `docs/PRODUCT_DECISIONS.md`.

## Needed before or during phase 1

### 1. Who may use Community: adults only, or under-18s too?

Sign-up is adults only today, yet most design-exam candidates are 16 to 18
and you describe the community as mostly minors. Admitting under-18s to a
space where they publish writing and images raises consent and
data-protection duties that code cannot settle and that deserve legal
advice.

**Recommendation:** build to the minor-safe standard in document 3 either
way (this plan does), keep admission as it is for now, and treat "admit
under-18s" as a separate decision with advice before Community is
released. It does not block building phase 1.

**Answer:** Approved as recommended, 16 November 2026: build minor-safe, keep admission unchanged, decide on under-18s before release.

### 2. How rich should the article editor be?

- (a) Toolbar over a simple Markdown subset with live preview: headings,
  bold, italic, lists, quotes. Built in-house, no new dependency, safe by
  construction.
- (b) A full rich-text editor like Medium's (inline images, embeds,
  drag-and-drop). Needs a third-party editor library, which is a new
  runtime dependency and a larger safety surface.

**Recommendation:** (a) for phase 1. Inline images can follow in phase 2
without a library. Revisit (b) only if writers ask for it.

**Answer:** Approved as recommended, 16 November 2026: (a), in-house toolbar over the Markdown subset.

### 3. What does "help a post reach more people" mean?

- (a) Likes feed a "Top" order in the feed (most liked in 30 days).
- (b) Also a "Featured" shelf chosen by teachers or the administrator.
- (c) Reshare to followers. Needs a follower graph, which this plan rules
  out for safety.

**Recommendation:** (a) in phase 1, (b) in phase 2 with teacher roles, not
(c).

**Answer:** Approved as recommended, 16 November 2026: (a) now, (b) in phase 2, not (c).

### 4. Should a new member's first article be held for review?

Holding the first article until an administrator approves it stops most
spam and unsafe first posts, but means someone must approve promptly or
new writers wait.

**Recommendation:** not in phase 1 (there are no real members behind the
flag); decide before release, leaning yes if a moderator can check daily.

**Answer:** Approved as recommended, 16 November 2026: not in phase 1; decide before release.

### 5. Can authors edit a published article?

Without editing, a typo is permanent. With editing, moderators must be
able to see what a post said when it was reported.

**Recommendation:** phase 2, with revision history. In phase 1 an author
can save drafts and preview before publishing, but not edit afterwards.

**Answer:** Approved as recommended, 16 November 2026: phase 2, with revision history.

## Needed for later phases

### 6. Who is a teacher, and may teachers moderate? (phase 2)

**Recommendation:** an administrator-managed list of verified teachers;
teachers get a label; only teachers you mark as moderators can hide
content, and only pending your review.

**Answer:** Confirmed by the owner as built, 17 November 2026: an
administrator-managed list of teachers set by account email; teachers get
a label and may feature up to ten articles or work posts; moderators (who
must also be teachers) can only hold content for the administrator's
review.

### 7. Are links clickable, and which sites are allowed? (phase 3)

**Recommendation:** links become public only after a moderator approves
them or from a trusted-domain list you control; approved links open in a
new tab with a "you are leaving DMocks" label.

**Answer:** Confirmed by the owner as built, 17 November 2026. Links reach
the public Links feed only after a moderator approves them, or at once from
a site the administrator trusts; only the administrator trusts sites;
social and messaging sites stay in students' private folders and can never
be trusted; links open in a new tab, marked as outside DMocks.

### 8. Chrome extension publishing (phase 4)

Needs your Chrome Web Store developer account, a privacy-policy entry and
store review time. **Recommendation:** decide after phase 3 shows whether
students use link saving.

**Status:** Built and testable by loading it unpacked, 17 November 2026
(see [07-browser-extension.md](07-browser-extension.md)). Publishing still
needs the owner's decision, store account, store assets and a privacy-policy
entry.

### 9. Is Community free for every signed-in student, or part of the pass?

The roadmap says free for signed-in students. **Recommendation:** keep it
free to read and write; it is what brings students back between mocks.

### 10. Learn audio: device voice or recorded voice? (track L)

See document 6. **Recommendation:** start with the device's built-in voice
(free, instant, works offline); move to recorded audio only if the voice
quality disappoints on the phones students actually use.
