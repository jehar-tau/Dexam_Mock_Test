begin;

-- Fingerprint only the delivered question and marking, never a student's answer or identity.
create function dm_private.question_quality_snapshot(p_item jsonb) returns jsonb
language sql immutable set search_path=pg_catalog as $$
  select jsonb_build_object('prompt',p_item->'prompt','options',p_item->'options','kind',p_item->'kind',
    'marking',p_item->'marking','media',p_item->'media','key',p_item->'key','explanation',p_item->'explanation')
$$;
create function dm_private.question_quality_version(p_item jsonb) returns text
language sql immutable set search_path=pg_catalog,dm_private as $$
  select encode(sha256(convert_to(dm_private.question_quality_snapshot(p_item)::text,'UTF8')),'hex')
$$;

alter table dm_private.question_reports drop constraint question_reports_reason_check;
alter table dm_private.question_reports add constraint question_reports_reason_check check(reason in('incorrect','incomplete','media','duplicate','other'));
alter table dm_private.question_reports add column identity_key text,add column content_version text;
update dm_private.question_reports r set identity_key=coalesce(r.source_external_key,'question:'||r.question_id::text),
  content_version=(select dm_private.question_quality_version(to_jsonb(i)) from dm_private.attempt_items i
    where i.attempt_id=r.attempt_id and i.question_id=r.question_id);
alter table dm_private.question_reports alter column identity_key set not null;
alter table dm_private.question_reports drop constraint question_reports_reporter_id_target_key_key;
alter table dm_private.question_reports add unique(reporter_id,target_key,reason);
create unique index question_reports_version_reason_idx on dm_private.question_reports(reporter_id,identity_key,content_version,reason) where content_version is not null;
create index question_reports_version_count_idx on dm_private.question_reports(identity_key,content_version,created_at);
create index question_reports_user_time_idx on dm_private.question_reports(reporter_id,created_at);

alter table dm_private.reported_question_queue drop constraint reported_question_queue_status_check;
alter table dm_private.reported_question_queue add constraint reported_question_queue_status_check check(status in('pending','dismissed','retired','restored'));
alter table dm_private.reported_question_queue add column snapshot jsonb,add column content_version text,
  add column identity_key text,add column quarantines_bank boolean not null default false,
  add column source_content_sha256 text,add column revision bigint not null default 1;
update dm_private.reported_question_queue q set
  identity_key=coalesce(q.source_external_key,'question:'||q.representative_question_id::text),
  snapshot=(select dm_private.question_quality_snapshot(to_jsonb(i)) from dm_private.question_reports r
    join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
    where r.target_key=q.target_key and i.question_id=q.representative_question_id order by r.created_at,r.id limit 1),
  quarantines_bank=q.source_external_key is not null,
  source_content_sha256=(select b.content_sha256 from dm_private.bank_questions b where b.external_key=q.source_external_key);
update dm_private.reported_question_queue set content_version=dm_private.question_quality_version(snapshot) where snapshot is not null;
alter table dm_private.reported_question_queue alter column identity_key set not null;
alter table dm_private.reported_question_queue add check(content_version is null or content_version=dm_private.question_quality_version(snapshot));
alter table dm_private.bank_local_holds add column report_target_key text references dm_private.reported_question_queue(target_key);
create index reported_question_source_hold_idx on dm_private.reported_question_queue(source_external_key) where quarantines_bank and status in('pending','retired');
create index reported_question_version_hold_idx on dm_private.reported_question_queue(identity_key,content_version) where status in('pending','retired');

create table dm_private.question_review_events(
  id bigint generated always as identity primary key,
  target_key text not null references dm_private.reported_question_queue(target_key),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in('quarantine','retire','restore','dismiss','reopen','fix')),
  note text not null,report_count integer not null,created_at timestamptz not null default now()
);
alter table dm_private.question_review_events enable row level security;
revoke all on dm_private.question_review_events from public,anon,authenticated;
create function dm_private.advance_question_report_revision() returns trigger language plpgsql set search_path=pg_catalog as $$
begin new.revision:=old.revision+1;return new;end $$;
create trigger question_report_revision before update on dm_private.reported_question_queue for each row execute function dm_private.advance_question_report_revision();

