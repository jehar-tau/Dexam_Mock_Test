begin;

-- Owner decisions, 28 November 2026. Original "AIM" papers that Claude writes
-- are used only for monthly All India mocks. Each paper is owner approved,
-- staged privately from a plan file outside Git and kept out of every other
-- student surface. An event runs one fixed paper with its own timer over a
-- short window (three days for the first event), may cap its seats, and may
-- admit free accounts. Ranking still waits for every drawing to be marked.

-- 1. Event windows are no longer fixed at ten days.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname from pg_constraint c
    where c.conrelid='dm_private.all_india_events'::regclass and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%10 days%'
  loop
    execute format('alter table dm_private.all_india_events drop constraint %I',constraint_name);
  end loop;
end $$;
alter table dm_private.all_india_events
  add constraint all_india_events_window_check check(
    ends_at>starts_at and ends_at<=starts_at+interval '14 days'
    and review_ends_at>=ends_at and review_ends_at<=ends_at+interval '30 days');

-- 2. A staged original paper. Its questions live only in dm_private.
create table dm_private.all_india_paper_sources (
  paper_key text primary key check(paper_key ~ '^(uceed|ceed|nid|nift)(-(bdes|mdes))?-aim-[1-9][0-9]{0,2}$'),
  exam text not null check(exam in('uceed','ceed','nid','nift') and paper_key like exam||'-%'),
  paper_id uuid not null unique references dm_private.papers(id),
  plan_sha256 text not null check(plan_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  objective_count integer not null check(objective_count between 0 and 100),
  drawing_count integer not null check(drawing_count between 0 and 12),
  total_marks numeric not null check(total_marks>0),
  staged_at timestamptz not null default clock_timestamp(),
  check(objective_count+drawing_count between 1 and 100)
);
alter table dm_private.all_india_paper_sources enable row level security;
revoke all on dm_private.all_india_paper_sources from public,anon,authenticated,service_role;

alter table dm_private.all_india_events
  add column paper_key text unique references dm_private.all_india_paper_sources(paper_key),
  add column seat_cap integer check(seat_cap between 1 and 100000),
  add column entry text not null default 'pass' check(entry in('pass','free'));

-- 3. Seats. A registration reserves one seat; a start also takes one.
create table dm_private.all_india_registrations (
  event_id uuid not null references dm_private.all_india_events(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  registered_at timestamptz not null default clock_timestamp(),
  primary key(event_id,user_id)
);
alter table dm_private.all_india_registrations enable row level security;
revoke all on dm_private.all_india_registrations from public,anon,authenticated,service_role;

create function dm_private.all_india_seats_taken(p_event_id uuid)
returns integer language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select count(*)::integer from dm_private.all_india_registrations where event_id=p_event_id
$$;

create function dm_private.all_india_last_start(p_event_id uuid)
returns timestamptz language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds)
  from dm_private.all_india_events e join dm_private.papers p on p.id=e.paper_id where e.id=p_event_id
$$;

-- Every figure of the frozen paper must still be the exact private PNG.
create function dm_private.all_india_paper_media_ready(p_paper_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select not exists(
    select 1 from dm_private.questions q
    cross join lateral jsonb_array_elements(q.media) figure
    left join dm_private.bank_media_assets asset on asset.sha256=figure->>'sha256'
    left join storage.objects stored on stored.bucket_id='paper-media' and stored.name=asset.storage_path
    where q.paper_id=p_paper_id and (asset.sha256 is null or asset.storage_path is distinct from figure->>'path'
      or asset.width is distinct from (figure->>'width')::integer
      or asset.height is distinct from (figure->>'height')::integer
      or stored.name is null or stored.metadata->>'mimetype' is distinct from 'image/png'
      or stored.metadata->>'size' is distinct from asset.byte_size::text)
  )
$$;

create function dm_private.all_india_fixed_ready(p_event_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select exists(
    select 1 from dm_private.all_india_events e
    join dm_private.all_india_paper_sources s on s.paper_key=e.paper_key and s.paper_id=e.paper_id
    join dm_private.papers p on p.id=e.paper_id and p.source_kind='all_india' and not p.published
    where e.id=p_event_id
      and (select count(*) from dm_private.questions q where q.paper_id=p.id)=s.objective_count+s.drawing_count
      and (select count(*) from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id
        where q.paper_id=p.id)=s.objective_count+s.drawing_count
      and dm_private.all_india_paper_media_ready(p.id)
  )
$$;

create function dm_private.all_india_paper_ready(p_event_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select case when exists(select 1 from dm_private.all_india_events where id=p_event_id and paper_key is not null)
    then dm_private.all_india_fixed_ready(p_event_id) else dm_private.all_india_parallel_ready(p_event_id) end
$$;

-- 4. Service-only staging from a private plan (scripts/all-india-paper.mjs).
create function public.stage_all_india_paper(p_plan jsonb,p_plan_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
#variable_conflict use_variable
declare
  existing dm_private.all_india_paper_sources;
  paper_key text:=p_plan->>'paperKey';
  exam_code text:=p_plan->>'exam';
  question jsonb;
  runtime jsonb;
  kind text;
  paper_id uuid;
  question_id uuid;
  ordinal integer:=0;
  objective_count integer:=0;
  drawing_count integer:=0;
  total_marks numeric:=0;
  manifest text;
  grace integer;
  expected_key text;
  expected_type text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_plan_sha256 is null or p_plan_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Exact plan digest required'; end if;
  if jsonb_typeof(p_plan) is distinct from 'object' or p_plan->>'format' is distinct from 'dmocks-all-india-paper-v1'
    or paper_key is null or paper_key !~ '^(uceed|ceed|nid|nift)(-(bdes|mdes))?-aim-[1-9][0-9]{0,2}$'
    or exam_code is null or paper_key not like exam_code||'-%'
    or coalesce(char_length(btrim(p_plan->>'title')),0) not between 5 and 140
    or jsonb_typeof(p_plan->'durationSeconds') is distinct from 'number'
    or (p_plan->>'durationSeconds')::numeric not between 900 and 21600
    or jsonb_typeof(p_plan->'uploadGraceSeconds') is distinct from 'number'
    or jsonb_typeof(p_plan->'questions') is distinct from 'array'
    or jsonb_array_length(p_plan->'questions') not between 1 and 100 then
    raise exception 'Invalid All India paper plan';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('all-india-paper:'||paper_key,33));
  select * into existing from dm_private.all_india_paper_sources s where s.paper_key=p_plan->>'paperKey';
  if found then
    if existing.plan_sha256<>p_plan_sha256 then raise exception 'This All India paper is already staged with a different plan'; end if;
    return jsonb_build_object('paperKey',existing.paper_key,'paperId',existing.paper_id,'manifestSha256',existing.manifest_sha256,
      'objectiveCount',existing.objective_count,'drawingCount',existing.drawing_count,'totalMarks',existing.total_marks,'reused',true);
  end if;
  grace:=(p_plan->>'uploadGraceSeconds')::integer;
  if (select count(*) from jsonb_array_elements(p_plan->'questions') q where q#>>'{runtime,kind}'='drawing')>0 then
    if grace not between 600 and 900 then raise exception 'Invalid All India upload window'; end if;
  elsif grace<>0 then raise exception 'Invalid All India upload window';
  end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind,upload_grace_seconds)
    values(btrim(p_plan->>'title'),exam_code,(p_plan->>'durationSeconds')::integer,false,true,true,'all_india',grace)
    returning id into paper_id;
  for question in select value from jsonb_array_elements(p_plan->'questions') loop
    ordinal:=ordinal+1;
    runtime:=question->'runtime';
    kind:=runtime->>'kind';
    expected_key:=paper_key||'-'||(case kind when 'drawing' then 'b' else 'q' end)||(question->>'number');
    expected_type:=(case kind when 'drawing' then 'DESCRIPTIVE' else upper(kind) end);
    if question->>'externalKey' is distinct from expected_key
      or question->>'contentSha256' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(question->'payload') is distinct from 'object'
      or question->'payload'->'holds' is distinct from '[]'::jsonb
      or question#>>'{payload,sourceKind}' is distinct from 'original'
      or question#>>'{payload,licence}' is distinct from 'dmocks-original'
      or question#>>'{payload,provenance,kind}' is distinct from 'all-india-mock'
      or question#>>'{payload,provenance,paperId}' is distinct from paper_key
      or question->>'questionType' is distinct from expected_type
      or coalesce(char_length(btrim(question->>'topic')),0) not between 2 and 80
      or jsonb_typeof(runtime) is distinct from 'object' or kind not in('mcq','msq','nat','drawing')
      or coalesce(char_length(btrim(runtime->>'prompt')),0) not between 5 and 20000
      or jsonb_typeof(runtime->'options') is distinct from 'array' or jsonb_typeof(runtime->'media') is distinct from 'array'
      or jsonb_typeof(runtime->'marking') is distinct from 'object'
      or jsonb_typeof(runtime->'points') is distinct from 'number' or (runtime->>'points')::numeric not between 0.01 and 100
      or jsonb_typeof(runtime->'negativePoints') is distinct from 'number' or (runtime->>'negativePoints')::numeric not between 0 and 100
      or (runtime#>>'{marking,correct}')::numeric is distinct from (runtime->>'points')::numeric
      or (runtime#>>'{marking,wrong}')::numeric is distinct from -(runtime->>'negativePoints')::numeric
      or runtime#>>'{key,kind}' is distinct from kind
      or runtime#>>'{key,sourceExternalKey}' is distinct from question->>'externalKey'
      or coalesce(char_length(btrim(runtime->>'explanation')),0) not between 20 and 20000 then
      raise exception 'Invalid All India question % in the plan',ordinal;
    end if;
    if kind='drawing' then
      if runtime#>'{marking,humanReview}' is distinct from 'true'::jsonb or jsonb_array_length(runtime->'options')<>0
        or (runtime->>'negativePoints')::numeric<>0 then
        raise exception 'Invalid All India drawing task % in the plan',ordinal;
      end if;
      drawing_count:=drawing_count+1;
    else
      if kind in('mcq','msq') and (jsonb_array_length(runtime->'options') not between 2 and 8 or exists(
          select 1 from jsonb_array_elements(runtime->'options') o where jsonb_typeof(o->'id') is distinct from 'string'
            or jsonb_typeof(o->'label') is distinct from 'string')
        or jsonb_typeof(runtime#>'{key,correct}') is distinct from 'array' or jsonb_array_length(runtime#>'{key,correct}')=0
        or exists(select 1 from jsonb_array_elements_text(runtime#>'{key,correct}') c
          where not exists(select 1 from jsonb_array_elements(runtime->'options') o where o->>'id'=c))) then
        raise exception 'Invalid All India answer key %',ordinal;
      end if;
      if kind='nat' and (jsonb_typeof(runtime#>'{key,accepted}') is distinct from 'array'
        or jsonb_array_length(runtime#>'{key,accepted}')=0 or jsonb_array_length(runtime->'options')<>0) then
        raise exception 'Invalid All India answer key %',ordinal;
      end if;
      objective_count:=objective_count+1;
    end if;
    if exists(select 1 from jsonb_array_elements(runtime->'media') figure
      where figure->>'path' is distinct from 'papers/canonical/'||(figure->>'sha256')||'.png'
        or not exists(select 1 from dm_private.bank_media_assets a where a.sha256=figure->>'sha256'
          and a.width=(figure->>'width')::integer and a.height=(figure->>'height')::integer)) then
      raise exception 'A figure for question % is not a registered private image',ordinal;
    end if;
    if exists(select 1 from dm_private.bank_questions b where b.external_key=question->>'externalKey') then
      raise exception 'Question % already exists in the bank',ordinal;
    end if;
    -- Bank rows stay inactive: every student pool requires an active row.
    insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,
      owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
      values(question->>'externalKey',question->>'contentSha256',exam_code,question->>'questionType',btrim(question->>'topic'),
        'dmocks-original',kind<>'drawing',true,true,false,question->'payload',runtime,'all-india-plan:'||p_plan_sha256);
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
      values(paper_id,ordinal,runtime->>'prompt',runtime->'options',kind,runtime->'marking',runtime->'media',
        (runtime->>'points')::numeric,(runtime->>'negativePoints')::numeric,btrim(question->>'topic'),true)
      returning id into question_id;
    insert into dm_private.answer_keys(question_id,key,explanation) values(question_id,runtime->'key',runtime->>'explanation');
    total_marks:=total_marks+(runtime->>'points')::numeric;
  end loop;
  if (p_plan->>'totalMarks')::numeric is distinct from total_marks then
    raise exception 'The plan total does not match its questions';
  end if;
  if not dm_private.all_india_paper_media_ready(paper_id) then
    raise exception 'A private figure is missing from storage';
  end if;
  select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(q.ordinal,q.kind,q.prompt,q.options,q.marking,q.media,
      q.points,q.negative_points,q.topic,k.key,k.explanation) order by q.ordinal),'[]')::text,'UTF8')),'hex')
    into manifest from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=paper_id;
  insert into dm_private.all_india_paper_sources(paper_key,exam,paper_id,plan_sha256,manifest_sha256,objective_count,drawing_count,total_marks)
    values(paper_key,exam_code,paper_id,p_plan_sha256,manifest,objective_count,drawing_count,total_marks);
  return jsonb_build_object('paperKey',paper_key,'paperId',paper_id,'manifestSha256',manifest,
    'objectiveCount',objective_count,'drawingCount',drawing_count,'totalMarks',total_marks,'reused',false);
end $$;

-- 5. Admin: list staged papers and schedule one.
create function public.admin_all_india_papers()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'paperKey',s.paper_key,'exam',s.exam,'title',p.title,'durationSeconds',p.duration_seconds,
    'uploadGraceSeconds',p.upload_grace_seconds,'objectiveCount',s.objective_count,'drawingCount',s.drawing_count,
    'totalMarks',s.total_marks,'manifestSha256',s.manifest_sha256,'stagedAt',s.staged_at,
    'eventId',(select e.id from dm_private.all_india_events e where e.paper_key=s.paper_key)
  ) order by s.staged_at desc),'[]') from dm_private.all_india_paper_sources s join dm_private.papers p on p.id=s.paper_id);
end $$;

create function public.admin_schedule_all_india_paper(
  p_paper_key text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,p_results_at timestamptz,
  p_seat_cap integer default null,p_entry text default 'free'
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare source dm_private.all_india_paper_sources;paper dm_private.papers;event_id uuid:=gen_random_uuid();
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select * into source from dm_private.all_india_paper_sources where paper_key=p_paper_key for update;
  if not found then raise exception 'Stage this All India paper first'; end if;
  select * into paper from dm_private.papers where id=source.paper_id;
  perform pg_advisory_xact_lock(hashtextextended(source.exam,30));
  if coalesce(char_length(btrim(p_title)),0) not between 5 and 140 or p_entry is null or p_entry not in('pass','free')
    or (p_seat_cap is not null and p_seat_cap not between 1 and 100000)
    or p_starts_at is null or p_ends_at is null or p_results_at is null then
    raise exception 'Invalid event configuration';
  end if;
  if p_starts_at<=clock_timestamp() then raise exception 'Schedule the event in the future'; end if;
  if p_ends_at>p_starts_at+interval '14 days'
    or p_ends_at<p_starts_at+make_interval(secs=>paper.duration_seconds+paper.upload_grace_seconds+3600) then
    raise exception 'The window must allow a full attempt and last at most 14 days';
  end if;
  if p_results_at<p_ends_at or p_results_at>p_ends_at+interval '30 days' then
    raise exception 'Results must follow the window within 30 days';
  end if;
  if exists(select 1 from dm_private.all_india_events e where e.paper_id=source.paper_id) then
    raise exception 'This All India paper is already scheduled';
  end if;
  if exists(select 1 from dm_private.all_india_events e where e.exam=source.exam and e.results_released_at is null
    and tstzrange(e.starts_at,e.review_ends_at,'[)')&&tstzrange(p_starts_at,p_results_at,'[)')) then
    raise exception 'An event already overlaps this review cycle';
  end if;
  if not dm_private.all_india_paper_media_ready(source.paper_id) then
    raise exception 'A private figure is missing from storage';
  end if;
  insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by,paper_key,seat_cap,entry)
    values(event_id,source.exam,btrim(p_title),source.paper_id,p_starts_at,p_ends_at,p_results_at,auth.uid(),source.paper_key,p_seat_cap,p_entry);
  return event_id;
end $$;

-- Seats may grow, or shrink to no fewer than those already taken.
create function public.admin_set_all_india_seat_cap(p_event_id uuid,p_seat_cap integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare event dm_private.all_india_events;taken integer;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text,32));
  select * into event from dm_private.all_india_events where id=p_event_id for update;
  if not found or event.results_released_at is not null then raise exception 'Event unavailable'; end if;
  taken:=dm_private.all_india_seats_taken(p_event_id);
  if p_seat_cap is not null and (p_seat_cap not between 1 and 100000 or p_seat_cap<taken) then
    raise exception 'The seat cap cannot be below the seats already taken';
  end if;
  update dm_private.all_india_events set seat_cap=p_seat_cap where id=p_event_id;
  return jsonb_build_object('seatCap',p_seat_cap,'seatsTaken',taken);
end $$;

-- 6. Students: reserve a seat before or during the window.
create function dm_private.take_all_india_seat(p_event dm_private.all_india_events,p_user uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if exists(select 1 from dm_private.all_india_registrations where event_id=p_event.id and user_id=p_user) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event.id::text,32));
  if p_event.seat_cap is not null and dm_private.all_india_seats_taken(p_event.id)>=(
      select seat_cap from dm_private.all_india_events where id=p_event.id) then
    raise exception 'All seats for this All India mock are taken';
  end if;
  insert into dm_private.all_india_registrations(event_id,user_id) values(p_event.id,p_user) on conflict do nothing;
