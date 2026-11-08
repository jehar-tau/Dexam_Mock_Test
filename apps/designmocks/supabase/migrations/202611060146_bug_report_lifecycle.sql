begin;

create index bug_reports_owner_page on dm_private.bug_reports(reporter_id,created_at desc,id desc);
create table dm_private.bug_report_receipts(
 reporter_id uuid not null references auth.users(id),
 request_id uuid not null,
 report_id uuid not null references dm_private.bug_reports(id),
 input_hash text not null check(input_hash~'^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(reporter_id,request_id)
);
create table dm_private.bug_report_updates(
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references dm_private.bug_reports(id),
 actor_id uuid not null references auth.users(id),
 previous_status text not null,
 status text not null,
 reply text,
 created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.bug_report_receipts enable row level security;
alter table dm_private.bug_report_updates enable row level security;
revoke all on dm_private.bug_report_receipts,dm_private.bug_report_updates from public,anon,authenticated;

create function dm_private.create_bug_report(p_title text,p_description text,p_page_url text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); title text:=btrim(p_title); description text:=btrim(p_description);
 page text:=nullif(left(regexp_replace(split_part(split_part(btrim(p_page_url),'#',1),'?',1),'^(https?://)[^/]*@','\1','i'),1000),'');
 fingerprint text; receipt dm_private.bug_report_receipts; report_id uuid; stamp timestamptz;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501';end if;
 if title is null or char_length(title) not between 5 and 140 or description is null or char_length(description) not between 10 and 5000 then
  raise exception 'Invalid bug report' using errcode='22023',detail='bug_report_invalid';
 end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('dmocks-bug-report:'||actor::text,0));
 if p_request_id is not null then
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('title',title,'description',description,'page',page)::text,'UTF8')),'hex');
  select * into receipt from dm_private.bug_report_receipts where reporter_id=actor and request_id=p_request_id;
  if found then
   if receipt.input_hash is distinct from fingerprint then raise exception 'Report request changed' using errcode='22023',detail='bug_report_conflict';end if;
   return receipt.report_id;
  end if;
 end if;
 if(select count(*)from dm_private.bug_reports where reporter_id=actor and created_at>clock_timestamp()-interval'1 hour')>=5 then
  raise exception 'Too many reports. Please try again later' using errcode='P0001',detail='bug_report_limit';
 end if;
 stamp:=clock_timestamp();
 insert into dm_private.bug_reports(reporter_id,title,description,page_url,created_at,updated_at)
 values(actor,title,description,page,stamp,stamp) returning id into report_id;
 if p_request_id is not null then
  insert into dm_private.bug_report_receipts(reporter_id,request_id,report_id,input_hash,created_at)values(actor,p_request_id,report_id,fingerprint,stamp);
 end if;
 return report_id;
end $$;
revoke all on function dm_private.create_bug_report(text,text,text,uuid)from public,anon,authenticated;

-- Retain the original signature and quota for earlier clients. New clients never
-- fall back to it after an uncertain acknowledgement.
create or replace function public.submit_bug_report(p_title text,p_description text,p_page_url text default null)
returns uuid language sql security definer set search_path=pg_catalog,dm_private as $$
 select dm_private.create_bug_report(p_title,p_description,p_page_url,null)
