# All India mock events: run one and release results

Owner decisions, 28 November 2026:

- **Papers.** All India mocks use only original "AIM" papers that the owner has approved. Exam-wise mocks stay hidden.
- **First event.** It runs Fri 11 – Sun 13 Dec 2026, and results come out on Thu 17 Dec.
- **NID seats.** The NID mock is capped at **150 seats**, first come, first served.
- **Free accounts.** A free account can sit the mock and see its score and All India rank. Solutions and analysis for pass holders are a separate change.

Question content never enters this public repository. Each paper's plan and figures stay on the operator machine. On the backend, its questions live only in `dm_private`, as inactive bank rows plus one unpublished paper.

## Database changes (migration `202611280196_fixed_all_india_papers.sql`)

| Change | Detail |
|---|---|
| `dm_private.all_india_events` | The fixed 10-day checks are dropped. The new rule: a window of at most 14 days, and results at most 30 days after it. New columns: `paper_key`, `seat_cap` (null means no cap) and `entry` (`pass` or `free`; existing events stay `pass`). |
| New table `dm_private.all_india_paper_sources` | One row per staged AIM paper: plan and manifest SHA-256, counts and total marks. RLS is on, with no grants. |
| New table `dm_private.all_india_registrations` | One reserved seat per student per event. RLS is on, with no grants. |
| New `public.stage_all_india_paper(jsonb,text)` | **Service role only.** It validates the private plan and registered figures. It writes inactive bank rows (`sourceKind: original`, `licence: dmocks-original`, `provenance.kind: all-india-mock`) and one unpublished `all_india` paper. An exact retry returns the same paper. |
| New `public.admin_all_india_papers()` | Admin only: lists the staged papers. |
| New `public.admin_schedule_all_india_paper(text,text,timestamptz,timestamptz,timestamptz,integer,text)` | Admin only: paper, title, window opens, window closes, results date, seat cap, entry. |
| New `public.admin_set_all_india_seat_cap(uuid,integer)` | Admin only. The cap can never drop below the seats already taken. |
| New `public.register_all_india_event(uuid)` | Signed-in students: reserves a seat before the last start. |
| New `public.public_all_india_upcoming()` | `anon` and `authenticated`: schedule, timer and seats left for upcoming AIM events. It returns no questions. |
| Replaced `public.start_all_india_attempt(uuid)` | Free entry skips the pass check. A start takes a seat, or uses the student's reserved one. Fixed papers pass a readiness check: questions, keys and private figures. |
| Replaced `public.all_india_event_catalog()` | Adds `entry`, `seatCap`, `seatsLeft` and `registered`. |
| Replaced `public.admin_all_india_events()` | Adds the paper, entry, seats taken, submitted count and paper readiness. |
| Private helpers | `dm_private.all_india_seats_taken`, `all_india_last_start`, `all_india_paper_media_ready`, `all_india_fixed_ready`, `all_india_paper_ready` and `take_all_india_seat`. All are revoked from every API role. |

Ranking, drawing review, result release and the public top ten reuse the existing functions unchanged.

The migration grants the new functions itself. The open free backend does not run the paid MVP profile (`supabase/launch/paid-mvp.sql`), so nothing else is needed there. On a project where that profile *is* applied, it revokes non-MVP RPCs. Re-grant the four `authenticated` functions above there, and `public_all_india_upcoming()` to `anon`, before the event.

## Admin checklist

### 1. Set up (by 9 Dec)

1. **Migration.** Apply the migration above to the live backend.
2. **Stage each paper.** Run from `apps/designmocks` with the server environment used for year papers (`DMOCKS_SUPABASE_URL`, `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, `DMOCKS_PAPER_ALLOW_ORIGIN`, `DMOCKS_PAPER_ENVIRONMENT`):
   - `node scripts/all-india-paper.mjs digest --plan <private>/plan.json` prints `planSha256`. It must match the digest Claude recorded.
   - `node scripts/all-india-paper.mjs stage --plan <private>/plan.json --expect <planSha256>` is a dry run that checks every figure.
   - Add `--apply` to upload the figures (each one is read back and checked) and stage the paper hidden. Record `paperId` and `manifestSha256`.
3. **Schedule both events.** On the Admin page, under **All India mock events → Schedule event**:

   | Paper | Title | Opens (IST) | Closes (IST) | Results (IST) | Seats | Entry |
   |---|---|---|---|---|---|---|
   | `nid-bdes-aim-1` | NID B.Des All India Mock · December 2026 | 11 Dec 00:00 | 14 Dec 00:00 | 17 Dec 10:00 | 150 | Free |
   | `uceed-aim-2` | UCEED All India Mock · December 2026 | 11 Dec 00:00 | 14 Dec 00:00 | 17 Dec 10:00 | empty (no cap) | Free |

   Both papers run 3 hours, followed by 10 minutes for drawing photo uploads. The last start is therefore **13 Dec, 20:50 IST**.
4. **Teachers.** Check that drawing reviewers have access: the `drawing-review` release is on and the reviewer roster is set on the Admin page. NID has 6 tasks per student, so a full NID event means up to 900 task reviews. UCEED has 2 tasks per student.
5. **Release flag.** Set the repo variable `DMOCKS_RELEASED_STUDENT_MODULES` to `practice,drawing-review,community,lessons,all-india` and publish the site. A misspelt name empties the whole list.
6. **Live check.** Signed out, `/dashboard/all-india` and `/account` show both events with "150 of 150 seats left" for NID. Signed in, **Reserve my seat** works and the countdown shows.

### 2. During the window (11–13 Dec)

- **Watch the Admin event cards.** Each card shows seats taken, starts and submissions. **Save seats** raises the NID cap if the owner decides to.
- **"Paper not ready" on a card** means a private figure is missing from storage. Starts pause until it is re-uploaded with the same `stage` command.
- **Students start once**, at any time before the last start. Their clock keeps running if they disconnect.

### 3. After the window (14–17 Dec)

1. **Marking.** Teachers mark every uploaded drawing at `/review/drawings`: claim, mark against the criteria, then release the review. The private plan's teacher notes list each task's criteria.
2. **Release results.** From **17 Dec 10:00 IST**, **Release reviewed results** turns on once *drawing reviews remaining* reaches 0. Ranks combine objective marks with teacher marks, and ties go to the faster submission (objective-only events only). Students see their rank and marks on the All India page.
3. **Open the public top ten.** On the released card, **Open public top ten** needs the current policy version and an approval reference. The privacy and child-safety launch gates must also be approved. Only students in the top ten who choose to share appear, under a generated alias.
4. **Topic practice.** Moving the questions into topic practice is a later, separate step (`MOCK_PAPERS_SPEC.md` §3). The bank rows stay inactive until then.
