begin;

create or replace function dm_private.year_drawing_duration_ok(doc jsonb)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select case doc->>'timer'
   when 'shared' then (doc->>'durationSeconds')::integer=10800
   when 'separate' then doc->>'exam'='nift' and doc->>'durationSeconds'='18000'
     and doc->>'uploadGraceSeconds'='600' and doc->>'drawingMarksTotal'='100'
     and jsonb_array_length(doc->'sections')=2 and jsonb_array_length(doc->'items')=3
     and doc#>>'{sections,0,label}'='GAT' and doc#>>'{sections,0,plan}'='objective'
     and doc#>>'{sections,0,durationSeconds}'='7200' and doc#>>'{sections,0,uploadGraceSeconds}'='0'
     and doc#>>'{sections,1,startsAfter}'='GAT' and doc#>>'{sections,1,durationSeconds}'='10800'
     and coalesce(doc#>>'{sections,1,uploadGraceSeconds}','600')='600'
     and doc#>'{sections,1,questionKeys}'=(select jsonb_agg(t->'externalKey' order by n) from jsonb_array_elements(doc->'items') with ordinality items(t,n))
   else false end
$$;

-- deadline is always the end of drawing time. The objective cutoff is frozen on creation
-- and can move earlier only when this student explicitly finishes GAT.
alter table dm_private.attempts add column nift_gat_ends_at timestamptz;
create function dm_private.set_nift_year_clock() returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
begin
  if new.year_drawing_version is not null and exists(select 1 from dm_private.year_drawing_versions v
    join dm_private.papers p on p.id=v.paper_id where v.id=new.year_drawing_version and p.exam='nift'
      and v.duration_seconds=18000 and v.sections#>>'{0,plan}'='objective' and v.sections#>>'{1,startsAfter}'='GAT') then
    new.nift_gat_ends_at:=new.started_at+interval '120 minutes';
    new.deadline:=new.nift_gat_ends_at+interval '180 minutes';
    new.upload_deadline:=new.deadline+interval '10 minutes';
  end if;
  return new;
end $$;
create trigger set_nift_year_clock before insert on dm_private.attempts for each row execute function dm_private.set_nift_year_clock();

create or replace function dm_private.year_drawing_session_open(p_attempt_id uuid,p_question_id uuid)
returns boolean language sql stable set search_path=pg_catalog,dm_private as $$
 select not exists(select 1 from dm_private.attempts where id=p_attempt_id and nift_gat_ends_at > statement_timestamp())
$$;

create function dm_private.lock_nift_gat_answers() returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
begin
 if (new.answer,new.answer_revision) is distinct from (old.answer,old.answer_revision) and new.kind <> 'drawing'
   and exists(select 1 from dm_private.attempts where id=new.attempt_id and nift_gat_ends_at<=clock_timestamp()) then
   raise exception 'The NIFT GAT answer window has closed' using errcode='55000';
 end if;
 return new;
end $$;
create trigger lock_nift_gat_answers before update of answer,answer_revision on dm_private.attempt_items
for each row execute function dm_private.lock_nift_gat_answers();

-- Keep the shared reader and its owner check intact. The private wrapper selects the
-- active section before the public DTO reaches the browser or the attempt-media signer.
alter function public.read_attempt(uuid) set schema dm_private;
alter function dm_private.read_attempt(uuid) rename to read_attempt_before_nift_sessions;
revoke all on function dm_private.read_attempt_before_nift_sessions(uuid) from public,anon,authenticated,service_role;
create function public.read_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
 result jsonb;
 attempt dm_private.attempts;
 phase text;
 questions jsonb;
begin
 result:=dm_private.read_attempt_before_nift_sessions(p_id);
 select * into strict attempt from dm_private.attempts where id=p_id and user_id=auth.uid();
 if attempt.nift_gat_ends_at is null then return result; end if;
 if attempt.status='submitted' then phase:='completed';
 elsif (result->>'serverNow')::timestamptz < attempt.nift_gat_ends_at then phase:='gat';
 else phase:='cat'; end if;
 if phase <> 'completed' then
   select coalesce(jsonb_agg(q order by n),'[]'::jsonb) into questions
     from jsonb_array_elements(result->'questions') with ordinality items(q,n) where (q->>'kind'='drawing')=(phase='cat');
   result:=result || jsonb_build_object('questions',questions);
   if phase='gat' then result:=result || jsonb_build_object('deadline',attempt.nift_gat_ends_at,'uploadDeadline',null); end if;
 end if;
 return result || jsonb_build_object('niftSession',jsonb_build_object('phase',phase,'gatEndsAt',attempt.nift_gat_ends_at,'catEndsAt',attempt.deadline));
end $$;
revoke all on function public.read_attempt(uuid) from public,anon;
grant execute on function public.read_attempt(uuid) to authenticated;

create function public.finish_nift_year_gat(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
 attempt dm_private.attempts; transition_time timestamptz;
begin
 select * into attempt from dm_private.attempts where id=p_id and user_id=auth.uid() and nift_gat_ends_at is not null for update;
 if not found then raise exception 'NIFT session is unavailable' using errcode='42501'; end if;
 transition_time:=clock_timestamp();
 if attempt.status='active' and attempt.nift_gat_ends_at>transition_time then
   update dm_private.attempts set nift_gat_ends_at=transition_time,deadline=transition_time+interval '180 minutes',
     upload_deadline=transition_time+interval '190 minutes' where id=p_id;
 end if;
 return public.read_attempt(p_id);
end $$;
revoke all on function public.finish_nift_year_gat(uuid) from public,anon,service_role;
grant execute on function public.finish_nift_year_gat(uuid) to authenticated;

alter function public.submit_attempt(uuid) set schema dm_private;
alter function dm_private.submit_attempt(uuid) rename to submit_attempt_before_nift_sessions;
revoke all on function dm_private.submit_attempt_before_nift_sessions(uuid) from public,anon,authenticated,service_role;
create function public.submit_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 perform 1 from dm_private.attempts where id=p_id and user_id=auth.uid() and status='active' and nift_gat_ends_at>clock_timestamp() for update;
 if found then raise exception 'Finish the GAT session before submitting CAT' using errcode='55000'; end if;
 return dm_private.submit_attempt_before_nift_sessions(p_id);
end $$;
revoke all on function public.submit_attempt(uuid),dm_private.set_nift_year_clock(),dm_private.lock_nift_gat_answers() from public,anon,authenticated,service_role;
grant execute on function public.submit_attempt(uuid) to authenticated;
commit;