$$;
create function public.submit_bug_report(p_title text,p_description text,p_page_url text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 if p_request_id is null then raise exception 'Report request required' using errcode='22023',detail='bug_report_invalid';end if;
 return dm_private.create_bug_report(p_title,p_description,p_page_url,p_request_id);
end $$;
revoke all on function public.submit_bug_report(text,text,text),public.submit_bug_report(text,text,text,uuid)from public,anon;
grant execute on function public.submit_bug_report(text,text,text),public.submit_bug_report(text,text,text,uuid)to authenticated;

create function public.my_bug_report_page(p_cursor jsonb default null,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); snapshot_at timestamptz; after_at timestamptz; after_id uuid;
 items jsonb; last_at timestamptz; last_id uuid; more boolean;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Invalid report page' using errcode='22023';end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor) is distinct from 'object' then raise exception 'Invalid report cursor' using errcode='22023';end if;
  if(select count(*)from jsonb_object_keys(p_cursor))<>4 or jsonb_typeof(p_cursor->'ownerId')is distinct from'string'
   or jsonb_typeof(p_cursor->'snapshotAt')is distinct from'string' or jsonb_typeof(p_cursor->'createdAt')is distinct from'string'
   or jsonb_typeof(p_cursor->'id')is distinct from'string' or p_cursor->>'ownerId' is distinct from actor::text
   or(p_cursor->>'id')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or(p_cursor->>'snapshotAt')!~'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$'
   or(p_cursor->>'createdAt')!~'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$' then
   raise exception 'Invalid report cursor' using errcode='22023';
  end if;
  begin
   snapshot_at:=(p_cursor->>'snapshotAt')::timestamptz;after_at:=(p_cursor->>'createdAt')::timestamptz;after_id:=(p_cursor->>'id')::uuid;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
   raise exception 'Invalid report cursor' using errcode='22023';
  end;
  if snapshot_at>clock_timestamp()or after_at>snapshot_at then raise exception 'Invalid report cursor' using errcode='22023';end if;
 end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required' using errcode='42501';end if;
 -- Drain earlier creators before assigning the reading snapshot. Later reports
 -- get a post-lock clock and cannot enter this continuation.
 perform pg_advisory_xact_lock_shared(hashtextextended('dmocks-bug-report:'||actor::text,0));
 snapshot_at:=coalesce(snapshot_at,clock_timestamp());
 with page as(
  select * from dm_private.bug_reports where reporter_id=actor and created_at<=snapshot_at
   and(after_id is null or(created_at,id)<(after_at,after_id))order by created_at desc,id desc limit p_limit+1
 ),visible as(select * from page order by created_at desc,id desc limit p_limit),last_row as(select *from visible order by created_at,id limit 1)
 select coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'adminReply',admin_reply,
  'createdAt',to_char(created_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'updatedAt',to_char(updated_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))order by created_at desc,id desc)from visible),'[]'),
  (select created_at from last_row),(select id from last_row),(select count(*)>p_limit from page)
 into items,last_at,last_id,more;
 return jsonb_build_object('items',items,'nextCursor',case when more then jsonb_build_object('ownerId',actor,'snapshotAt',to_char(snapshot_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'createdAt',to_char(last_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'id',last_id)else null end);
end $$;
revoke all on function public.my_bug_report_page(jsonb,integer)from public,anon;
grant execute on function public.my_bug_report_page(jsonb,integer)to authenticated;

create or replace function public.admin_reply_bug_report(p_id uuid,p_status text,p_reply text)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare actor uuid:=auth.uid(); report dm_private.bug_reports;
begin
 if not public.is_dmocks_admin()then raise exception 'Admin access required' using errcode='42501';end if;
 if p_status is null or p_status not in('open','investigating','fixed','closed')then raise exception 'Invalid status' using errcode='22023';end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Admin access required' using errcode='42501';end if;
 select *into report from dm_private.bug_reports where id=p_id for update;
 if not found then raise exception 'Report not found';end if;
 if not public.is_dmocks_admin()then raise exception 'Admin access required' using errcode='42501';end if;
 update dm_private.bug_reports set status=p_status,admin_reply=nullif(btrim(p_reply),''),replied_by=actor,replied_at=clock_timestamp(),updated_at=clock_timestamp()where id=p_id;
 insert into dm_private.bug_report_updates(report_id,actor_id,previous_status,status,reply)values(p_id,actor,report.status,p_status,nullif(btrim(p_reply),''));
 if not public.is_dmocks_admin()then raise exception 'Admin access required' using errcode='42501';end if;
end $$;
revoke all on function public.admin_reply_bug_report(uuid,text,text)from public,anon;
grant execute on function public.admin_reply_bug_report(uuid,text,text)to authenticated;

commit;
