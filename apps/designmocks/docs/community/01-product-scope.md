# 1. Product scope and phases

## What already exists (phase 0)

Community is not a blank page. A moderated discussion board was built and
verified locally in early November 2026 and sits behind the post-launch
preview at `/dashboard/community`:

| Capability | Where |
|---|---|
| Discussion posts: exam, topic, title, body up to 5,000 characters | `Community.jsx`, `create_community_post` |
| Threaded replies, "helpful" marks on replies | `CommunityThread.jsx`, `add_community_comment`, `mark_community_helpful` |
| Up to three private images per post or reply, validated, metadata removed, short-lived signed links | `community-media` function, `community-media.js` |
| Exam and topic filters, 25-row snapshot pages | `community_feed`, `community-feed.js` |
| Reporting with a reason; ten reports an hour | `CommunityReporting.jsx`, `report_community_content` |
| Admin moderation: report queue, content browser, hide, restore, lock, audit log | `CommunityReportReview.jsx`, `CommunityContentModeration.jsx` |
| Rate limits: five posts and thirty replies an hour | `202611060111_community_abuse_controls.sql` |
| Retry-safe writes (request receipts) and account-bound requests | `community-write.js`, `account-services.js` |
| Community content in the private account export | `202611060134_private_account_export.sql` |

So "students post questions" is largely built already. What the owner's
vision adds is long-form writing, likes, saving, work for feedback, links
and the prep space. Every phase below extends the existing tables and the
existing moderation path; nothing is rebuilt.

What phase 0 does not have: editing after posting, blocking another user,
any check for phone numbers or handles in text, teacher or moderator roles
(only administrators moderate), or sanctions against an account.

## Phase 1: articles, likes, saves

The first thing to build. One student can write an article, others can read
it, comment, like it and file it into their own folders.

- **Articles.** A second kind of post beside discussions. Title, exam,
  topic, a body of 200 to 20,000 characters, up to three images through the
  existing image path, added from the article's page after publishing.
  Written in a simple editor with a toolbar (heading,
  bold, italic, list, quote) and a live preview. Stored as plain text in a
  small Markdown subset and rendered by our own code.
- **Drafts.** An unfinished article is saved to the student's account, not
  the browser, so a closed tab or a second device does not lose it. Up to
  ten drafts. Drafts are private.
- **Reading page.** Each article has its own address
  (`/dashboard/community/post/:id`) with the article, its images, the like
  and save controls, and the existing threaded comments below.
- **Likes.** One like per reader per post, removable. Nobody can like their
  own post. The count is public; the list of who liked is not.
- **Reach.** The feed gains a "Top" order beside "Latest": most liked in the
  last 30 days. That is how a like helps a post reach more people. No
  reshares, no followers.
- **Saved folders.** A reader saves any post into one or more named folders
  ("NID studio test", "Time management"). A default "Saved" folder exists
  from the first save. Folders are private, can be renamed and deleted, and
  have their own page (`/dashboard/community/saved`). Up to 50 folders and
  1,000 saves per account.
- **Safety added in this phase** (details in document 3): the
  contact-details guard on every post, article and reply; "block this
  author"; two new report reasons; automatic hiding after three independent
  reports.
- **Sections.** Articles (Latest and Top, exam filter), Discussions (the
  existing page), Saved and Write.

Out of scope for phase 1: editing a published article (see open decision
5), inline images inside the text, clickable links, teacher badges.

Done when: the journeys in [HANDOFF.md](HANDOFF.md) pass on desktop and
Pixel 7, unit tests and the build pass, and the database tests pass against
a disposable local PostgreSQL.

## Phase 2: questions and work for feedback

Built 17 November 2026, behind the preview. What shipped:

- **Questions.** Every discussion is a question that can have an accepted
  answer, chosen only by the asker from someone else's reply, and cleared
  again. An Unanswered section lists open questions; answered ones say so
  in the discussion list. No separate question flag was needed.
- **Work for feedback.** A post kind for a drawing or portfolio piece with
  two prompts ("What I was trying to do", "What I want feedback on"),
  stored as two headed sections. Images are added on the post's page
  right after posting, up to three. Replies can start from a "what works,
  what to improve, how" template. A Work section lists them.
- **Teachers.** An administrator-managed list. A teacher's posts and
  replies carry a "Teacher" label, and on work posts a teacher's
  top-level feedback is listed first.
- **Featured shelf.** Teachers and the administrator can feature up to ten
  articles or work posts; the shelf sits at the top of Articles.
- **Moderation.** A teacher marked as moderator can hold a post or reply:
  it is hidden at once and waits for an administrator. The administrator
  can pause an author (for 1 to 365 days, or until lifted) from any of
  their posts or replies, and lift it from the admin page. Safety reports
  come first in the administrator's queue.
- **Editing.** Authors edit their own posts. Readers see "Edited"; the
  administrator sees every earlier version.

Not done in phase 2, and why:

- **Six images for work posts.** The three-image limit is enforced in the
  database, the image function and every client check; raising it for one
  kind touches the verified upload path, so it is its own change.
- **Images before text.** Work is posted first and images are added next,
  using the existing upload path.
- **Holding a new member's first post** (decision 4) is not built; it
  waits for the owner's decision before release.

## Phase 3: link import

- Paste a web address; a server function fetches the page's title, site
  name and description. Nothing else is copied, the page is not embedded,
  and no remote image is hot-linked.
- A link is saved **privately** first, into a folder, with the student's
  own note. That alone makes the prep space useful.
- "Suggest for the feed" sends the link to a moderator. Only an approved
  link becomes a public link post that others can comment on, like and
  save. Approved domains can be trusted so later links from them skip the
  queue.
- Fetching is server-side with a blocklist, a size cap and a timeout, and
  never follows links to private network addresses.

## Phase 4: Chrome extension

- A small Manifest V3 extension: "Save to DMocks" for the current tab, with
  a folder picker and a note. It calls the same private-save function as
  phase 3.
- It signs in through the DMocks site, holds a narrowly scoped, revocable
  token, and reads only the tab the student clicks on. It never reads
  browsing history or page content beyond the address and title.
- It lives in its own directory with its own build, and needs the owner's
  Chrome Web Store account, a privacy policy entry and a store review.
- Instagram and Facebook links are saved as addresses with the student's
  note; their content cannot be fetched and is not scraped.

## Phase 5: the prep space

- One page that gathers everything a student has kept: folders of saved
  posts and links, their own posts and drafts, private notes on any saved
  item, and saved Learn lessons.
- Search across the student's own saves, and folder ordering so a folder
  works as a playlist.
- A moderator can feature a link or article from the review queue into the
  feed ("good saved articles can be pulled into the feed"), never straight
  from a student's private folder without the student suggesting it.

## Track L: Learn audio feedback

Separate from Community, different code, different release switch. See
[06-learn-audio-feedback.md](06-learn-audio-feedback.md).

## Order and evaluation

Build one phase end to end, then stop and evaluate with the owner before
the next, the same way Learn was built. Phase 1 first. Track L can run in
parallel because it touches only `src/learn/`.
