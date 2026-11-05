-- Admin review queues. Canonical question-bank promotion remains a reviewed Git operation.
create table dm_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table dm_private.question_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  source_type text not null check (source_type in ('manual','pdf','photo','ai')),
  source_name text,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','exported')),
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table dm_private.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 5 and 140),
  description text not null check (char_length(description) between 10 and 5000),
  page_url text,
  status text not null default 'open' check (status in ('open','investigating','fixed','closed')),
  admin_reply text,
  replied_by uuid references auth.users(id),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table dm_private.admins enable row level security;
alter table dm_private.question_drafts enable row level security;
alter table dm_private.bug_reports enable row level security;
revoke all on dm_private.admins, dm_private.question_drafts, dm_private.bug_reports from anon, authenticated;

create or replace function public.is_dmocks_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, dm_private as $$
  select exists(select 1 from dm_private.admins where user_id = auth.uid())
$$;

create or replace function public.submit_bug_report(p_title text, p_description text, p_page_url text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if (select count(*) from dm_private.bug_reports where reporter_id=auth.uid() and created_at > now()-interval '1 hour') >= 5 then
    raise exception 'Too many reports. Please try again later';
  end if;
  insert into dm_private.bug_reports(reporter_id,title,description,page_url)
  values(auth.uid(),trim(p_title),trim(p_description),left(p_page_url,1000)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.my_bug_reports()
returns jsonb language sql stable security definer set search_path = pg_catalog, dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'adminReply',admin_reply,'createdAt',created_at,'updatedAt',updated_at) order by created_at desc),'[]'::jsonb)
  from dm_private.bug_reports where reporter_id=auth.uid()
$$;

create or replace function public.admin_bug_reports()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'reporterId',reporter_id,'title',title,'description',description,'pageUrl',page_url,'status',status,'adminReply',admin_reply,'createdAt',created_at,'updatedAt',updated_at) order by created_at desc),'[]'::jsonb) from dm_private.bug_reports);
end $$;

create or replace function public.admin_reply_bug_report(p_id uuid, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = pg_catalog, dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('open','investigating','fixed','closed') then raise exception 'Invalid status'; end if;
  update dm_private.bug_reports set status=p_status,admin_reply=nullif(trim(p_reply),''),replied_by=auth.uid(),replied_at=now(),updated_at=now() where id=p_id;
  if not found then raise exception 'Report not found'; end if;
end $$;

create or replace function public.admin_create_question_draft(p_source_type text, p_source_name text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare v_id uuid;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  insert into dm_private.question_drafts(created_by,source_type,source_name,payload) values(auth.uid(),p_source_type,nullif(trim(p_source_name),''),p_payload) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_question_drafts()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'sourceType',source_type,'sourceName',source_name,'payload',payload,'status',status,'reviewNote',review_note,'createdAt',created_at) order by created_at desc),'[]'::jsonb) from dm_private.question_drafts);
end $$;

create or replace function public.admin_review_question_draft(p_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = pg_catalog, dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  update dm_private.question_drafts set status=p_decision,review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_id and status='pending';
  if not found then raise exception 'Pending draft not found'; end if;
end $$;

grant execute on function public.is_dmocks_admin() to authenticated;
grant execute on function public.submit_bug_report(text,text,text) to authenticated;
grant execute on function public.my_bug_reports() to authenticated;
grant execute on function public.admin_bug_reports() to authenticated;
grant execute on function public.admin_reply_bug_report(uuid,text,text) to authenticated;
grant execute on function public.admin_create_question_draft(text,text,jsonb) to authenticated;
grant execute on function public.admin_question_drafts() to authenticated;
grant execute on function public.admin_review_question_draft(uuid,text,text) to authenticated;
