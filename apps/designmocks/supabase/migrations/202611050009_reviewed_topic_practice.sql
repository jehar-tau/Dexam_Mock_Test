alter table dm_private.bank_questions
  add column runtime_payload jsonb,
  add column rights_confirmed boolean not null default false,
  add column review_note text,
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz;

alter table dm_private.bank_questions add constraint bank_runtime_valid check(runtime_payload is null or (jsonb_typeof(runtime_payload)='object' and runtime_payload->>'kind' in ('mcq','msq','nat')));

create table dm_private.bank_question_reviews (
  id bigint generated always as identity primary key,
  external_key text not null references dm_private.bank_questions(external_key),
  reviewer_id uuid not null references auth.users(id),
  approved boolean not null,
  rights_confirmed boolean not null,
  note text,
  created_at timestamptz not null default now()
);
alter table dm_private.bank_question_reviews enable row level security;
revoke all on dm_private.bank_question_reviews from anon,authenticated;

create or replace function dm_private.reset_bank_review_on_change() returns trigger language plpgsql set search_path='' as $$
begin
  if old.content_sha256 is distinct from new.content_sha256 then new.owner_approved:=false; new.rights_confirmed:=false; new.runtime_payload:=null; new.reviewed_by:=null; new.reviewed_at:=null; end if;
  return new;
end $$;
create trigger reset_bank_review before update on dm_private.bank_questions for each row execute function dm_private.reset_bank_review_on_change();

create or replace function public.upsert_question_bank_runtime_batch(p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_record jsonb; v_count integer:=0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>200 then raise exception 'Invalid runtime batch'; end if;
  for v_record in select value from jsonb_array_elements(p_records) loop
    if v_record->'runtime' is not null and v_record->'runtime'<>'null'::jsonb and (jsonb_typeof(v_record->'runtime')<>'object' or v_record->'runtime'->>'kind' not in ('mcq','msq','nat') or jsonb_typeof(v_record->'runtime'->'key')<>'object') then raise exception 'Invalid runtime question'; end if;
    update dm_private.bank_questions set runtime_payload=nullif(v_record->'runtime','null'::jsonb),objective_ready=(v_record->'runtime' is not null and v_record->'runtime'<>'null'::jsonb)
    where external_key=v_record->>'externalKey' and content_sha256=v_record->>'contentSha256';
    if not found then raise exception 'Runtime record does not match canonical content'; end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace function public.admin_bank_questions(p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid page'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('externalKey',external_key,'exam',exam,'type',question_type,'topic',topic,'licence',licence,'runtimeReady',runtime_payload is not null,'approved',owner_approved,'rightsConfirmed',rights_confirmed,'reviewNote',review_note,'prompt',left(payload->>'prompt',500)) order by imported_at desc,external_key),'[]'::jsonb) from (select * from dm_private.bank_questions where active order by imported_at desc,external_key limit p_limit offset p_offset) q);
end $$;

create or replace function public.admin_review_bank_question(p_external_key text,p_approved boolean,p_rights_confirmed boolean,p_note text default null)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_approved and not p_rights_confirmed then raise exception 'Rights confirmation is required'; end if;
  update dm_private.bank_questions set owner_approved=p_approved,rights_confirmed=(p_approved and p_rights_confirmed),review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now()
  where external_key=p_external_key and active and (not p_approved or runtime_payload is not null);
  if not found then raise exception 'Runtime-ready bank question not found'; end if;
  insert into dm_private.bank_question_reviews(external_key,reviewer_id,approved,rights_confirmed,note) values(p_external_key,auth.uid(),p_approved,(p_approved and p_rights_confirmed),nullif(trim(p_note),''));
end $$;

alter table dm_private.papers add column owner_user_id uuid references auth.users(id) on delete cascade;
alter table dm_private.papers add column source_kind text not null default 'catalogue' check(source_kind in ('catalogue','topic','exam','all_india'));
create index papers_owner_idx on dm_private.papers(owner_user_id) where owner_user_id is not null;

create or replace function public.topic_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('topic',topic,'exam',exam,'questions',questions) order by questions desc,topic,exam),'[]'::jsonb) from (select topic,exam,count(*) questions from dm_private.bank_questions where active and owner_approved and rights_confirmed and runtime_payload is not null group by topic,exam) c);
end $$;

create or replace function public.start_topic_practice(p_topic text,p_exam text,p_count integer,p_duration_seconds integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_mode text; v_paper uuid; v_attempt uuid; v_seed uuid:=gen_random_uuid(); v_question record; v_ordinal integer:=0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_exam not in ('uceed','nid','nift','ceed') or p_count not in (10,20,30) or p_duration_seconds not in (900,1800,2700) then raise exception 'Invalid practice configuration'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
  select environment_mode into v_mode from public.launch_settings where singleton;
  if not exists(select 1 from dm_private.passes where user_id=auth.uid() and mode=v_mode and expires_at>now()) then raise exception 'An active pass is required'; end if;
  if not exists(select 1 from public.profiles where user_id=auth.uid() and onboarding_completed_at is not null) then raise exception 'Complete your verified profile first'; end if;
  if (select count(*) from dm_private.attempts where user_id=auth.uid() and status='active' and deadline>now())>=3 then raise exception 'Finish an active attempt before starting another'; end if;
  if (select count(*) from dm_private.bank_questions where active and owner_approved and rights_confirmed and runtime_payload is not null and topic=p_topic and exam=p_exam)<p_count then raise exception 'Not enough reviewed questions for this practice'; end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,owner_user_id,source_kind) values(initcap(replace(p_topic,'-',' '))||' practice',p_exam,p_duration_seconds,false,true,true,auth.uid(),'topic') returning id into v_paper;
  for v_question in select * from dm_private.bank_questions where active and owner_approved and rights_confirmed and runtime_payload is not null and topic=p_topic and exam=p_exam order by md5(external_key||v_seed::text) limit p_count loop
    v_ordinal:=v_ordinal+1;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed) values(v_paper,v_ordinal,v_question.runtime_payload->>'prompt',v_question.runtime_payload->'options',v_question.runtime_payload->>'kind',v_question.runtime_payload->'marking',v_question.runtime_payload->'media',(v_question.runtime_payload->>'points')::numeric,(v_question.runtime_payload->>'negativePoints')::numeric,v_question.topic,true) returning id into v_attempt;
    insert into dm_private.answer_keys(question_id,key,explanation) values(v_attempt,v_question.runtime_payload->'key',v_question.runtime_payload->>'explanation');
  end loop;
  insert into dm_private.attempts(user_id,paper_id,deadline) values(auth.uid(),v_paper,now()+make_interval(secs=>p_duration_seconds)) returning id into v_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
  select v_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=v_paper;
  return v_attempt;
end $$;

revoke all on function public.upsert_question_bank_runtime_batch(jsonb),public.admin_bank_questions(integer,integer),public.admin_review_bank_question(text,boolean,boolean,text),public.topic_catalog(),public.start_topic_practice(text,text,integer,integer) from public,anon;
grant execute on function public.upsert_question_bank_runtime_batch(jsonb) to service_role;
grant execute on function public.admin_bank_questions(integer,integer),public.admin_review_bank_question(text,boolean,boolean,text),public.topic_catalog(),public.start_topic_practice(text,text,integer,integer) to authenticated;
