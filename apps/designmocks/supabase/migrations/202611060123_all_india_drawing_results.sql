begin;

-- Preserve the 5-argument call for objective-only events through defaults.
drop function public.admin_create_all_india_event(text,text,timestamptz,integer,integer);
create function public.admin_create_all_india_event(
  p_exam text,p_title text,p_starts_at timestamptz,p_question_count integer,p_duration_seconds integer,
  p_drawing_count integer default 0,p_upload_grace_seconds integer default 900
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  event_id uuid:=gen_random_uuid();
  paper_id uuid;
  question_id uuid;
  exam_code text:=lower(p_exam);
  selected_question record;
  ordinal integer:=0;
  drawing_count integer:=0;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if exam_code is null or exam_code not in('uceed','nid','nift','ceed') or coalesce(char_length(btrim(p_title)),0) not between 5 and 140
    or p_starts_at is null or p_question_count is null or p_question_count not between 0 and 100
    or p_drawing_count is null or p_drawing_count not between 0 and 5
    or p_question_count+p_drawing_count not between 1 and 100
    or p_duration_seconds is null or p_duration_seconds not between 900 and 21600
    or p_upload_grace_seconds is null or p_upload_grace_seconds not between 600 and 900 then
    raise exception 'Invalid event configuration';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(exam_code,30));
  if p_starts_at<=clock_timestamp() then raise exception 'Schedule the event in the future'; end if;
  if exists(select 1 from dm_private.all_india_events e where e.exam=exam_code
    and tstzrange(e.starts_at,e.review_ends_at,'[)') && tstzrange(p_starts_at,p_starts_at+interval '20 days','[)')) then
    raise exception 'An event already overlaps this review cycle';
  end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind,upload_grace_seconds)
    values(btrim(p_title),exam_code,p_duration_seconds,false,true,true,'all_india',case when p_drawing_count>0 then p_upload_grace_seconds else 0 end)
    returning id into paper_id;

  -- Select and snapshot both sections from one bank snapshot.
  for selected_question in
    with eligible as (
      select q.* from dm_private.bank_questions q where q.exam=exam_code and q.active and q.owner_approved
        and q.rights_confirmed and q.payload->'holds'='[]'::jsonb and q.runtime_payload is not null
    ), objective as (
      select * from eligible q where q.objective_ready and q.runtime_payload->>'kind' in('mcq','msq','nat')
        order by md5(q.external_key||event_id::text),q.external_key limit p_question_count
    ), drawing as (
      select * from eligible q where q.runtime_payload->>'kind'='drawing' and q.runtime_payload->'marking'->'humanReview'='true'::jsonb
        order by md5(q.external_key||event_id::text),q.external_key limit p_drawing_count
    )
    select * from (
      select 1 as section,q.* from objective q union all select 2 as section,q.* from drawing q
    ) selected order by section,md5(external_key||event_id::text),external_key
  loop
    ordinal:=ordinal+1;
    if selected_question.section=2 then drawing_count:=drawing_count+1; end if;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
      values(paper_id,ordinal,selected_question.runtime_payload->>'prompt',selected_question.runtime_payload->'options',
        selected_question.runtime_payload->>'kind',selected_question.runtime_payload->'marking',selected_question.runtime_payload->'media',
        (selected_question.runtime_payload->>'points')::numeric,(selected_question.runtime_payload->>'negativePoints')::numeric,
        selected_question.topic,true) returning id into question_id;
    insert into dm_private.answer_keys(question_id,key,explanation)
      values(question_id,selected_question.runtime_payload->'key',selected_question.runtime_payload->>'explanation');
  end loop;
  if ordinal-drawing_count<>p_question_count or drawing_count<>p_drawing_count then
    raise exception 'Not enough reviewed questions for the requested objective and drawing sections';
  end if;
  insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by)
    values(event_id,exam_code,btrim(p_title),paper_id,p_starts_at,p_starts_at+interval '10 days',p_starts_at+interval '20 days',auth.uid());
  return event_id;
end $$;

create function dm_private.freeze_all_india_upload_grace()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if old.source_kind='all_india' and new.upload_grace_seconds is distinct from old.upload_grace_seconds then
    raise exception 'All India upload rules are frozen at scheduling';
  end if;
  return new;
end $$;
create trigger freeze_all_india_upload_grace before update of upload_grace_seconds on dm_private.papers
  for each row execute function dm_private.freeze_all_india_upload_grace();

