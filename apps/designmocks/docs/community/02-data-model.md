# 2. Data model and contracts

Conventions already in the repo, which every phase keeps:

- Tables live in `dm_private`, with row level security on and every
  privilege revoked from `anon` and `authenticated`. The browser reaches
  data only through `public` functions that are `security definer`, pin
  `search_path`, check `auth.uid()`, and are granted to `authenticated`.
- Errors carry a stable `detail` code (`community_invalid_input`,
  `community_post_limit`, …) that the client maps to a sentence.
- Writes that create content take a client-made `p_request_id` and record a
  receipt in `community_write_receipts`, so a retry returns the first result
  instead of posting twice.
- The client validates every response shape before showing it
  (`community-feed.js`, `community-write.js`) and calls functions through
  the account-bound `useAccountServices().rpc`.
- One migration per change, named `YYYYMMDDNNNN_topic.sql`, with a matching
  `tests/database/*.sql` added to `scripts/check-database.sh`.
- A new function is not callable in the paid release until it is added to
  `supabase/launch/paid-mvp-rpcs.json`. Community functions stay out of that
  list until release.

## Existing tables (phase 0)

`community_posts`, `community_comments`, `community_helpful`,
`community_reports`, `community_report_reviews`, `community_assets`,
`community_write_receipts`, `community_feed_state`,
`community_moderation_log`, `community_moderation_actions`.

## Phase 1 changes

### Posts

```
alter table dm_private.community_posts
  add column kind text not null default 'discussion'
    check (kind in ('discussion','article'));
```

There is no stored like count: likes are counted when read, so a like never
touches the post row, its moderation version or anyone's feed paging.

The body length check becomes per kind: 20 to 5,000 for a discussion, 200
to 20,000 for an article. Later kinds (`work`, `link`) extend the same
check. Existing rows are discussions, so nothing is rewritten.

The article body is plain text in a fixed Markdown subset: `## ` and `### `
headings, `**bold**`, `*italic*`, `- ` and `1. ` lists, `> ` quotes, `---`
rules, blank-line paragraphs. `src/community-article.mjs` parses it into a
block list; `CommunityArticle.jsx` renders the blocks as React elements.
Anything outside the subset shows as the characters typed. Web addresses
are shown as text and are not clickable until phase 3 sets the link policy.

### New tables

| Table | Columns | Notes |
|---|---|---|
| `community_post_likes` | `user_id`, `post_id`, `created_at`; primary key `(user_id, post_id)` | Cascade on post and user. |
| `community_folders` | `id`, `user_id`, `name` (1–60), `created_at`, `updated_at`; unique `(user_id, lower(name))` | At most 50 per account. |
| `community_saves` | `user_id`, `post_id`, `folder_id`, `created_at`; primary key `(user_id, post_id, folder_id)` | At most 1,000 per account. Cascade on folder, post and user. |
| `community_drafts` | `id`, `user_id`, `exam`, `topic`, `title`, `body`, `updated_at` | At most ten per account. Never read by any feed or moderation query. |
| `community_blocks` | `blocker_id`, `blocked_id`, `created_at`; primary key `(blocker_id, blocked_id)` | At most 200 per account. |

### New and changed functions

| Function | Does |
|---|---|
| `create_community_article(p_exam, p_topic, p_title, p_body, p_request_id, p_draft_id)` | Validates, runs the contact guard, applies the article rate limit (three a day), inserts with `kind='article'`, records the receipt, deletes the draft. Returns the same receipt shape as `create_community_post`. |
| `community_articles(p_exam, p_sort, p_cursor, p_limit)` | Article feed. `p_sort` is `latest` (paged by time) or `top` (one page, by likes in the last 30 days). Returns a 400-character excerpt, not the body, with `likes`, `comments`, `liked`, `saved`. Excludes hidden posts and authors the reader has blocked. |
| `community_feed(...)` | Unchanged signature. Now returns discussions only and excludes blocked authors. |
| `community_thread(...)` | Adds `kind`, `author`, `createdAt`, `likes`, `liked`, `folderIds` to the header. A blocked author's post is unavailable; their replies come back as empty placeholders (`blocked: true`) so the thread keeps its shape. Used by the reading page for the body and comments. |
| `set_community_like(p_post_id, p_liked)` | Idempotent like or unlike; refuses the author's own post and hidden posts; 120 new likes an hour. Returns the new count and state. |
| `community_folders()` | The reader's folders with a count each. |
| `save_community_folder(p_folder_id, p_name)` | Create (null id) or rename. |
| `delete_community_folder(p_folder_id)` | Deletes the folder and its saves. |
| `set_community_saves(p_post_id, p_folder_ids)` | Sets exactly which of the reader's folders hold this post; an empty list removes it. The save dialog offers a first folder named "Saved". |
| `remove_community_save(p_post_id, p_folder_id)` | Removes one post from one folder, for the folder page. |
| `community_saved(p_folder_id, p_cursor, p_limit)` | Posts in a folder, newest save first. A post hidden since it was saved is returned as unavailable, without its content. |
| `community_drafts()`, `save_community_draft(...)`, `delete_community_draft(p_draft_id)` | Private draft storage. Drafts skip the contact guard until publishing. |
| `set_community_block(p_post_id, p_comment_id)` | Blocks the author of the given post or reply. The author's id is never sent to the browser. |
| `community_blocked()`, `remove_community_block(p_handle)` | The reader's block list as first names with an opaque handle, and unblocking by that handle. |
| `export_my_community_library()` | The reader's likes, folders, saves, drafts and blocked first names, for a data export. |
| `dm_private.community_contact_check(text)` | The contact guard (document 3). Called by every create function for posts, articles and replies. |
| `report_community_content(...)` | Accepts two more reasons, `personal_details` and `safety`. After the third distinct reporter the target is hidden pending review and logged with no actor. Reports made before an administrator's restore do not count again. |

