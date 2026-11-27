begin;

create table dm_private.year_drawing_worker (
  singleton boolean primary key default true check (singleton),
  gatekeeper text not null, scorer text, calibration_sha256 text,
  seen_at timestamptz not null
);
create table dm_private.year_drawing_jobs (
  attempt_id uuid not null, question_id uuid not null,
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id) references dm_private.attempt_items on delete cascade,
  queued_at timestamptz not null default now(),
  lease uuid unique, lease_expires timestamptz, claims smallint not null default 0,
  reevaluated boolean not null default false, result jsonb, calibration_sha256 text,
  check (claims between 0 and 2)
);
create index year_drawing_jobs_pending on dm_private.year_drawing_jobs(queued_at) where result is null;
alter table dm_private.year_drawing_worker enable row level security;
alter table dm_private.year_drawing_jobs enable row level security;
revoke all on dm_private.year_drawing_worker, dm_private.year_drawing_jobs from public, anon, authenticated, service_role;

create function dm_private.enqueue_year_drawings() returns trigger
language plpgsql set search_path = pg_catalog, dm_private as $$
begin
  insert into dm_private.year_drawing_jobs(attempt_id,question_id)
  select i.attempt_id,i.question_id from dm_private.attempt_items i
  where i.attempt_id=new.id and i.kind='drawing' and jsonb_typeof(i.key->'drawing')='object'
    and dm_private.year_drawing_task_selected(i.attempt_id,i.question_id)
    and exists(select 1 from dm_private.drawing_uploads u where u.attempt_id=i.attempt_id and u.question_id=i.question_id and u.student_id=new.user_id)
  on conflict do nothing;
  return new;
end $$;
create trigger enqueue_year_drawing_estimates after update of status on dm_private.attempts
for each row when (old.status='active' and new.status='submitted') execute function dm_private.enqueue_year_drawings();

insert into dm_private.year_drawing_jobs(attempt_id,question_id)
select i.attempt_id,i.question_id from dm_private.attempt_items i join dm_private.attempts a on a.id=i.attempt_id
where a.status='submitted' and i.kind='drawing' and jsonb_typeof(i.key->'drawing')='object'
and dm_private.year_drawing_task_selected(i.attempt_id,i.question_id)
and exists(select 1 from dm_private.drawing_uploads u where u.attempt_id=i.attempt_id and u.question_id=i.question_id and u.student_id=a.user_id);

create or replace function dm_private.year_drawing_estimate(p_attempt_id uuid,p_question_id uuid)
returns jsonb language plpgsql stable set search_path=pg_catalog, dm_private as $$
declare
  job dm_private.year_drawing_jobs;
  worker dm_private.year_drawing_worker;
  estimate jsonb;
  checked jsonb;
begin
  if not exists(select 1 from dm_private.attempts a join dm_private.attempt_items i on i.attempt_id=a.id
    where a.id=p_attempt_id and a.status='submitted' and i.question_id=p_question_id and i.kind='drawing' and i.key ? 'drawing'
    and dm_private.year_drawing_task_selected(i.attempt_id,i.question_id)) then return null; end if;
  if not exists(select 1 from dm_private.drawing_uploads where attempt_id=p_attempt_id and question_id=p_question_id) then
    return jsonb_build_object('status','not_attempted','total',0,'canReevaluate',false);
  end if;
  select * into job from dm_private.year_drawing_jobs where attempt_id=p_attempt_id and question_id=p_question_id;
  select * into worker from dm_private.year_drawing_worker where singleton;
  if job.result is null then
    if worker.seen_at > now() - interval '20 minutes' then estimate := '{"status":"evaluating"}';
    else estimate := '{"status":"awaiting_teacher","flags":[]}'; end if;
  elsif job.result->>'status'='ready' and worker.calibration_sha256 is not null
      and worker.calibration_sha256=job.calibration_sha256 then
    estimate := job.result;
  elsif job.result->>'status'='unavailable' then
    estimate := '{"status":"unavailable","flags":[]}';
  else
    -- A private model label is not student feedback until the model pair is calibrated.
    estimate := '{"status":"awaiting_teacher","flags":[]}';
  end if;
  select jsonb_build_object('score',r.score,'note',coalesce(r.override_reason,r.comments,'')) into checked
    from dm_private.drawing_reviews r where r.attempt_id=p_attempt_id and r.question_id=p_question_id and r.status='released' and r.score is not null;
  return estimate || jsonb_build_object('canReevaluate',coalesce(not job.reevaluated and job.result is not null and
    worker.seen_at > now() - interval '20 minutes' and (estimate->>'status' in ('ready','unavailable') or worker.calibration_sha256 is not null),false))
    || case when checked is null then '{}'::jsonb else jsonb_build_object('override',checked) end;
