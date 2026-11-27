-- Drawing plans are versioned separately from reviewed objective manifests.
-- The shadow paper supplies stable FK targets without changing released content.
create table dm_private.year_drawing_versions (
  id uuid primary key references dm_private.papers(id),
  paper_id uuid not null references dm_private.year_paper_releases(paper_id),
  objective_manifest text not null,
  drawing_digest text not null check(drawing_digest ~ '^[a-f0-9]{64}$'),
  duration_seconds integer not null check(duration_seconds between 60 and 21600),
  grace_seconds integer not null check(grace_seconds between 600 and 900),
  marks numeric not null check(marks > 0),
  sections jsonb not null,
  active boolean not null default false,
  unique(paper_id,objective_manifest,drawing_digest)
);
create unique index year_drawing_active on dm_private.year_drawing_versions(paper_id) where active;
alter table dm_private.year_drawing_versions enable row level security;
revoke all on dm_private.year_drawing_versions from public,anon,authenticated,service_role;
alter table dm_private.attempts add column year_drawing_version uuid references dm_private.year_drawing_versions(id);

-- Historical papers with a separate session or an elective section need
-- distinct rules. They remain ineligible until their rule is implemented.
create function dm_private.year_drawing_duration_ok(doc jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
  select doc->>'timer'='shared' and (doc->>'durationSeconds')::integer=10800
$$;
revoke all on function dm_private.year_drawing_duration_ok(jsonb) from public,anon,authenticated,service_role;
create function dm_private.year_drawing_choice_plan_ok(doc jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
  select not exists(select from jsonb_array_elements(doc->'sections') s where s->'chooseOne'='true'::jsonb)
    and not exists(select from jsonb_array_elements(doc->'items') t where t#>'{drawing,alternatives}' is not null)
$$;
create function dm_private.year_drawing_task_selected(p_attempt_id uuid,p_question_id uuid) returns boolean
language sql stable set search_path=pg_catalog as $$ select true $$;
create function dm_private.year_drawing_session_open(p_attempt_id uuid,p_question_id uuid) returns boolean
language sql stable set search_path=pg_catalog as $$ select true $$;
create function dm_private.year_drawing_choice_fields(p_attempt_id uuid,p_question_id uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$ select '{}'::jsonb $$;
revoke all on function dm_private.year_drawing_choice_plan_ok(jsonb),dm_private.year_drawing_task_selected(uuid,uuid),
  dm_private.year_drawing_session_open(uuid,uuid),dm_private.year_drawing_choice_fields(uuid,uuid)
  from public,anon,authenticated,service_role;

create function dm_private.install_year_drawing_sidecar(doc jsonb, reviewed_objective text) returns uuid
language plpgsql set search_path=pg_catalog,dm_private,public as $$
declare
  rel dm_private.year_paper_releases; version_id uuid; task jsonb; source dm_private.bank_questions;
  media_items jsonb; qid uuid; task_ordinal integer:=0; asset jsonb; media_item dm_private.bank_media_assets;
begin
  if not exists(select from public.launch_settings where singleton and environment_mode='test' and not sales_enabled) then
    raise exception 'Drawing installation requires the designated Test backend with sales closed'; end if;
  select * into strict rel from dm_private.year_paper_releases where source_paper_id=doc->>'sourcePaperId'
    and exam=doc->>'exam' and paper_year=(doc->>'year')::integer and review_sha256=reviewed_objective for update;
  perform dm_private.lock_year_paper(rel.paper_id);
  if not dm_private.year_paper_ready(rel.paper_id) then raise exception 'Objective release changed'; end if;
  if doc->'supported' is distinct from 'true'::jsonb or dm_private.year_drawing_duration_ok(doc) is not true
     or (doc->>'uploadGraceSeconds')::integer<>600 or jsonb_array_length(doc->'items') not between 1 and 40
     or not dm_private.year_drawing_choice_plan_ok(doc) then
     raise exception 'Unsupported drawing plan'; end if;
  select id into version_id from dm_private.year_drawing_versions where paper_id=rel.paper_id
    and objective_manifest=reviewed_objective and drawing_digest=doc->>'digest';
  if version_id is null then
    insert into dm_private.papers(title,exam,duration_seconds) values('Private drawing section',rel.exam,(doc->>'durationSeconds')::integer) returning id into version_id;
    insert into dm_private.year_drawing_versions(id,paper_id,objective_manifest,drawing_digest,duration_seconds,grace_seconds,marks,sections)
      values(version_id,rel.paper_id,reviewed_objective,doc->>'digest',(doc->>'durationSeconds')::integer,600,(doc->>'drawingMarksTotal')::numeric,doc->'sections');
    for task in select value from jsonb_array_elements(doc->'items') loop
      task_ordinal:=task_ordinal+1;
      select * into strict source from dm_private.bank_questions where external_key=task->>'externalKey' for share;
      if not source.active or source.question_type<>'DESCRIPTIVE' or source.exam<>rel.exam
        or source.payload#>>'{provenance,paperId}' is distinct from rel.source_paper_id
        or source.payload->'holds' is distinct from '[]'::jsonb or source.content_sha256 is distinct from task->>'contentSha256'
        or exists(select from dm_private.bank_local_holds where external_key=source.external_key)
        or source.payload->'taskMarks' is distinct from task#>'{marking,max}'
        or source.payload->'assets' is distinct from task->'assets'
        or task->'prompt' is distinct from source.payload->'prompt' or task->'explanation' is distinct from source.payload->'explanation'
        or jsonb_typeof(task#>'{drawing,criteria}') is distinct from 'array'
        or (task#>>'{drawing,maxImages}')::integer not between 1 and 5 then raise exception 'Drawing source changed at task %',task_ordinal; end if;
      media_items:='[]';
      for asset in select value from jsonb_array_elements(task->'assets') loop
        select a.* into strict media_item from dm_private.bank_media_assets a join storage.objects o on o.name=a.storage_path
          and o.bucket_id='paper-media' and o.metadata->>'mimetype'='image/png' and o.metadata->>'size'=a.byte_size::text
          join storage.buckets b on b.id=o.bucket_id and b.public=false
          where a.sha256=asset->>'sha256' and a.width=(asset->>'width')::int and a.height=(asset->>'height')::int for share of a,o,b;
        media_items:=media_items||jsonb_build_array(jsonb_build_object('path',media_item.storage_path,'sha256',media_item.sha256,
          'width',media_item.width,'height',media_item.height,'alt','Drawing task figure'));
      end loop;
      insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,topic,reviewed)
        values(version_id,task_ordinal,source.payload->>'prompt','[]','drawing',task->'marking',media_items,
          (task#>>'{marking,max}')::numeric,source.topic,true) returning id into qid;
      insert into dm_private.answer_keys(question_id,key,explanation) values(qid,jsonb_build_object('kind','drawing',
        'label','TASK B'||task_ordinal,'externalKey',source.external_key,'contentSha256',source.content_sha256,'drawing',task->'drawing'),source.payload->>'explanation');
    end loop;
  end if;
  update dm_private.year_drawing_versions set active=false where paper_id=rel.paper_id and id<>version_id and active;
  update dm_private.year_drawing_versions set active=true where id=version_id and not active;
  return version_id;
end $$;
revoke all on function dm_private.install_year_drawing_sidecar(jsonb,text) from public,anon,authenticated,service_role;

create function dm_private.year_drawing_estimate(p_attempt_id uuid,p_question_id uuid) returns jsonb
language sql stable set search_path=pg_catalog,dm_private as $$
  select jsonb_build_object('status',case when exists(select from dm_private.drawing_uploads
    where attempt_id=p_attempt_id and question_id=p_question_id) then 'awaiting_teacher' else 'not_attempted' end)
$$;
revoke all on function dm_private.year_drawing_estimate(uuid,uuid) from public,anon,authenticated,service_role;

create function dm_private.year_drawing_ready(version_id uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
  select exists(select from dm_private.questions q where q.paper_id=version_id)
    and not exists(select from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id
      left join dm_private.bank_questions b on b.external_key=k.key->>'externalKey'
      where q.paper_id=version_id and (b.external_key is null or not b.active
        or b.content_sha256 is distinct from k.key->>'contentSha256'
        or exists(select from dm_private.bank_local_holds h where h.external_key=b.external_key)
        or exists(select from jsonb_array_elements(q.media) m where not exists(
          select from dm_private.bank_media_assets a join storage.objects o on o.bucket_id='paper-media' and o.name=a.storage_path
          join storage.buckets bucket on bucket.id=o.bucket_id and not bucket.public
          where a.sha256=m->>'sha256' and a.storage_path=m->>'path' and o.metadata->>'mimetype'='image/png'
            and o.metadata->>'size'=a.byte_size::text))))
$$;
revoke all on function dm_private.year_drawing_ready(uuid) from public,anon,authenticated,service_role;

-- Enforce the authored page cap at commit too, including simultaneous requests.
create function dm_private.year_drawing_upload_limit() returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
begin
  if not dm_private.year_drawing_task_selected(new.attempt_id,new.question_id)
    or not dm_private.year_drawing_session_open(new.attempt_id,new.question_id) then raise exception 'Choose an open drawing task first'; end if;
  if new.ordinal > (select (i.key#>>'{drawing,maxImages}')::int from dm_private.attempt_items i
    where i.attempt_id=new.attempt_id and i.question_id=new.question_id) then raise exception 'Drawing task image limit reached'; end if;
  return new;
end $$;
create trigger year_drawing_upload_limit before insert on dm_private.drawing_uploads
for each row execute function dm_private.year_drawing_upload_limit();

create or replace function public.start_free_year_paper(p_paper_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_paper dm_private.papers;v_attempt uuid;v_started timestamptz; sidecar dm_private.year_drawing_versions;
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  perform dm_private.lock_year_paper(p_paper_id);
  if not dm_private.year_paper_ready(p_paper_id) then raise exception 'Year paper is not released';end if;
  select * into v_paper from dm_private.papers where id=p_paper_id;
  select id into v_attempt from dm_private.attempts
    where user_id=auth.uid() and paper_id=p_paper_id and status='active' and (deadline>clock_timestamp() or (year_drawing_version is not null and upload_deadline>clock_timestamp()))
    order by started_at desc limit 1;
  if v_attempt is not null then return v_attempt;end if;
  if (select count(*) from dm_private.attempts where user_id=auth.uid() and status='active'
      and deadline>clock_timestamp())>=3 then raise exception 'Finish an active attempt before starting another';end if;
  select v.* into sidecar from dm_private.year_drawing_versions v join dm_private.year_paper_releases r
    on r.paper_id=v.paper_id and r.review_sha256=v.objective_manifest where v.active and v.paper_id=p_paper_id for share of v;
  if sidecar.id is not null and not dm_private.year_drawing_ready(sidecar.id) then
    raise exception 'Drawing section is being reviewed'; end if;
  v_started:=clock_timestamp();
  insert into dm_private.attempts(user_id,paper_id,started_at,deadline,upload_deadline,year_drawing_version)
    values(auth.uid(),p_paper_id,v_started,v_started+make_interval(secs=>coalesce(sidecar.duration_seconds,v_paper.duration_seconds)),
      v_started+make_interval(secs=>sidecar.duration_seconds+sidecar.grace_seconds),sidecar.id)
    returning id into v_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select v_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p_paper_id;
  if sidecar.id is not null then
    insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
      select v_attempt,q.id,q.ordinal+(select count(*) from dm_private.questions where paper_id=p_paper_id),q.prompt,q.options,
        q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation from dm_private.questions q
        join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=sidecar.id order by q.ordinal;
  end if;
  return v_attempt;
end$$;

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
  visible_score numeric;
  visible_total numeric;
begin
  select * into attempt from dm_private.attempts where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Attempt not found'; end if;
  if attempt.status='active' and attempt.deadline<=clock_timestamp() then
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
      'answerRevision',i.answer_revision,
      'points',i.points,'negativePoints',i.negative_points,'marking',i.marking,'kind',i.kind,'media',i.media
    )||case when i.key ? 'drawing' and attempt.year_drawing_version is not null then jsonb_build_object(
      'drawing',i.key->'drawing','label',i.key->'label')||dm_private.year_drawing_choice_fields(i.attempt_id,i.question_id)||case when attempt.status='submitted' then jsonb_build_object(
      'drawingEstimate',dm_private.year_drawing_estimate(i.attempt_id,i.question_id)) else '{}'::jsonb end else '{}'::jsonb end
    ||case when attempt.status='submitted' and not exam_pending then (
      select jsonb_build_object('correctKey',i.key,'explanation',i.explanation,'outcome',grade.outcome,'awarded',grade.marks)
      from dm_private.score_response(i.kind,i.key,i.answer,i.marking) grade
    ) else '{}'::jsonb end||case when attempt.status='submitted' and i.kind='drawing' then jsonb_build_object(
      'drawingReview',case when r.status='released' and not exam_pending then jsonb_build_object(
        'status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at
      ) when r.id is not null then '{"status":"pending"}'::jsonb else '{"status":"not_submitted"}'::jsonb end
    ) else '{}'::jsonb end order by i.ordinal),'[]') into questions
    from dm_private.attempt_items i left join dm_private.drawing_reviews r
      on r.attempt_id=i.attempt_id and r.question_id=i.question_id where i.attempt_id=p_id;
  end if;
  select v.score,v.total into visible_score,visible_total
    from dm_private.student_attempt_visibility(auth.uid()) v where v.id=p_id;
  return jsonb_build_object(
    'title',(select title from dm_private.papers where id=attempt.paper_id),
    'id',attempt.id,'status',attempt.status,'deadline',attempt.deadline,'uploadDeadline',attempt.upload_deadline,
    'yearDrawing',case when attempt.year_drawing_version is not null then (select jsonb_build_object(
      'maxMarks',v.marks,'sections',v.sections) from dm_private.year_drawing_versions v where v.id=attempt.year_drawing_version) end,
    'serverNow',clock_timestamp(),'reviewEndsAt',event.review_ends_at,'resultsPending',event_pending,'examResultsPending',exam_pending,
    'score',case when not(event_pending or exam_pending) then visible_score end,
    'total',case when not(event_pending or exam_pending) then visible_total end,
    'scoreKind',case when event.id is not null then 'all_india'
      when (select p.source_kind='exam_part_b' from dm_private.papers p where p.id=attempt.paper_id) then 'drawing'
      else 'objective' end,
    'cohortResult',case when standing.attempt_id is not null then jsonb_build_object(
      'rank',standing.rank,'objectiveScore',attempt.score,'objectiveTotal',attempt.total,
      'drawingScore',standing.score-attempt.score,'drawingTotal',standing.total-attempt.total
    ) end,'questions',questions,'drawingUploadTasks',upload_tasks
  );
end $$;

create or replace function dm_private.finalize_attempt(p_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts;
  grace_seconds integer;
begin
  select * into attempt from dm_private.attempts where id=p_id for update;
  if not found or attempt.status<>'active' then return false; end if;
  if attempt.year_drawing_version is not null and attempt.upload_deadline>clock_timestamp() then return false; end if;
  select upload_grace_seconds into grace_seconds from dm_private.papers where id=attempt.paper_id;
  update dm_private.attempts set status='submitted',submitted_at=least(clock_timestamp(),case when attempt.year_drawing_version is not null then attempt.upload_deadline else attempt.deadline end),
    upload_deadline=case when grace_seconds>0 and exists(select 1 from dm_private.attempt_items i
      where i.attempt_id=attempt.id and i.kind='drawing') then attempt.deadline+make_interval(secs=>grace_seconds) else attempt.upload_deadline end,
    score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i
      cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=attempt.id),
    total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else (marking->>'correct')::numeric end),0)
      from dm_private.attempt_items where attempt_id=attempt.id)
    where id=attempt.id;
  return true;
end $$;

create or replace function public.submit_attempt(p_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_finalized boolean;
begin
  if not exists(select 1 from dm_private.attempts where id=p_id and user_id=auth.uid())then raise exception'Attempt not found';end if;
  update dm_private.attempts set upload_deadline=least(clock_timestamp(),upload_deadline)
    where id=p_id and user_id=auth.uid() and status='active' and year_drawing_version is not null;
  v_finalized:=dm_private.finalize_attempt(p_id);
  if v_finalized then perform dm_private.consume_attempt_rate(auth.uid(),'submit',10,interval '1 hour'); end if;
  return public.read_attempt(p_id);
end$$;

create or replace function public.finalize_my_expired_attempts()returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_id uuid;v_count integer:=0;
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  for v_id in select id from dm_private.attempts where user_id=auth.uid()and status='active'and (case when year_drawing_version is not null then upload_deadline else deadline end)<=now()order by deadline limit 100
  loop if dm_private.finalize_attempt(v_id)then v_count:=v_count+1;end if;end loop;
  return v_count;
end$$;

create or replace function public.finalize_expired_attempts(p_limit integer default 500)returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_id uuid;v_count integer:=0;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  if p_limit not between 1 and 2000 then raise exception'Invalid batch size';end if;
  for v_id in select id from dm_private.attempts where status='active'and (case when year_drawing_version is not null then upload_deadline else deadline end)<=now()order by deadline limit p_limit
  loop if dm_private.finalize_attempt(v_id)then v_count:=v_count+1;end if;end loop;
  return v_count;
end$$;

create or replace function public.free_year_paper_catalog() returns jsonb
language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('paperId',r.paper_id,'exam',r.exam,
    'year',r.paper_year,'sourcePaperId',r.source_paper_id,'partLabel',case when v.id is null then r.part_label else r.part_label||' + drawing' end,
    'questionCount',r.question_count+(select count(*) from dm_private.questions q where q.paper_id=v.id),
    'durationSeconds',coalesce(v.duration_seconds,p.duration_seconds))
    order by r.exam,r.paper_year desc,r.source_paper_id,r.part_label),'[]'::jsonb)
  from dm_private.year_paper_releases r join dm_private.papers p on p.id=r.paper_id
  left join dm_private.year_drawing_versions v on v.paper_id=r.paper_id and v.objective_manifest=r.review_sha256 and v.active
  where dm_private.year_paper_ready(r.paper_id) and (v.id is null or dm_private.year_drawing_ready(v.id))
$$;

create or replace function public.can_upload_drawing(p_attempt_id uuid,p_question_id uuid,p_ordinal integer)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select p_ordinal between 1 and 5 and exists(
    select 1 from dm_private.attempts a
    join dm_private.attempt_items i on i.attempt_id=a.id
    where a.id=p_attempt_id and a.user_id=auth.uid() and i.question_id=p_question_id and i.kind='drawing'
      and dm_private.year_drawing_task_selected(a.id,i.question_id) and dm_private.year_drawing_session_open(a.id,i.question_id)
      and p_ordinal<=coalesce((i.key#>>'{drawing,maxImages}')::int,5)
      and dm_private.drawing_upload_cutoff(a)>statement_timestamp()
      and not exists(select 1 from dm_private.drawing_uploads u
        where u.attempt_id=a.id and u.question_id=i.question_id and u.ordinal=p_ordinal)
      and not exists(select 1 from dm_private.drawing_reviews r
        where r.attempt_id=a.id and r.question_id=i.question_id and r.status<>'pending')
  )
$$;

-- Check the final registered row (the service sets pixel metadata after INSERT).
create function dm_private.check_year_drawing_photo() returns trigger language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if exists(select from dm_private.drawing_uploads u join dm_private.attempts a on a.id=u.attempt_id
    where u.id=new.id and a.year_drawing_version is not null and (u.mime_type<>'image/jpeg' or u.pixel_width is null
      or u.pixel_height is null or greatest(u.pixel_width,u.pixel_height)>2000 or u.image_orientation is distinct from 1)) then
    raise exception 'Historical drawing requires an upright JPEG within 2000 pixels';
  end if;
  return null;
end $$;
revoke all on function dm_private.check_year_drawing_photo(),dm_private.year_drawing_upload_limit() from public,anon,authenticated,service_role;
create constraint trigger check_year_drawing_photo after insert or update on dm_private.drawing_uploads
deferrable initially deferred for each row execute function dm_private.check_year_drawing_photo();
