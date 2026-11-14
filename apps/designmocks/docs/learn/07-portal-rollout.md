# 7. Portal rollout

How a built programme reaches students in the DMocks student portal, one
topic at a time, without weakening any existing release rule.

## 7.1 Where Learn stands in the product

- Learn is a post-launch module. In the frozen paid MVP the route
  `/dashboard/learn` shows "Coming later". It is live only where
  `postLaunchPreview` is true (development, test and staging builds with
  `VITE_POST_LAUNCH_PREVIEW=true`). See `src/launch-scope.js`.
- The paid MVP database profile (`supabase/launch/paid-mvp.sql` and
  `paid-mvp-rpcs.json`) does not expose Learn RPCs. Do not add Learn RPCs to
  that profile.
- Turning Learn on for real students is an owner decision recorded in
  `docs/PRODUCT_DECISIONS.md`, separate from sales and sign-up. Nothing in
  this plan flips that switch.

So "pushing a topic into the portal" has three stages:

| Stage | Who sees it | What it needs |
|---|---|---|
| Preview | Developers and the owner on the preview route | Tier built to the definition of done |
| Staging | Approved testers in the staging portal | F7 and F8, the release checklist, owner review of the lessons |
| Released | Signed-in students | Learn module enabled by the owner; programme released by an administrator |

## 7.2 Server-side progress (package F7)

Local storage is replaced by the server as the source of truth, with local
storage kept as an offline queue.

### Tables (schema `dm_private`, row level security on, no direct grants)

```sql
create table dm_private.learning_programmes (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  released boolean not null default false,
  released_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table dm_private.learning_step_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  programme text not null references dm_private.learning_programmes(slug),
  lesson text not null check (lesson ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  step text not null check (step ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  correct boolean,
  hinted boolean not null default false,
  answered_at timestamptz not null default now(),
  primary key (user_id, programme, lesson, step)
);

create table dm_private.learning_lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  programme text not null references dm_private.learning_programmes(slug),
  lesson text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, programme, lesson)
);

create table dm_private.learning_quiz_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  programme text not null references dm_private.learning_programmes(slug),
  tier text not null check (tier in ('foundations','exam-standard','exam-hard','mastery')),
  score integer not null check (score >= 0),
  total integer not null check (total between 1 and 60 and score <= total),
  marks numeric(6,2) not null,
  max_marks numeric(6,2) not null check (max_marks > 0),
  seconds integer not null check (seconds between 0 and 14400),
  passed boolean not null,
  taken_at timestamptz not null default now()
);

create table dm_private.learning_programme_audit (
  id bigint generated always as identity primary key,
  slug text not null,
  released boolean not null,
  actor_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 1000),
  changed_at timestamptz not null default now()
);
```

### RPCs (security definer, `search_path = pg_catalog, dm_private`, execute to `authenticated` only)

| Function | Behaviour |
|---|---|
| `learning_programme_catalog()` | Released slugs, each with the caller's lessons completed and best quiz per tier. |
| `learning_programme_progress(p_slug text)` | The caller's progress in the v2 shape (contracts, section 3.8). Raises `Programme not found` (P0001) when not released. |
| `record_learning_step(p_slug, p_lesson, p_step, p_correct boolean, p_hinted boolean)` | Inserts; on conflict does nothing, so the first result stands. Returns void. |
| `complete_learning_programme_lesson(p_slug, p_lesson)` | Inserts; on conflict does nothing. |
| `record_learning_quiz(p_slug, p_tier, p_score, p_total, p_marks, p_max_marks, p_seconds, p_passed)` | Appends a row. Rate limit: at most 30 rows per user, programme and tier per day. |
| `admin_learning_programmes()` | Admin only: every slug with release state and counts. |
| `admin_set_learning_programme_release(p_slug, p_release boolean, p_reason text)` | Admin only: upserts the slug, writes the audit row. |