-- Both human retirements and unresolved threshold holds survive a canonical import replay.
create or replace function dm_private.enforce_local_bank_hold() returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
begin
  if exists(select 1 from dm_private.bank_local_holds where external_key=new.external_key)
    or exists(select 1 from dm_private.reported_question_queue where source_external_key=new.external_key
      and quarantines_bank and status in('pending','retired')) then
    new.active:=false;new.owner_approved:=false;
  end if;
  return new;
end $$;
update dm_private.bank_questions b set active=false,owner_approved=false where exists(
  select 1 from dm_private.reported_question_queue q where q.source_external_key=b.external_key and q.quarantines_bank and q.status in('pending','retired'));

create function dm_private.question_is_held(p_item jsonb,p_question_id uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
  select exists(select 1 from dm_private.bank_local_holds h where h.external_key=nullif(p_item->'key'->>'sourceExternalKey',''))
    or exists(select 1 from dm_private.reported_question_queue q
      where q.identity_key=coalesce(nullif(p_item->'key'->>'sourceExternalKey',''),'question:'||p_question_id::text)
        and q.status in('pending','retired') and(q.quarantines_bank or q.content_version is null or q.content_version=dm_private.question_quality_version(p_item)))
$$;
create function dm_private.paper_quality_held(p_paper_id uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
  select exists(select 1 from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id
    where q.paper_id=p_paper_id and dm_private.question_is_held(to_jsonb(q)||jsonb_build_object('key',k.key,'explanation',k.explanation),q.id))
$$;
create function dm_private.guard_question_quality_at_start() returns trigger
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare identity text;
begin
  -- The same ordered locks fence report thresholds against every attempt creation path.
  for identity in select distinct coalesce(nullif(k.key->>'sourceExternalKey',''),'question:'||q.id::text)
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=new.paper_id order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('question-quality:'||identity,0));
  end loop;
  if dm_private.paper_quality_held(new.paper_id) then raise exception 'New starts are paused while a question is under human review';end if;
  return new;
end $$;
create trigger question_quality_at_start before insert on dm_private.attempts for each row execute function dm_private.guard_question_quality_at_start();

create or replace function public.report_attempt_question(p_attempt_id uuid,p_question_id uuid,p_reason text,p_details text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare item dm_private.attempt_items;source text;identity text;version text;target text;counted integer;threshold integer;
  snapshot jsonb;bank dm_private.bank_questions;existing dm_private.reported_question_queue;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
  if p_reason is null or p_reason not in('incorrect','incomplete','media','duplicate','other') then raise exception 'Invalid report reason';end if;
  if char_length(coalesce(p_details,''))>1000 then raise exception 'Report details are too long';end if;
  select i.* into item from dm_private.attempt_items i join dm_private.attempts a on a.id=i.attempt_id
    where a.id=p_attempt_id and a.user_id=auth.uid() and i.question_id=p_question_id;
  if not found then raise exception 'Question is not part of your attempt';end if;
  snapshot:=dm_private.question_quality_snapshot(to_jsonb(item));version:=dm_private.question_quality_version(snapshot);
  source:=nullif(item.key->>'sourceExternalKey','');identity:=coalesce(source,'question:'||p_question_id::text);target:=identity||':version:'||version;
  perform pg_advisory_xact_lock(hashtextextended('question-reporter:'||auth.uid()::text,0));
  if(select count(*) from dm_private.question_reports where reporter_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=20 then
    raise exception 'Too many question reports. Please try again after the hourly window';end if;
  perform pg_advisory_xact_lock(hashtextextended('question-quality:'||identity,0));
  insert into dm_private.question_reports(reporter_id,attempt_id,question_id,target_key,source_external_key,identity_key,content_version,reason,details)
    values(auth.uid(),p_attempt_id,p_question_id,target,source,identity,version,p_reason,nullif(btrim(p_details),''));
  select count(distinct reporter_id) into counted from dm_private.question_reports where identity_key=identity and content_version=version;
  select question_report_threshold into threshold from public.launch_settings where singleton;
  if counted>=threshold then
    select * into existing from dm_private.reported_question_queue where target_key=target for update;
    if existing.target_key is null then
      select * into bank from dm_private.bank_questions where external_key=source for update;
      insert into dm_private.reported_question_queue(target_key,source_external_key,representative_question_id,report_count,
        identity_key,content_version,snapshot,quarantines_bank,source_content_sha256)
      values(target,source,p_question_id,counted,identity,version,snapshot,
        bank.external_key is not null and bank.runtime_payload is not null and dm_private.question_quality_version(bank.runtime_payload)=version,
        case when bank.runtime_payload is not null and dm_private.question_quality_version(bank.runtime_payload)=version then bank.content_sha256 end);
      update dm_private.bank_questions set active=false,owner_approved=false where external_key=source and runtime_payload is not null
        and dm_private.question_quality_version(runtime_payload)=version;
      insert into dm_private.question_review_events(target_key,actor_id,action,note,report_count)
        values(target,auth.uid(),'quarantine','Unique authenticated students reached the configured report threshold.',counted);
    else
      -- A resolved case does not reopen itself when further students report the same version.
      update dm_private.reported_question_queue set report_count=counted,updated_at=now() where target_key=target;
    end if;
  end if;
  -- The fingerprint includes the answer key. Keep review identifiers out of student receipts.
  return jsonb_build_object('reportCount',counted,'threshold',threshold,
    'queued',counted>=threshold,'held',exists(select 1 from dm_private.reported_question_queue where target_key=target and status in('pending','retired')));
exception when unique_violation then raise exception 'You have already reported this issue for this question version';
end $$;

create function dm_private.report_case_figures(p_snapshot jsonb)
returns table(ordinal integer,width integer,height integer,storage_path text)
language sql stable set search_path=pg_catalog,dm_private as $$
  select x.ordinality::integer,b.width,b.height,case when
    x.asset->>'path' !~ '\.\.' and x.asset->>'path' ~* '^papers/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp)$'
    and exists(select 1 from storage.objects o where o.bucket_id='paper-media' and o.name=x.asset->>'path'
      and o.metadata->>'mimetype'=case when o.name ~* '\.png$' then 'image/png' when o.name ~* '\.jpe?g$' then 'image/jpeg' else 'image/webp' end
      and(o.name not like 'papers/canonical/%' or(b.storage_path=o.name and o.metadata->>'size'=b.byte_size::text)))
    then x.asset->>'path' end
  from jsonb_array_elements(case when jsonb_typeof(p_snapshot->'media')='array' then p_snapshot->'media' else '[]'::jsonb end)
    with ordinality x(asset,ordinality)
  left join dm_private.bank_media_assets b on b.sha256=x.asset->>'sha256' and b.width::text=x.asset->>'width' and b.height::text=x.asset->>'height'
  union all select 1,null::integer,null::integer,null::text where jsonb_typeof(p_snapshot->'media') is distinct from 'array'
$$;

create function public.admin_reported_question(p_target_key text,p_expected_revision bigint)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare report dm_private.reported_question_queue;bank dm_private.bank_questions;media jsonb;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501';end if;
  select * into report from dm_private.reported_question_queue where target_key=p_target_key;
  if not found then raise exception 'Reported question unavailable';end if;
  if p_expected_revision is null or report.revision<>p_expected_revision then raise exception 'Reports changed. Refresh and review this case again.' using errcode='40001';end if;
  select * into bank from dm_private.bank_questions where external_key=report.source_external_key;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal',f.ordinal,'available',f.storage_path is not null) order by f.ordinal),'[]')
    into media from dm_private.report_case_figures(report.snapshot) f;
  return jsonb_build_object('targetKey',report.target_key,'revision',report.revision,'status',report.status,'reportCount',report.report_count,
    'contentVersion',report.content_version,'snapshot',report.snapshot,'sourceExternalKey',report.source_external_key,'media',media,
    'quarantinesBank',report.quarantines_bank,'bankVersion',case when bank.external_key is not null then dm_private.bank_review_version(bank) end,
    'sourceChanged',report.source_content_sha256 is not null and bank.content_sha256 is distinct from report.source_content_sha256,
    'audit',(select coalesce(jsonb_agg(jsonb_build_object('action',action,'note',note,'reportCount',report_count,'createdAt',created_at) order by id desc),'[]')
      from dm_private.question_review_events where target_key=report.target_key));
end $$;
create function public.admin_reported_question_media_paths(p_target_key text,p_expected_revision bigint)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare report dm_private.reported_question_queue;result jsonb;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501';end if;
  select * into report from dm_private.reported_question_queue where target_key=p_target_key;
  if not found or report.snapshot is null then raise exception 'Reported snapshot unavailable';end if;
  if p_expected_revision is null or report.revision<>p_expected_revision then raise exception 'Reports changed. Refresh and review this case again.' using errcode='40001';end if;
  if exists(select 1 from dm_private.report_case_figures(report.snapshot) where storage_path is null) then raise exception 'Private question figures need verification';end if;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal',ordinal,'storagePath',storage_path) order by ordinal),'[]') into result
    from dm_private.report_case_figures(report.snapshot);
  return result;
end $$;

create or replace function public.admin_reported_questions()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('targetKey',q.target_key,'sourceExternalKey',q.source_external_key,
    'reportCount',q.report_count,'status',q.status,'resolutionNote',q.resolution_note,'revision',q.revision,
    'prompt',left(q.snapshot->>'prompt',500),'priority',case when q.report_count>=10 then 'high' else 'normal' end,
    'quarantinesBank',q.quarantines_bank,'contentVersion',q.content_version,
    'reasons',(select jsonb_object_agg(reason,total) from(select r.reason,count(*) total from dm_private.question_reports r
      where(r.identity_key=q.identity_key and r.content_version=q.content_version)or r.target_key=q.target_key group by r.reason) counts),
    'updatedAt',q.updated_at) order by(q.status='pending') desc,q.report_count desc,q.updated_at desc,q.target_key),'[]')
    from dm_private.reported_question_queue q);