end $$;

create function public.reevaluate_year_drawing(p_attempt_id uuid,p_question_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog, dm_private as $$
begin
  if auth.uid() is null or not exists(select 1 from dm_private.attempts a where a.id=p_attempt_id and a.user_id=auth.uid() and a.status='submitted') then
    raise exception 'Drawing is unavailable' using errcode='42501';
  end if;
  update dm_private.year_drawing_jobs set result=null,queued_at=now(),claims=0,lease=null,lease_expires=null,reevaluated=true
    where attempt_id=p_attempt_id and question_id=p_question_id and not reevaluated and result is not null
    and dm_private.year_drawing_estimate(p_attempt_id,p_question_id)->>'canReevaluate'='true';
  if not found then raise exception 'Drawing re-evaluation is unavailable' using errcode='55000'; end if;
  return jsonb_build_object('status','evaluating','canReevaluate',false);
end $$;

-- Register the current locally verified evaluation configuration and lease one submitted task.
-- Concurrent workers must use the same configuration. The identity of the checked calibration
-- set changes when either model or the scoring protocol changes.
create function public.service_claim_year_drawing(p_gatekeeper text,p_scorer text,p_calibration_sha256 text)
returns uuid language plpgsql security definer set search_path=pg_catalog, dm_private as $$
declare
  job_token uuid;
  worker dm_private.year_drawing_worker;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_gatekeeper is null or p_gatekeeper !~ '^qwen2[.]5vl:3b@[0-9a-f]{64}$'
    or (p_scorer is not null and p_scorer !~ '^qwen2[.]5vl:7b@[0-9a-f]{64}$')
    or (p_calibration_sha256 is not null and (p_calibration_sha256 !~ '^[0-9a-f]{64}$' or p_scorer is null)) then
    raise exception 'Invalid local drawing worker configuration' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('year-drawing-worker-configuration',0));
  select * into worker from dm_private.year_drawing_worker where singleton for update;
  if found and (worker.gatekeeper,worker.scorer,worker.calibration_sha256) is distinct from
      (p_gatekeeper,p_scorer,p_calibration_sha256) and exists (select 1 from dm_private.year_drawing_jobs
        where lease is not null and result is null and lease_expires > clock_timestamp()) then
    raise exception 'Current drawing worker still has leased tasks' using errcode='55000';
  end if;
  insert into dm_private.year_drawing_worker values(true,p_gatekeeper,p_scorer,p_calibration_sha256,now())
    on conflict(singleton) do update set gatekeeper=excluded.gatekeeper,scorer=excluded.scorer,
      calibration_sha256=excluded.calibration_sha256,seen_at=excluded.seen_at;
  update dm_private.year_drawing_jobs set result='{"status":"unavailable","flags":[]}',lease=null,lease_expires=null
    where result is null and claims=2 and lease_expires <= clock_timestamp();
  with next_job as (
    select attempt_id,question_id from dm_private.year_drawing_jobs where result is null
      and (lease is null or lease_expires <= clock_timestamp()) and claims < 2 order by queued_at,attempt_id,question_id
    limit 1 for update skip locked
  )
  update dm_private.year_drawing_jobs j set lease=gen_random_uuid(),lease_expires=clock_timestamp()+interval '20 minutes',
    claims=claims+1,calibration_sha256=p_calibration_sha256 from next_job n
    where (j.attempt_id,j.question_id)=(n.attempt_id,n.question_id) returning lease into job_token;
  return job_token;
