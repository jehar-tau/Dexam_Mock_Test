begin;

alter table dm_private.learning_lessons add column version integer not null default 1;

-- Older administrator clients can still save lessons. Their changes also invalidate open drafts.
create function dm_private.advance_learning_lesson_version()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  new.version:=old.version+1;
  return new;
end $$;

create trigger advance_learning_lesson_version before update on dm_private.learning_lessons
  for each row execute function dm_private.advance_learning_lesson_version();
revoke all on function dm_private.advance_learning_lesson_version() from public,anon,authenticated;

create table dm_private.learning_publication_audit (
  id bigint generated always as identity primary key,
  lesson_id uuid not null references dm_private.learning_lessons(id),
  version integer not null,
  actor_id uuid not null,
  published boolean not null,
  reason text not null check(char_length(reason) between 5 and 1000),
  changed_at timestamptz not null default now()
);
alter table dm_private.learning_publication_audit enable row level security;
revoke all on dm_private.learning_publication_audit from public,anon,authenticated;

create or replace function public.admin_learning_lessons()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'slug',slug,'exam',exam,'topic',topic,'title',title,'summary',summary,'body',body,
    'ordinal',ordinal,'published',published,'rightsConfirmed',rights_confirmed,'version',version
  ) order by exam,topic,ordinal),'[]') from dm_private.learning_lessons);
end $$;

create function public.admin_save_learning_draft(
  p_id uuid,p_expected_version integer,p_slug text,p_exam text,p_topic text,
  p_title text,p_summary text,p_body text,p_ordinal integer
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare lesson dm_private.learning_lessons;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if nullif(btrim(p_topic),'') is null then raise exception 'Enter a topic for this lesson'; end if;
  if p_id is not null then
    select * into lesson from dm_private.learning_lessons where id=p_id for update;
    if not found or p_expected_version is distinct from lesson.version then raise exception 'Lesson changed. Refresh the lesson list.'; end if;
    if lesson.published then raise exception 'Withdraw the published lesson before editing'; end if;
  end if;
  return public.admin_upsert_learning_lesson(p_id,p_slug,p_exam,p_topic,p_title,p_summary,p_body,p_ordinal,false,false);
end $$;

create function public.admin_set_learning_publication(
  p_id uuid,p_expected_version integer,p_publish boolean,p_reason text
) returns boolean language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  lesson dm_private.learning_lessons;
  reason text:=btrim(p_reason);
  saved_version integer;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_publish is null or reason is null or char_length(reason) not between 5 and 1000 then
    raise exception 'Give a reason between 5 and 1,000 characters';
  end if;
  select * into lesson from dm_private.learning_lessons where id=p_id for update;
  if not found or p_expected_version is distinct from lesson.version then raise exception 'Lesson changed. Refresh the lesson list.'; end if;
  if lesson.published=p_publish then return false; end if;
  update dm_private.learning_lessons set published=p_publish,rights_confirmed=p_publish,updated_at=now()
    where id=p_id returning version into saved_version;
  insert into dm_private.learning_publication_audit(lesson_id,version,actor_id,published,reason)
    values(p_id,saved_version,auth.uid(),p_publish,reason);
  return true;
end $$;

create or replace function public.complete_learning_lesson(p_lesson_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform 1 from dm_private.learning_lessons where id=p_lesson_id and published and rights_confirmed for share;
  if not found then raise exception 'Lesson not found'; end if;
  insert into dm_private.learning_progress values(auth.uid(),p_lesson_id,now()) on conflict do nothing;
end $$;

revoke all on function public.admin_save_learning_draft(uuid,integer,text,text,text,text,text,text,integer),
  public.admin_set_learning_publication(uuid,integer,boolean,text) from public,anon;
grant execute on function public.admin_save_learning_draft(uuid,integer,text,text,text,text,text,text,integer),
  public.admin_set_learning_publication(uuid,integer,boolean,text) to authenticated;

commit;