end $$;

create function dm_private.resolve_question_report(p_target_key text,p_action text,p_note text,p_expected_revision bigint,p_expected_bank_version text)
returns void language plpgsql set search_path=pg_catalog,dm_private as $$
declare report dm_private.reported_question_queue;bank dm_private.bank_questions;identity text;affects_bank boolean;bind_bank boolean;new_status text;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501';end if;
  if p_action is null or p_action not in('retire','dismiss','restore','reopen','fix') then raise exception 'Invalid review action';end if;
  if coalesce(char_length(btrim(p_note)),0) not between 8 and 1000 then raise exception 'Enter a review reason of 8 to 1000 characters';end if;
  select identity_key into identity from dm_private.reported_question_queue where target_key=p_target_key;
  if not found then raise exception 'Reported question unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended('question-quality:'||identity,0));
  select * into report from dm_private.reported_question_queue where target_key=p_target_key for update;
  if p_expected_revision is null or report.revision<>p_expected_revision then raise exception 'Reports changed. Refresh and review this case again.' using errcode='40001';end if;
  select * into bank from dm_private.bank_questions where external_key=report.source_external_key for update;
  if (bank.external_key is not null and(p_expected_bank_version is null or dm_private.bank_review_version(bank)<>p_expected_bank_version))
    or(bank.external_key is null and p_expected_bank_version is not null) then raise exception 'Bank content changed. Refresh and review this case again.' using errcode='40001';end if;
  if p_action in('restore','dismiss') and(report.snapshot is null or exists(select 1 from dm_private.report_case_figures(report.snapshot) where storage_path is null)) then
    raise exception 'Verify the complete reported question and private figures before restoring it';end if;
  affects_bank:=report.quarantines_bank or exists(select 1 from dm_private.bank_local_holds where external_key=report.source_external_key and report_target_key=report.target_key);
  bind_bank:=bank.external_key is not null and(report.content_version is null
    or(bank.runtime_payload is not null and report.content_version=dm_private.question_quality_version(bank.runtime_payload))
    or(bank.runtime_payload is null and report.source_content_sha256=bank.content_sha256));
  if p_action='fix' and(bank.external_key is null or report.source_content_sha256 is null or bank.content_sha256=report.source_content_sha256) then
    raise exception 'Import a corrected canonical source version before releasing it for fresh review';end if;
  if p_action='retire' and(report.quarantines_bank or bind_bank) and bank.external_key is not null then
    insert into dm_private.bank_local_holds(external_key,reason,created_by,report_target_key) values(bank.external_key,btrim(p_note),auth.uid(),report.target_key)
      on conflict(external_key) do update set reason=excluded.reason,created_by=excluded.created_by,created_at=now(),report_target_key=excluded.report_target_key
      where dm_private.bank_local_holds.report_target_key=report.target_key;
  end if;
  if p_action in('restore','dismiss','fix') then
    delete from dm_private.bank_local_holds where external_key=report.source_external_key and report_target_key=report.target_key;
  end if;
  new_status:=case p_action when 'retire' then 'retired' when 'fix' then 'retired' when 'dismiss' then 'dismissed' when 'restore' then 'restored' else 'pending' end;
  update dm_private.reported_question_queue set status=new_status,resolution_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),
    quarantines_bank=case when p_action in('fix','restore','dismiss') then false when p_action='reopen' then coalesce(bind_bank,false)
      when p_action='retire' then report.quarantines_bank or coalesce(bind_bank,false) else quarantines_bank end where target_key=report.target_key;
  if p_action in('retire','reopen') then
    update dm_private.bank_questions set active=false,owner_approved=false where external_key=report.source_external_key
      and exists(select 1 from dm_private.reported_question_queue where target_key=report.target_key and quarantines_bank);
  elsif affects_bank then
    -- Restoring eligibility is separate from content/rights approval and cannot revive an omitted source record.
    update dm_private.bank_questions q set owner_approved=false,rights_confirmed=false,
      active=exists(select 1 from dm_private.bank_import_run_items i where i.external_key=q.external_key and i.content_sha256=q.content_sha256
        and i.run_id=(select id from dm_private.bank_import_runs where status='completed' order by completed_at desc nulls last,started_at desc,id desc limit 1))
      where q.external_key=report.source_external_key;
  end if;
  insert into dm_private.question_review_events(target_key,actor_id,action,note,report_count)
    values(report.target_key,auth.uid(),p_action,btrim(p_note),report.report_count);