end $$;

-- A later historical elective rule can supply the confirmed alternative separately from autosaved notes.
create function dm_private.year_drawing_alternative(p_attempt_id uuid,p_question_id uuid)
returns jsonb language sql stable set search_path=pg_catalog,dm_private as $$
  select answer->'alternative' from dm_private.attempt_items where attempt_id=p_attempt_id and question_id=p_question_id and kind='drawing'
$$;
revoke all on function dm_private.year_drawing_alternative(uuid,uuid) from public,anon,authenticated,service_role;

create function public.service_year_drawing_context(p_lease uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog, dm_private as $$
declare
  job dm_private.year_drawing_jobs;
  item dm_private.attempt_items;
  page dm_private.drawing_uploads;
  asset dm_private.bank_media_assets;
  owner_id uuid;
  asset_info jsonb;
  pages jsonb := '[]'; figures jsonb := '[]'; receipts jsonb := '[]'; payload jsonb; ordinal integer := 0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into job from dm_private.year_drawing_jobs where lease=p_lease and lease_expires>clock_timestamp() and result is null for update;
  if not found then raise exception 'Drawing lease expired' using errcode='55000'; end if;
  select user_id into strict owner_id from dm_private.attempts where id=job.attempt_id and status='submitted' for share;
  select * into strict item from dm_private.attempt_items where attempt_id=job.attempt_id and question_id=job.question_id and kind='drawing' and key ? 'drawing'
    and dm_private.year_drawing_task_selected(attempt_id,question_id) for share;
  for page in select * from dm_private.drawing_uploads where attempt_id=job.attempt_id and question_id=job.question_id and student_id=owner_id order by ordinal for share loop
    receipts := receipts || jsonb_build_array(dm_private.drawing_advice_object_receipt('drawing-submissions',page.storage_path,page.mime_type,page.byte_size));
    pages := pages || jsonb_build_array(jsonb_build_object('ordinal', page.ordinal,'storagePath',page.storage_path,'mimeType',page.mime_type,
      'byteSize',page.byte_size,'width',page.pixel_width,'height',page.pixel_height,'orientation',page.image_orientation));
  end loop;
  if pages='[]' or jsonb_array_length(pages)>(item.key#>>'{drawing,maxImages}')::integer then raise exception 'Drawing upload inventory changed' using errcode='55000'; end if;
  for asset_info in select value from jsonb_array_elements(item.media) loop
    select * into strict asset from dm_private.bank_media_assets where sha256=asset_info->>'sha256' and storage_path=asset_info->>'path'
      and width::text=asset_info->>'width' and height::text=asset_info->>'height' for share;
    receipts := receipts || jsonb_build_array(dm_private.drawing_advice_object_receipt('paper-media',asset.storage_path,'image/png',asset.byte_size));
    ordinal := ordinal + 1;
    figures := figures || jsonb_build_array(jsonb_build_object('ordinal',ordinal,'mimeType','image/png','storagePath',asset.storage_path,'byteSize',asset.byte_size,
      'width',asset.width,'height',asset.height,'sha256',asset.sha256));
  end loop;
  payload := jsonb_build_object('attemptId',item.attempt_id,'questionId',item.question_id,'prompt',item.prompt,'drawing',item.key->'drawing',
    'alternative',dm_private.year_drawing_alternative(item.attempt_id,item.question_id),'maxScore',item.points,'pages',pages,'figures',figures);
  return payload || jsonb_build_object('contextSha256',encode(sha256(convert_to(jsonb_build_array(payload,receipts)::text,'UTF8')),'hex'));
end $$;

create function public.service_finish_year_drawing(p_lease uuid,p_context_sha256 text,p_result jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog, dm_private as $$
declare
  job dm_private.year_drawing_jobs;
  ctx jsonb;
  task_criterion jsonb;
  row jsonb;
  rows jsonb := '[]';
  flags jsonb := p_result->'flags';
  zeroed boolean;
  total numeric := 0;
  mark numeric;
  outcome jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into job from dm_private.year_drawing_jobs where lease=p_lease and result is null and lease_expires>clock_timestamp() for update;
  if not found then return false; end if;
  if jsonb_typeof(flags) is distinct from 'array' or not (flags <@ '["blank","not_a_drawing","off_task","illegible","uses_colour_when_forbidden","text_explanation_when_forbidden"]'::jsonb)
    or jsonb_array_length(flags)<>(select count(distinct value) from jsonb_array_elements_text(flags)) then
    raise exception 'Invalid drawing flags' using errcode='22023';
  end if;
  if p_result->>'status' in ('awaiting_teacher','ready') or flags<>'[]' then
    ctx := public.service_year_drawing_context(p_lease);
    if p_context_sha256 is distinct from ctx->>'contextSha256' then raise exception 'Drawing evidence changed' using errcode='40001'; end if;
  end if;
  outcome := jsonb_build_object('status',p_result->'status','flags',flags);
  if p_result->>'status'='ready' then
    if job.calibration_sha256 is null or jsonb_typeof(p_result->'criteria') is distinct from 'array'
      or jsonb_array_length(p_result->'criteria')<>jsonb_array_length(ctx#>'{drawing,criteria}')
      or jsonb_typeof(p_result->'summary') is distinct from 'string' or length(trim(p_result->>'summary')) not between 1 and 1200 then
      raise exception 'A calibrated and complete drawing estimate is required' using errcode='22023';
    end if;
    zeroed := flags ?| array['blank','not_a_drawing','off_task'];
    for task_criterion in select value from jsonb_array_elements(ctx#>'{drawing,criteria}') loop
      select value into strict row from jsonb_array_elements(p_result->'criteria') where value->>'id'=task_criterion->>'id';
      if jsonb_typeof(row->'score') is distinct from 'number' or jsonb_typeof(row->'reason') is distinct from 'string' or
        length(trim(row->>'reason')) not between 1 and 600 then raise exception 'Invalid criterion estimate' using errcode='22023'; end if;
      mark := case when zeroed then 0 else greatest(0,least((task_criterion->>'max')::numeric,round((row->>'score')::numeric*2)/2)) end;
      rows := rows || jsonb_build_array(jsonb_build_object('id',task_criterion->'id','score',mark,'reason',row->'reason'));
      total := total+mark;
    end loop;
    outcome := outcome || jsonb_build_object('criteria',rows,'total',total,'summary',p_result->'summary');
  elsif coalesce(p_result->>'status','') not in ('unavailable','awaiting_teacher') then
    raise exception 'Invalid drawing outcome' using errcode='22023';
  end if;
  update dm_private.year_drawing_jobs set result=outcome,lease=null,lease_expires=null where lease=p_lease;
  return true;
end $$;
revoke all on function dm_private.year_drawing_estimate(uuid,uuid), dm_private.enqueue_year_drawings() from public,anon,authenticated,service_role;
revoke all on function public.reevaluate_year_drawing(uuid,uuid) from public,anon,service_role;
grant execute on function public.reevaluate_year_drawing(uuid,uuid) to authenticated;
revoke all on function public.service_claim_year_drawing(text,text,text),public.service_year_drawing_context(uuid),
  public.service_finish_year_drawing(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.service_claim_year_drawing(text,text,text),public.service_year_drawing_context(uuid),
  public.service_finish_year_drawing(uuid,text,jsonb) to service_role;
commit;