end $$;

create function public.register_all_india_event(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare event dm_private.all_india_events;candidate uuid:=auth.uid();
begin
  if candidate is null then raise exception 'Sign in required'; end if;
  select * into event from dm_private.all_india_events where id=p_event_id and results_released_at is null for share;
  if not found then raise exception 'This All India mock is not open'; end if;
  if not exists(select 1 from public.profiles where user_id=candidate and onboarding_completed_at is not null) then
    raise exception 'Complete your verified profile first';
  end if;
  if clock_timestamp()>=dm_private.all_india_last_start(event.id) then
    raise exception 'Registration for this All India mock has closed';
  end if;
  if event.entry='pass' and not exists(select 1 from dm_private.passes p join public.launch_settings s
      on s.singleton and s.environment_mode=p.mode where p.user_id=candidate and p.expires_at>clock_timestamp()) then
    raise exception 'An active pass is required';
  end if;
  perform dm_private.take_all_india_seat(event,candidate);
  return jsonb_build_object('eventId',event.id,'registered',true,'seatCap',event.seat_cap,
    'seatsLeft',case when event.seat_cap is not null then greatest(0,event.seat_cap-dm_private.all_india_seats_taken(event.id)) end);
end $$;

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
  if not dm_private.all_india_paper_ready(event.id) then
    raise exception 'All India paper paused for fresh-question review';
  end if;
  started_at:=clock_timestamp();
  if started_at<event.starts_at or started_at>=event.ends_at-make_interval(secs=>paper.duration_seconds+paper.upload_grace_seconds) then
    raise exception 'There is no full attempt window available';
  end if;
  if event.entry='pass' and not exists(select 1 from dm_private.passes p join public.launch_settings s on s.singleton and s.environment_mode=p.mode
    where p.user_id=candidate and p.expires_at>started_at) then raise exception 'An active pass is required'; end if;
  if not exists(select 1 from public.profiles where user_id=candidate and onboarding_completed_at is not null) then
    raise exception 'Complete your verified profile first';
  end if;
  perform dm_private.take_all_india_seat(event,candidate);
  insert into dm_private.attempts(user_id,paper_id,started_at,deadline)
    values(candidate,paper.id,started_at,started_at+make_interval(secs=>paper.duration_seconds)) returning id into attempt_id;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select attempt_id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=paper.id;
  insert into dm_private.all_india_attempts(event_id,user_id,attempt_id) values(p_event_id,candidate,attempt_id);
  return attempt_id;
end $$;

create or replace function public.all_india_event_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'lastStartAt',timing.last_start,
    'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'uploadGraceSeconds',p.upload_grace_seconds,
    'qualityHeld',held.held,'entry',e.entry,'seatCap',e.seat_cap,
    'seatsLeft',case when e.seat_cap is not null then greatest(0,e.seat_cap-dm_private.all_india_seats_taken(e.id)) end,
    'registered',exists(select 1 from dm_private.all_india_registrations g where g.event_id=e.id and g.user_id=auth.uid()),
    'state',case when e.results_released_at is not null then 'released'
      when held.held then 'paused' when now()<e.starts_at then 'scheduled'
      when now()<timing.last_start then 'open' when now()<e.ends_at then 'closing' else 'review' end,
    'attemptId',ai.attempt_id,
    'result',case when r.attempt_id is not null and e.results_released_at is not null then
      jsonb_build_object('score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias,
        'cohortSize',(select count(*) from dm_private.all_india_results s where s.event_id=e.id),
        'sharing',case when sharing.publication_id is not null and exists(
          select 1 from dm_private.all_india_ranking_top_ten(e.id) t where t.attempt_id=r.attempt_id
        ) then jsonb_build_object('publicationId',sharing.publication_id,'revision',coalesce(c.revision,0),
          'shared',coalesce(c.shared,false),'alias',r.alias) end) end
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e join dm_private.papers p on p.id=e.paper_id
  cross join lateral(select e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds) as last_start) timing
  cross join lateral(select (e.results_released_at is null and (dm_private.paper_quality_held(p.id)
    or not dm_private.all_india_paper_ready(e.id))) as held) held
  left join dm_private.all_india_attempts ai on ai.event_id=e.id and ai.user_id=auth.uid()
  left join dm_private.all_india_results r on r.event_id=e.id and r.user_id=ai.user_id and r.attempt_id=ai.attempt_id
  left join lateral (
    select dm_private.active_all_india_ranking_publication(e.id) as publication_id
    where r.attempt_id is not null and e.results_released_at is not null and exists(
      select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous
    )
  ) sharing on true
  left join dm_private.all_india_ranking_consents c on c.publication_id=sharing.publication_id and c.user_id=r.user_id
  where e.starts_at>now()-interval '90 days');