end $$;
create function public.admin_resolve_reported_question(p_target_key text,p_action text,p_note text,p_expected_revision bigint,p_expected_bank_version text)
returns void language sql security definer set search_path=pg_catalog,dm_private as $$
  select dm_private.resolve_question_report(p_target_key,p_action,p_note,p_expected_revision,p_expected_bank_version)
$$;
-- Existing operator callers retain their signature; a written reason is required on every path.
create or replace function public.admin_resolve_reported_question(p_target_key text,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare report dm_private.reported_question_queue;bank dm_private.bank_questions;identity text;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501';end if;
  select identity_key into identity from dm_private.reported_question_queue where target_key=p_target_key;
  if not found then raise exception 'Reported question unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended('question-quality:'||identity,0));
  select * into report from dm_private.reported_question_queue where target_key=p_target_key for update;
  select * into bank from dm_private.bank_questions where external_key=report.source_external_key for update;
  perform dm_private.resolve_question_report(p_target_key,p_action,p_note,report.revision,
    case when bank.external_key is not null then dm_private.bank_review_version(bank) end);
end $$;

create or replace function public.available_papers() returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'exam',exam,'durationSeconds',duration_seconds,
    'qualityHeld',dm_private.paper_quality_held(id))),'[]') from dm_private.papers where published and reviewed and rights_confirmed and auth.uid() is not null
