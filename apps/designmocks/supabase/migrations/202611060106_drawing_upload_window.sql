alter table dm_private.papers
  add column upload_grace_seconds integer not null default 0
  check(upload_grace_seconds=0 or upload_grace_seconds between 600 and 900);

create or replace function public.admin_set_paper_upload_grace(p_paper_id uuid,p_seconds integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_seconds<>0 and p_seconds not between 600 and 900 then raise exception 'Upload grace must be 10 to 15 minutes'; end if;
  if exists(select 1 from dm_private.attempts where paper_id=p_paper_id) then raise exception 'Upload rules are frozen after the first attempt'; end if;
  update dm_private.papers p set upload_grace_seconds=p_seconds
    where p.id=p_paper_id and (p_seconds=0 or exists(select 1 from dm_private.questions q where q.paper_id=p.id and q.kind='drawing'));
  if not found then raise exception 'Drawing paper not found'; end if;
end $$;

create or replace function public.submit_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;v_grace integer;
begin
  select * into a from dm_private.attempts where id=p_id and user_id=auth.uid() for update;
  if a.id is null then raise exception 'Attempt not found'; end if;
  if a.status='active' then
    select upload_grace_seconds into v_grace from dm_private.papers where id=a.paper_id;
    update dm_private.attempts set status='submitted',submitted_at=least(now(),a.deadline),
    upload_deadline=case when v_grace>0 and exists(select 1 from dm_private.attempt_items i where i.attempt_id=a.id and i.kind='drawing') then a.deadline+make_interval(secs=>v_grace) else a.upload_deadline end,
    score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=a.id),
    total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else(marking->>'correct')::numeric end),0) from dm_private.attempt_items where attempt_id=a.id) where id=a.id;
  end if;
  return public.read_attempt(a.id);
end $$;

create or replace function public.register_drawing_upload(p_attempt_id uuid,p_question_id uuid,p_storage_path text,p_ordinal integer,p_mime_type text,p_byte_size integer)returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;v uuid;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  select*into a from dm_private.attempts where id=p_attempt_id for update;
  if a.id is null or coalesce(a.upload_deadline,a.deadline)<now()then raise exception'Upload window closed';end if;
  if exists(select 1 from dm_private.drawing_reviews where attempt_id=a.id and question_id=p_question_id and status in('reviewed','released'))then raise exception'Review already completed';end if;
  if not exists(select 1 from dm_private.attempt_items where attempt_id=a.id and question_id=p_question_id and kind='drawing')then raise exception'Drawing question not found';end if;
  insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size)values(a.id,p_question_id,a.user_id,p_storage_path,p_ordinal,p_mime_type,p_byte_size)returning id into v;
  if a.status='submitted'then insert into dm_private.drawing_reviews(attempt_id,question_id)values(a.id,p_question_id)on conflict(attempt_id,question_id)do nothing;end if;
  return v;
end$$;

create or replace function public.remove_drawing_upload(p_id uuid)returns text language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v text;v_attempt uuid;v_question uuid;
begin
  delete from dm_private.drawing_uploads u where u.id=p_id and u.student_id=auth.uid()
    and exists(select 1 from dm_private.attempts a where a.id=u.attempt_id and coalesce(a.upload_deadline,a.deadline)>now())
    and not exists(select 1 from dm_private.drawing_reviews r where r.attempt_id=u.attempt_id and r.question_id=u.question_id and r.status in('reviewed','released'))
    returning storage_path,attempt_id,question_id into v,v_attempt,v_question;
  if v is null then raise exception'Upload unavailable';end if;
  delete from dm_private.drawing_reviews r where r.attempt_id=v_attempt and r.question_id=v_question and r.status in('pending','assigned')
    and not exists(select 1 from dm_private.drawing_uploads u where u.attempt_id=v_attempt and u.question_id=v_question);
  return v;
end$$;

create or replace function public.read_attempt(p_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;items jsonb;v_pending boolean;v_review_ends_at timestamptz;
begin
  select*into a from dm_private.attempts where id=p_id and user_id=auth.uid();if a.id is null then raise exception'Attempt not found';end if;
  select e.results_released_at is null,e.review_ends_at into v_pending,v_review_ends_at from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id;
  v_pending:=coalesce(v_pending,false)and a.status='submitted';
  select coalesce(jsonb_agg(jsonb_build_object('id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt,'options',i.options,'topic',i.topic,'answer',i.answer,'points',i.points,'negativePoints',i.negative_points,'marking',i.marking,'kind',i.kind,'media',i.media)||case when a.status='submitted'and not v_pending then jsonb_build_object('correctKey',i.key,'explanation',i.explanation,'outcome',(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking)))else'{}'::jsonb end||case when a.status='submitted'and i.kind='drawing'then jsonb_build_object('drawingReview',coalesce((select case when r.status='released'then jsonb_build_object('status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at)else jsonb_build_object('status','pending')end from dm_private.drawing_reviews r where r.attempt_id=i.attempt_id and r.question_id=i.question_id),jsonb_build_object('status','not_submitted')))else'{}'::jsonb end order by i.ordinal),'[]')into items from dm_private.attempt_items i where i.attempt_id=a.id;
  return jsonb_build_object('title',(select title from dm_private.papers where id=a.paper_id),'id',a.id,'status',a.status,'deadline',a.deadline,'uploadDeadline',a.upload_deadline,'serverNow',now(),'score',case when v_pending then null else a.score end,'total',case when v_pending then null else a.total end,'resultsPending',v_pending,'reviewEndsAt',v_review_ends_at,'questions',case when v_pending then'[]'::jsonb else items end);
end$$;

revoke all on function public.admin_set_paper_upload_grace(uuid,integer) from public,anon;
grant execute on function public.admin_set_paper_upload_grace(uuid,integer) to authenticated;