The contact guard is also a trigger on `community_posts` and
`community_comments`, so it applies to discussions and replies written
through the older functions without changing them.

`export_my_account_data` belongs to the paid release and is not changed in
phase 1. The new private data is exported by `export_my_community_library`;
folding it into the main export is a release step (document 4). Account
deletion removes all of it through the cascades.

The migration re-creates three existing functions (`community_feed`,
`community_thread`, `report_community_content`) from their latest
definitions with small marked additions. Their existing database tests pass
unchanged.

### Client modules

| File | Purpose |
|---|---|
| `src/community-article.mjs` | Pure: parse the Markdown subset, excerpt, word count, reading time, toolbar edits. Unit tested. |
| `src/community-library.js` | Pure: validate article feed, folder, saved-page and like responses; folder name rules. Unit tested. |
| `src/CommunityArticle.jsx` | Renders an article from blocks. |
| `src/CommunityEditor.jsx` | Editor with toolbar, preview, draft saving, publish. |
| `src/CommunityReader.jsx` | Reading page: article, like, save, block, report, comments. |
| `src/CommunitySaved.jsx` | Folders and their posts. |
| `src/CommunityArticles.jsx` | Article feed: Latest and Top, exam filter. |
| `src/CommunitySaveDialog.jsx` | Choose folders for a post, or create one. |
| `src/CommunityFrame.jsx` | Shared shell: sign-in check, section links, account-bound calls, rules panel. |

The reading page is a custom `View` for the existing `CommunityController`,
so comments, images, retries and reporting are the existing, verified code.

Routes, all behind the same gate as today:
`/dashboard/community` (the existing discussions page, unchanged apart
from the section links), `/dashboard/community/articles`,
`/dashboard/community/write`, `/dashboard/community/post/:id`,
`/dashboard/community/saved`.

## Later phases, in outline

- **Phase 2 (built, migration `202611160171_community_feedback.sql`).**
  `community_posts` gains kind `work` (body 40 to 5,000),
  `accepted_comment_id` and `edited_at`. New tables:
  `community_roles(user_id, teacher, moderator)`,
  `community_post_revisions` (replaced topic, title and body),
  `community_sanctions(user_id, kind mute|ban, until, reason, actor_id,
  lifted_at)` and `community_featured(post_id)`. A trigger refuses posts,
  replies and edits from a paused account, whichever function writes them.
  New functions: `create_community_work`, `community_cards` (work and
  unanswered lists), `accept_community_answer`, `edit_community_post`
  (with the thread version), `my_community_standing`,
  `moderator_hold_community`, `set_community_featured`,
  `community_featured_list`, and for administrators
  `admin_set_community_role`, `admin_community_roles`,
  `admin_community_sanction`, `admin_community_sanctions`,
  `admin_lift_community_sanction`, `admin_community_post_revisions`.
  Re-created: `community_feed` (teacher, answered), `community_thread`
  (teacher, accepted answer, edit time, what the reader may do),
  `community_articles` (teacher), `export_my_community_library` (schema
  version 2, with replaced text and sanctions) and
  `admin_community_report_queue` (safety reports first).
- **Phase 3 (built, migration `202611170172_community_links.sql`).**
  `community_links(id, url unique, host, status fetched|unavailable|skipped,
  title, site, description, fetched_at)` shared between members;
  `community_link_requests` for the hourly fetch limit;
  `community_link_saves(user_id, link_id, folder_id)`;
  `community_notes(user_id, post_id or link_id, body)` for private notes
  (used for links now, for posts in phase 5);
  `community_link_suggestions(link_id, user_id, exam, topic, note, status,
  post_id, reason)`; `community_trusted_hosts(host)`. Posts gain kind
  `link` and `link_id` (one post per link). Functions:
  `community_link_lookup`, service-only `service_begin_community_link_fetch`
  and `service_record_community_link`, `save_community_link`,
  `remove_community_link_save`, `suggest_community_link`,
  `community_link_review_queue`, `review_community_link_suggestion`,
  `admin_community_trusted_hosts`, `admin_set_community_trusted_host`.
  Re-created: `community_saved` (posts and links, cursor
  `{savedAt, type, id}`), `community_folders` (counts links),
  `community_card` and `community_cards` (a `links` view),
  `community_thread` (the link preview), `my_community_standing` (an
  `admin` flag) and `export_my_community_library` (schema version 3). The
  preview code is `supabase/functions/_shared/community-link.mjs`, served
  by the `link` action of `community-media`.
- **Phase 4 (built, migration `202611170173_community_extension.sql`).**
  `community_extension_tokens(id, user_id, label, token_hash, created_at,
  last_used_at, expires_at, revoked_at)`. Member functions:
  `create_community_extension_token` (returns the key once),
  `community_extension_tokens`, `revoke_community_extension_token`.
  Key-checked functions callable with the public key on preview projects:
  `extension_community_folders(p_token)` and
  `extension_save_community_link(p_token, p_url, p_folder_ids,
  p_new_folder, p_note)`. A page saved this way gets a shared link record
  without a preview (`fetched_at` 1970), so the first Get preview fetches
  it. `dm_private.community_link_host` checks that the address is already
  in the normalized public form the browser module produces.
- **Phase 5.** `community_notes(user_id, target_type, target_id, body)`;
  `position` on saves for playlist order; a search function over the
  reader's own saves.