$$;

create or replace function public.all_india_event_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'lastStartAt',timing.last_start,
    'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'uploadGraceSeconds',p.upload_grace_seconds,
    'qualityHeld',dm_private.paper_quality_held(p.id),
    'state',case when e.results_released_at is not null then 'released' when now()<e.starts_at then 'scheduled'
      when now()<timing.last_start and dm_private.paper_quality_held(p.id) then 'paused'
      when now()<timing.last_start then 'open' when now()<e.ends_at then 'closing' else 'review' end,
    'attemptId',ai.attempt_id,
    'result',case when r.attempt_id is not null and e.results_released_at is not null then
      jsonb_build_object('score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias,
        'cohortSize',(select count(*) from dm_private.all_india_results s where s.event_id=e.id)) end
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e join dm_private.papers p on p.id=e.paper_id
  cross join lateral(select e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds) as last_start) timing
  left join dm_private.all_india_attempts ai on ai.event_id=e.id and ai.user_id=auth.uid()
  left join dm_private.all_india_results r on r.attempt_id=ai.attempt_id
  where e.starts_at>now()-interval '90 days');
end $$;

revoke all on function dm_private.question_quality_snapshot(jsonb),dm_private.question_quality_version(jsonb),dm_private.advance_question_report_revision(),
  dm_private.question_is_held(jsonb,uuid),dm_private.paper_quality_held(uuid),dm_private.guard_question_quality_at_start(),
  dm_private.report_case_figures(jsonb),dm_private.resolve_question_report(text,text,text,bigint,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_reported_question(text,bigint),public.admin_reported_question_media_paths(text,bigint),
  public.admin_resolve_reported_question(text,text,text,bigint,text) from public,anon;
grant execute on function public.admin_reported_question(text,bigint),public.admin_reported_question_media_paths(text,bigint),
  public.admin_resolve_reported_question(text,text,text,bigint,text) to authenticated;

commit;