create or replace function public.start_all_india_attempt(p_event_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  event dm_private.all_india_events;
  paper dm_private.papers;
  candidate uuid:=auth.uid();
  attempt_id uuid;
  started_at timestamptz;
begin
  if candidate is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(candidate::text||p_event_id::text,3));
  if exists(select 1 from dm_private.all_india_attempts ai where ai.event_id=p_event_id and ai.user_id=candidate) then
    raise exception 'This All India mock can only be attempted once';
  end if;
  select * into event from dm_private.all_india_events where id=p_event_id and results_released_at is null for share;
  if not found then raise exception 'This All India mock is not open'; end if;
  select * into paper from dm_private.papers where id=event.paper_id;
  started_at:=clock_timestamp();
  if started_at<event.starts_at or started_at>=event.ends_at-make_interval(secs=>paper.duration_seconds+paper.upload_grace_seconds) then
    raise exception 'There is no full attempt window available';
  end if;
  if not exists(select 1 from dm_private.passes p join public.launch_settings s on s.singleton and s.environment_mode=p.mode
    where p.user_id=candidate and p.expires_at>started_at) then raise exception 'An active pass is required'; end if;
  if not exists(select 1 from public.profiles where user_id=candidate and onboarding_completed_at is not null) then
    raise exception 'Complete your verified profile first';
  end if;
  insert into dm_private.attempts(user_id,paper_id,started_at,deadline)
    values(candidate,paper.id,started_at,started_at+make_interval(secs=>paper.duration_seconds)) returning id into attempt_id;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select attempt_id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=paper.id;
  insert into dm_private.all_india_attempts(event_id,user_id,attempt_id) values(p_event_id,candidate,attempt_id);
  return attempt_id;
end $$;

create function dm_private.all_india_unreviewed_drawings(p_event_id uuid)
returns bigint language sql stable set search_path=pg_catalog,dm_private as $$
  select count(distinct (u.attempt_id,u.question_id))
  from dm_private.all_india_attempts ai join dm_private.drawing_uploads u on u.attempt_id=ai.attempt_id
  left join dm_private.drawing_reviews r on r.attempt_id=u.attempt_id and r.question_id=u.question_id
    and r.status='released' and r.score is not null
  where ai.event_id=p_event_id and r.id is null
$$;

create or replace function public.admin_all_india_events()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,
    'reviewEndsAt',e.review_ends_at,'resultsReleasedAt',e.results_released_at,
    'attempts',(select count(*) from dm_private.all_india_attempts a where a.event_id=e.id),
    'pendingDrawingReviews',status.unreviewed,
    'canRelease',e.results_released_at is null and statement_timestamp()>=e.review_ends_at and status.unreviewed=0
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e
  cross join lateral (select dm_private.all_india_unreviewed_drawings(e.id) as unreviewed) status);
end $$;

-- Serialize corrections and cohort publication against the same event row.
create function dm_private.freeze_released_all_india_review()
returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
declare released_at timestamptz;
begin
  select e.results_released_at into released_at from dm_private.all_india_attempts ai
    join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=old.attempt_id for share of e;
  if released_at is not null then raise exception 'Published All India grades are frozen'; end if;
  return new;
end $$;
create trigger freeze_released_all_india_review before update on dm_private.drawing_reviews
  for each row execute function dm_private.freeze_released_all_india_review();

create or replace function public.admin_drawing_queue()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'reviewId',r.id,'version',r.review_version,'prompt',i.prompt,'status',r.status,
      'uploadCount',(select count(*) from dm_private.drawing_uploads u where u.attempt_id=r.attempt_id and u.question_id=r.question_id),
      'maxScore',i.points,'criteria',r.criterion_marks,'comments',r.comments,'score',r.score,
      'assignedToMe',coalesce(r.reviewer_id=auth.uid(),false),
      'canClaim',r.status='pending' and state.upload_closed and e.results_released_at is null,
      'canReview',state.can_review,'cohortTitle',e.title,'cohortFrozen',e.results_released_at is not null,
      'aiSuggestion',case when state.can_review then (select jsonb_build_object(
        'provider',s.provider,'model',s.model,'rubricVersion',s.rubric_version,
        'criteria',s.criterion_marks,'comments',s.comments,'proposedScore',s.proposed_score,
        'confidence',s.confidence,'evidence',s.evidence,'createdAt',s.created_at
      ) from dm_private.drawing_ai_suggestions s where s.review_id=r.id order by s.created_at desc,s.id desc limit 1) end
    ) order by case r.status when 'pending' then 1 when 'assigned' then 2 when 'reviewed' then 3 else 4 end,r.id),'[]')
    from dm_private.drawing_reviews r
    join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
    join dm_private.attempts a on a.id=r.attempt_id
    left join dm_private.all_india_attempts ai on ai.attempt_id=a.id
    left join dm_private.all_india_events e on e.id=ai.event_id
    cross join lateral (
      select a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=statement_timestamp() as upload_closed,
        a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=statement_timestamp()
        and (r.status in('reviewed','released') or (r.status='assigned' and r.reviewer_id=auth.uid())) as can_review
    ) state
    where a.user_id<>auth.uid()
  );