Every student function starts with `auth.uid() is null → raise 'Sign in
required'` and refuses unreleased programmes. Admin functions start with
`public.is_dmocks_admin()` and raise with `errcode = '42501'` otherwise.
This mirrors the existing lesson functions in migrations `202611050013`,
`202611060105` and `202611060127`; read them first and copy their style.

Scores are self-reported by the browser. That is acceptable because Learn
results carry no rank, pass or payment consequence. Record this in the
migration comment. If Learn results ever feed a ranking, quiz marking must
move to the server.

### Client

- `src/learn/programme-storage.js` gains a server adapter used when a
  session exists and the portal is configured. Reads call
  `learning_programme_progress`; writes call the record functions.
- Use the verified account services (`useAccountServices` from
  `src/AccountAccess.jsx`), the same actor binding, 20-second deadlines and
  abort handling as `src/Learn.jsx`. Copy its patterns; do not invent a new
  request path.
- Offline: a failed write is queued in local storage under
  `dmocks:learn:queue:<actorId>` and replayed on the next successful read.
  Replays are idempotent because the server keeps first results.
- First sign-in after F7: local v1 or v2 progress for the preview actor is
  not migrated. Local progress stored under the student's own account id is
  replayed once, then cleared.

### Tests

- `tests/database/learning-programmes.sql`: sign-in required, unreleased
  refusal, first-result-stands, completion once, quiz append and rate limit,
  admin-only release with audit, another user cannot read or write.
  Register it in `scripts/check-database.sh`.
- Unit tests for the adapter's response validation, in the style of
  `tests/learning-reader.test.mjs`.
- Browser journey with the portal fixture (`tests/e2e/portal-fixture.js`),
  as in `tests/e2e/learn-lifecycle.spec.js`.
- Adding the migration changes the migration count asserted by
  `tests/rollout-doc-constants.test.mjs`; update `docs/PROVIDER_SETUP.md`.
  Do not add the new functions to `supabase/launch/paid-mvp-rpcs.json`.

## 7.3 Release switch (package F8)

Two conditions must both hold for a student to see a programme:

1. In code: `status: 'released'` in the programme file. `preview` means
   visible only on the development preview route.
2. On the server: a `learning_programmes` row with `released = true`.

The signed-in Learn page asks `learning_programme_catalog()` and shows the
intersection. Withdrawing a programme on the server hides it at once and
keeps student progress.

Admin UI: add a "Learn programmes" block to the admin Learn panel
(`src/Admin.jsx`, beside `LearningLessonEditor`) listing code-released
programmes with a release or withdraw form that requires a reason, like the
lesson publication form.

## 7.4 Release checklist for one programme

Copy this into the pull request that sets `status: 'released'`.

- [ ] All four tiers meet the definition of done (playbook, section 5.4).
- [ ] A reviewer session has run the reviewer brief on every tier and its
      findings are closed.
- [ ] The owner has played every lesson on a phone and approved wording and
      difficulty. Record the date in the decisions log.
- [ ] Take-away practice links resolve to a real topic pool, or the link is
      "Browse practice".
- [ ] `npm run check` passes locally and in CI on the exact head.
- [ ] Database suite passes (`npm run test:database`) once F7 has landed.
- [ ] Staging: an approved tester completes one lesson per tier and one
      quiz; progress survives sign-out and sign-in on another device.
- [ ] No preview-only text or seeds in the released path.
- [ ] Status board and the plan's phase list updated.

## 7.5 Order of release

1. Foundation F8 and F7 land with all programmes still `preview`.
2. Release **Counting cubes** first: its engine is the simplest to audit and
   its Exam hard tier (views to cubes) is a clear test of the ladder.
3. Then paper folding, cube nets, mirror images, colour.
4. Then wave 2 programmes as each completes its four tiers.

Each release is its own small pull request: one programme, `status` flipped,
checklist attached.

## 7.6 What to watch after release

With F11: tier quiz pass rates, first-time accuracy per kind, median time
per question against target, and drop-off screen per lesson. A kind with
first-time accuracy above 90% at L3 or L4 is too easy; below 25% the
teaching before it is failing. Both go back to the topic spec as changes.
