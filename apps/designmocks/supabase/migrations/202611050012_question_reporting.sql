alter table public.launch_settings
  add column question_report_threshold integer not null default 5
  check (question_report_threshold between 3 and 20);

create table dm_private.question_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references dm_private.attempts(id) on delete cascade,
  question_id uuid not null,
  target_key text not null,
  source_external_key text,
  reason text not null check(reason in ('incorrect','incomplete','media','other')),
  details text check(details is null or char_length(details)<=1000),
  created_at timestamptz not null default now(),
  unique(reporter_id,target_key)
);

create table dm_private.reported_question_queue (
  target_key text primary key,
  source_external_key text,
  representative_question_id uuid not null,
  report_count integer not null check(report_count>=1),
  status text not null default 'pending' check(status in ('pending','dismissed','retired')),
  resolution_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table dm_private.bank_local_holds (
  external_key text primary key references dm_private.bank_questions(external_key) on delete cascade,
  reason text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table dm_private.question_reports enable row level security;
alter table dm_private.reported_question_queue enable row level security;
alter table dm_private.bank_local_holds enable row level security;
revoke all on dm_private.question_reports,dm_private.reported_question_queue,dm_private.bank_local_holds from anon,authenticated;
create index question_reports_target_idx on dm_private.question_reports(target_key,created_at);

create or replace function dm_private.enforce_local_bank_hold() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from dm_private.bank_local_holds where external_key=new.external_key) then
    new.active:=false;
    new.owner_approved:=false;
  end if;
  return new;
end $$;
create trigger zz_enforce_local_bank_hold before update on dm_private.bank_questions for each row execute function dm_private.enforce_local_bank_hold();

create or replace function public.report_attempt_question(p_attempt_id uuid,p_question_id uuid,p_reason text,p_details text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare v_source text; v_target text; v_count integer; v_threshold integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_reason not in ('incorrect','incomplete','media','other') then raise exception 'Invalid report reason'; end if;
  if char_length(coalesce(p_details,''))>1000 then raise exception 'Report details are too long'; end if;
  select nullif(i.key->>'sourceExternalKey','') into v_source
  from dm_private.attempts a join dm_private.attempt_items i on i.attempt_id=a.id
  where a.id=p_attempt_id and a.user_id=auth.uid() and i.question_id=p_question_id;
  if not found then raise exception 'Question is not part of your attempt'; end if;
  v_target:=coalesce(v_source,'question:'||p_question_id::text);
  insert into dm_private.question_reports(reporter_id,attempt_id,question_id,target_key,source_external_key,reason,details)
  values(auth.uid(),p_attempt_id,p_question_id,v_target,v_source,p_reason,nullif(trim(p_details),''));
  select count(*) into v_count from dm_private.question_reports where target_key=v_target;
  select question_report_threshold into v_threshold from public.launch_settings where singleton;
  if v_count>=v_threshold then
    insert into dm_private.reported_question_queue(target_key,source_external_key,representative_question_id,report_count)
    values(v_target,v_source,p_question_id,v_count)
    on conflict(target_key) do update set report_count=excluded.report_count,updated_at=now();
  end if;
  return jsonb_build_object('reportCount',v_count,'threshold',v_threshold,'queued',v_count>=v_threshold);
exception when unique_violation then
  raise exception 'You have already reported this question';
end $$;

create or replace function public.admin_reported_questions()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'targetKey',q.target_key,'sourceExternalKey',q.source_external_key,'reportCount',q.report_count,
    'status',q.status,'resolutionNote',q.resolution_note,'prompt',left(i.prompt,500),
    'reasons',(select jsonb_object_agg(reason,total) from (select reason,count(*) total from dm_private.question_reports r where r.target_key=q.target_key group by reason) counts),
    'updatedAt',q.updated_at) order by q.updated_at desc),'[]'::jsonb)
  from dm_private.reported_question_queue q left join dm_private.attempt_items i on i.question_id=q.representative_question_id);
end $$;

create or replace function public.admin_resolve_reported_question(p_target_key text,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare v_queue dm_private.reported_question_queue;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('dismiss','retire','reopen') then raise exception 'Invalid review action'; end if;
  select * into v_queue from dm_private.reported_question_queue where target_key=p_target_key for update;
  if not found then raise exception 'Reported question not found'; end if;
  if p_action='retire' then
    if v_queue.source_external_key is not null then
      insert into dm_private.bank_local_holds(external_key,reason,created_by)
      values(v_queue.source_external_key,coalesce(nullif(trim(p_note),''),'Retired after student reports'),auth.uid())
      on conflict(external_key) do update set reason=excluded.reason,created_by=excluded.created_by,created_at=now();
      update dm_private.bank_questions set active=false,owner_approved=false where external_key=v_queue.source_external_key;
    else
      update dm_private.questions set reviewed=false where id=v_queue.representative_question_id;
    end if;
  end if;
  update dm_private.reported_question_queue set
    status=case p_action when 'dismiss' then 'dismissed' when 'retire' then 'retired' else 'pending' end,
    resolution_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where target_key=p_target_key;
end $$;

revoke all on function public.report_attempt_question(uuid,uuid,text,text),public.admin_reported_questions(),public.admin_resolve_reported_question(text,text,text) from public,anon;
grant execute on function public.report_attempt_question(uuid,uuid,text,text),public.admin_reported_questions(),public.admin_resolve_reported_question(text,text,text) to authenticated;