end $$;

create or replace function public.admin_release_all_india_results(p_event_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare event dm_private.all_india_events;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select * into event from dm_private.all_india_events where id=p_event_id for update;
  if not found or event.results_released_at is not null then raise exception 'Event unavailable'; end if;
  if clock_timestamp()<event.review_ends_at then raise exception 'The review window has not ended'; end if;
  perform dm_private.finalize_attempt(a.id)
    from dm_private.attempts a join dm_private.all_india_attempts ai on ai.attempt_id=a.id
    where ai.event_id=p_event_id and a.status='active';
  if exists(select 1 from dm_private.all_india_attempts ai join dm_private.attempts a on a.id=ai.attempt_id
      where ai.event_id=p_event_id and dm_private.drawing_upload_cutoff(a)>clock_timestamp()) then
    raise exception 'A candidate upload window is still open';
  end if;
  if dm_private.all_india_unreviewed_drawings(p_event_id)>0 then
    raise exception 'Finalize every submitted drawing review before publishing results';
  end if;
  with attempts as (
    select ai.user_id,a.id,a.score,a.total,a.started_at,a.deadline,a.submitted_at
      from dm_private.all_india_attempts ai join dm_private.attempts a on a.id=ai.attempt_id where ai.event_id=p_event_id
  ), drawing as (
    select i.attempt_id,sum(coalesce(r.score,0)) as score,sum(i.points) as total
      from attempts a join dm_private.attempt_items i on i.attempt_id=a.id and i.kind='drawing'
      left join dm_private.drawing_reviews r on r.attempt_id=i.attempt_id and r.question_id=i.question_id and r.status='released'
      group by i.attempt_id
  ), scores as (
    select a.user_id,a.id,a.score+coalesce(d.score,0) as score,a.total+coalesce(d.total,0) as total,
      greatest(0,extract(epoch from ((case when d.attempt_id is not null then a.deadline
        else least(a.submitted_at,a.deadline) end)-a.started_at))::integer) as elapsed_seconds
    from attempts a left join drawing d on d.attempt_id=a.id
  )
  insert into dm_private.all_india_results(event_id,user_id,attempt_id,score,total,elapsed_seconds,rank,alias)
    select p_event_id,s.user_id,s.id,s.score,s.total,s.elapsed_seconds,rank() over(order by s.score desc,s.elapsed_seconds),
      'Candidate-'||upper(substr(md5(s.user_id::text||p_event_id::text),1,10)) from scores s;
  update dm_private.all_india_events set results_released_at=now() where id=p_event_id;
end $$;

create or replace function public.all_india_event_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'lastStartAt',timing.last_start,
    'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'uploadGraceSeconds',p.upload_grace_seconds,
    'state',case when e.results_released_at is not null then 'released' when now()<e.starts_at then 'scheduled'
      when now()<timing.last_start then 'open' when now()<e.ends_at then 'closing' else 'review' end,
    'attemptId',ai.attempt_id,
    'result',case when r.attempt_id is not null and e.results_released_at is not null then
      jsonb_build_object('score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias,
        'cohortSize',(select count(*) from dm_private.all_india_results s where s.event_id=e.id)) end
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e
  join dm_private.papers p on p.id=e.paper_id
  cross join lateral (select e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds) as last_start) timing
  left join dm_private.all_india_attempts ai on ai.event_id=e.id and ai.user_id=auth.uid()
  left join dm_private.all_india_results r on r.attempt_id=ai.attempt_id
  where e.starts_at>now()-interval '90 days');
end $$;

create index all_india_results_public_order_idx on dm_private.all_india_results(event_id,rank,alias,attempt_id);
create or replace function public.public_all_india_top_ten()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'eventId',e.id,'exam',e.exam,'title',e.title,'releasedAt',e.results_released_at,
    'topTen',(select coalesce(jsonb_agg(jsonb_build_object('rank',s.rank,'alias',s.alias,'score',s.score,'total',s.total)
      order by s.rank,s.alias,s.attempt_id),'[]') from (
        select r.rank,r.alias,r.score,r.total,r.attempt_id from dm_private.all_india_results r
        where r.event_id=e.id order by r.rank,r.alias,r.attempt_id limit 10
      ) s)
  ) order by e.results_released_at desc,e.id),'[]')
  from (select * from dm_private.all_india_events where results_released_at is not null
    order by results_released_at desc,id limit 8) e