end $$;

-- Signed-out visitors see the schedule and seats left, never questions.
create function public.public_all_india_upcoming()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,
    'lastStartAt',e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds),
    'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'uploadGraceSeconds',p.upload_grace_seconds,
    'entry',e.entry,'seatCap',e.seat_cap,
    'seatsLeft',case when e.seat_cap is not null then greatest(0,e.seat_cap-dm_private.all_india_seats_taken(e.id)) end
  ) order by e.starts_at,e.id),'[]')
  from (select * from dm_private.all_india_events where results_released_at is null and paper_key is not null
    and ends_at>now() order by starts_at,id limit 8) e
  join dm_private.papers p on p.id=e.paper_id
  where dm_private.all_india_fixed_ready(e.id)
$$;

create or replace function public.admin_all_india_events()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,
    'reviewEndsAt',e.review_ends_at,'resultsReleasedAt',e.results_released_at,
    'attempts',(select count(*) from dm_private.all_india_attempts a where a.event_id=e.id),
    'paperKey',e.paper_key,'entry',e.entry,'seatCap',e.seat_cap,'seatsTaken',dm_private.all_india_seats_taken(e.id),
    'submitted',(select count(*) from dm_private.all_india_attempts a join dm_private.attempts t on t.id=a.attempt_id
      where a.event_id=e.id and t.status='submitted'),
    'paperReady',dm_private.all_india_paper_ready(e.id),
    'pendingDrawingReviews',status.unreviewed,
    'canRelease',e.results_released_at is null and statement_timestamp()>=e.review_ends_at and status.unreviewed=0
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e
  cross join lateral (select dm_private.all_india_unreviewed_drawings(e.id) as unreviewed) status);
end $$;

revoke all on function dm_private.all_india_seats_taken(uuid),dm_private.all_india_last_start(uuid),
  dm_private.all_india_paper_media_ready(uuid),dm_private.all_india_fixed_ready(uuid),dm_private.all_india_paper_ready(uuid),
  dm_private.take_all_india_seat(dm_private.all_india_events,uuid) from public,anon,authenticated,service_role;
revoke all on function public.stage_all_india_paper(jsonb,text) from public,anon,authenticated;
grant execute on function public.stage_all_india_paper(jsonb,text) to service_role;
revoke all on function public.admin_all_india_papers(),
  public.admin_schedule_all_india_paper(text,text,timestamptz,timestamptz,timestamptz,integer,text),
  public.admin_set_all_india_seat_cap(uuid,integer),public.register_all_india_event(uuid) from public,anon;
grant execute on function public.admin_all_india_papers(),
  public.admin_schedule_all_india_paper(text,text,timestamptz,timestamptz,timestamptz,integer,text),
  public.admin_set_all_india_seat_cap(uuid,integer),public.register_all_india_event(uuid) to authenticated;
revoke all on function public.public_all_india_upcoming() from public;
grant execute on function public.public_all_india_upcoming() to anon,authenticated;

commit;
