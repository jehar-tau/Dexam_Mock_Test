# 3. Safety and moderation

The people using Community are exam candidates, most of them 16 to 19.
Admission to DMocks is currently adults only (migration
`202611100165_adults_only_signup.sql`), but the product is built for
school-leavers, an age statement cannot be verified by code, and the owner
describes the community as mostly minors. So Community is designed as if
under-18s are present, whatever the admission rule says. Whether under-18s
are admitted at all, and on what consent, is the owner's decision (document
5, decision 1) and may need legal advice; this plan does not settle it.

## Principles

1. **No private channel.** No direct messages, no follow, no mentions that
   notify, no way to reach one person out of public view.
2. **No way to take a conversation elsewhere.** Phone numbers, email
   addresses, social handles and messaging links are refused when written.
3. **Minimal identity.** Authors appear by first name only. No profile
   page, no city, no school, no photo, no activity history of another user.
   A verified teacher shows a "Teacher" label (phase 2).
4. **Everything public is reviewable.** Every post, article, reply and
   image can be reported, hidden, restored and audited. Private things
   (folders, saves, drafts, notes, blocks) are visible only to their owner.
5. **Fail closed.** If a check cannot run, the write is refused.

## What exists already

Reporting with a reason and optional details; a ten-an-hour report cap;
administrator report queue and content browser with full context and
private images; hide, restore, lock, unlock with an audit log and
version-checked decisions; hourly post and reply limits; validated images
with metadata removed, served through short-lived signed links.

## Added in phase 1

### Contact-details guard

`dm_private.community_contact_check(text)` runs inside every function that
creates a post, article or reply, and raises `community_contact_details`
when the text contains:

- a phone number: ten or more digits in a run, allowing spaces, dots,
  dashes and brackets between them. Ten, not seven, so that years, marks,
  ranks and fees pass; a shorter landline number is not caught;
- an email address, including "name (at) site (dot) com";
- a social or messaging handle: `@name`; an invitation such as "DM me",
  "message me", "ping me", "follow me", "add me"; "my Insta/WhatsApp/…";
  or WhatsApp, Telegram, Instagram, Snapchat or Discord followed by "id",
  "handle", "number", "group" or "username". Naming a platform in passing
  ("I found this on Instagram") is allowed;
- a link to a messaging or social profile (`wa.me`, `t.me`, `instagram.com/`,
  `discord.gg`, …). Other web addresses are allowed as plain text in phase
  1 and governed by the link policy in phase 3.

The same rules run in the browser (`community-article.mjs`) so the writer
is told what to change before submitting, but the server is the authority,
through a trigger on every post and reply. One pattern list is shared: a
unit test fails if the browser and the migration differ. The guard is
deliberately strict; a false refusal is acceptable. Years, marks, ranks
and fees must still pass: `tests/community-article.test.mjs` pins both
directions.

What it cannot catch: digits spelled as words, a number split across
replies, or text inside an image. Reporting ("Shares personal or contact
details") covers those.

Images cannot be scanned for text in phase 1. The upload help already says
to remove names, faces and personal details, and images remain reportable.

### Block an author

"Block this author" on any post or reply. That author's posts and articles
leave the reader's feeds and cannot be opened; their replies in other
threads show as "A reply from an author you blocked", so the conversation
keeps its shape. The blocked person is not told. The block list is manageable from the Saved page. Blocking never
replaces reporting: the menu offers both.

### Reporting

Two more reasons: "Shares personal or contact details" and "I am worried
about someone's safety". Listing safety reports first in the
administrator's queue is not built yet; it moves to phase 2 with the
moderator roles.

When three different accounts report the same post or reply, it is hidden
at once pending review and the action is logged as automatic. An
administrator restores it if the reports were wrong. Accounts whose reports
are repeatedly dismissed can be given a report cooldown (phase 2
sanctions).

### Limits

Three articles a day; five discussions and thirty replies an hour
(existing); 120 new likes an hour; 50 folders; 1,000 saves; ten drafts;
200 blocks.

## Added in phase 2

- **Roles.** `teacher` and `moderator`, granted only by the administrator.
  A moderator can hide and lock; restoring, sanctioning and dismissing
  reports stay with the administrator. Every action is logged with the
  actor.
- **Sanctions.** Mute (cannot post or reply) for a period, or a permanent
  Community ban, with a recorded reason. The student sees why and how to
  appeal through the existing support report.
- **First posts.** An account's first article or work post is held for
  review before it appears (see decision 4 for whether to bring this
  forward).
- **Edits.** An edited post keeps its earlier revisions for moderators, and
  an edit re-runs the contact guard.

## Added with links and the extension (phases 3 and 4)

- Links become public only through a moderator, or from a domain the
  administrator has trusted.
- The server fetches only the title, site and description; nothing is
  embedded and no remote image is loaded in a student's browser.
- Social-profile and messaging links are never accepted for the feed.
- The extension reads only the tab the student clicks and stores nothing
  about browsing.

## Content rules shown to students

A short "Community rules" panel is shown before the first post and linked
from every composer:

1. Be kind and specific. Critique the work, not the person.
2. Never share a phone number, email, social handle, address or school.
3. Post only your own work, or say whose it is.
4. No questions or answers from a test that is still open.
5. Report anything that worries you. Reports are private.

## What moderation needs from people

Software cannot run this alone. Before release the owner needs: a named
person who reviews the report queue at least daily; a rule for safety
reports (who is told, how fast); and the published rules and privacy notice
updated to cover Community. These are release gates in document 4.