$$;

create or replace function public.read_attempt(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts;
  event dm_private.all_india_events;
  standing dm_private.all_india_results;
  questions jsonb:='[]';
  upload_tasks jsonb:='[]';
  event_pending boolean;
  exam_pending boolean;
begin
  select * into attempt from dm_private.attempts where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Attempt not found'; end if;
  if attempt.status='active' and attempt.deadline<=now() then
    perform dm_private.finalize_attempt(attempt.id);
    select * into attempt from dm_private.attempts where id=p_id;
  end if;
  select e.* into event from dm_private.all_india_attempts ai
    join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=p_id;
  event_pending:=attempt.status='submitted' and event.id is not null and event.results_released_at is null;
  exam_pending:=attempt.status='submitted' and dm_private.exam_mock_results_pending(p_id);
  if event.results_released_at is not null then
    select * into standing from dm_private.all_india_results where attempt_id=p_id;
  end if;
  if event_pending then
    if attempt.upload_deadline>clock_timestamp() then
      select coalesce(jsonb_agg(jsonb_build_object('id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt) order by i.ordinal),'[]')
        into upload_tasks from dm_private.attempt_items i where i.attempt_id=p_id and i.kind='drawing';
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt,'options',i.options,'topic',i.topic,'answer',i.answer,
      'points',i.points,'negativePoints',i.negative_points,'marking',i.marking,'kind',i.kind,'media',i.media
    )||case when attempt.status='submitted' and not exam_pending then jsonb_build_object(
      'correctKey',i.key,'explanation',i.explanation,'outcome',(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking))
    ) else '{}'::jsonb end||case when attempt.status='submitted' and i.kind='drawing' then jsonb_build_object(
      'drawingReview',case when r.status='released' then jsonb_build_object(
        'status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at
      ) when r.id is not null then '{"status":"pending"}'::jsonb else '{"status":"not_submitted"}'::jsonb end
    ) else '{}'::jsonb end order by i.ordinal),'[]') into questions
    from dm_private.attempt_items i left join dm_private.drawing_reviews r
      on r.attempt_id=i.attempt_id and r.question_id=i.question_id where i.attempt_id=p_id;
  end if;
  return jsonb_build_object(
    'title',(select title from dm_private.papers where id=attempt.paper_id),
    'id',attempt.id,'status',attempt.status,'deadline',attempt.deadline,'uploadDeadline',attempt.upload_deadline,
    'serverNow',now(),'reviewEndsAt',event.review_ends_at,'resultsPending',event_pending,'examResultsPending',exam_pending,
    'score',case when not(event_pending or exam_pending) then coalesce(standing.score,attempt.score) end,
    'total',case when not(event_pending or exam_pending) then coalesce(standing.total,attempt.total) end,
    'cohortResult',case when standing.attempt_id is not null then jsonb_build_object(
      'rank',standing.rank,'objectiveScore',attempt.score,'objectiveTotal',attempt.total,
      'drawingScore',standing.score-attempt.score,'drawingTotal',standing.total-attempt.total
    ) end,'questions',questions,'drawingUploadTasks',upload_tasks
  );
end $$;

create or replace function public.my_attempt_history()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'title',p.title,'status',a.status,'startedAt',a.started_at,'resultsPending',status.pending,
    'score',case when not status.pending then coalesce(r.score,a.score) end,
    'total',case when not status.pending then coalesce(r.total,a.total) end,
    'cohortRank',case when not status.pending then r.rank end
  ) order by a.started_at desc),'[]')
  from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
  left join dm_private.all_india_attempts ai on ai.attempt_id=a.id
  left join dm_private.all_india_events e on e.id=ai.event_id
  left join dm_private.all_india_results r on r.attempt_id=a.id
  cross join lateral (select a.status='submitted' and ((e.id is not null and e.results_released_at is null)
    or (p.source_kind in('exam','exam_part_b') and dm_private.exam_mock_results_pending(a.id))) as pending) status
  where a.user_id=auth.uid()
$$;

revoke all on function dm_private.all_india_unreviewed_drawings(uuid),
  dm_private.freeze_released_all_india_review(),dm_private.freeze_all_india_upload_grace() from public,anon,authenticated;
revoke all on function public.admin_create_all_india_event(text,text,timestamptz,integer,integer,integer,integer) from public,anon;
grant execute on function public.admin_create_all_india_event(text,text,timestamptz,integer,integer,integer,integer) to authenticated;

commit;
