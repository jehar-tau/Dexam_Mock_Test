-- Choice belongs to the student's attempt. Retain the authored rubric in the
-- snapshot and keep the choice out of the objective answer and its scoring.
create table dm_private.year_drawing_choices (
  attempt_id uuid not null,
  question_id uuid not null,
  section_number integer,
  alternative text,
  primary key(attempt_id,question_id),
  foreign key(attempt_id,question_id) references dm_private.attempt_items(attempt_id,question_id) on delete cascade,
  unique(attempt_id,section_number)
);
alter table dm_private.year_drawing_choices enable row level security;
revoke all on dm_private.year_drawing_choices from public,anon,authenticated,service_role;

create or replace function dm_private.year_drawing_choice_plan_ok(doc jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
  select not exists (
    select from jsonb_array_elements(doc->'sections') s where s->'chooseOne'='true'::jsonb and (
      jsonb_typeof(s->'questionKeys') is distinct from 'array'
      or jsonb_array_length(s->'questionKeys')<2
      or exists(select from jsonb_array_elements_text(s->'questionKeys') k
        where not exists(select from jsonb_array_elements(doc->'items') t where t->>'externalKey'=k))
      or (select count(distinct (t#>>'{marking,max}')::numeric) from jsonb_array_elements(doc->'items') t
        where (s->'questionKeys') ? (t->>'externalKey'))<>1
    )
  ) and not exists (
    select k from jsonb_array_elements(doc->'sections') s, jsonb_array_elements_text(s->'questionKeys') k
    where s->'chooseOne'='true'::jsonb group by k having count(*)<>1
  )
$$;

create function dm_private.year_drawing_elective(p_attempt_id uuid,p_question_id uuid)
returns table(number integer,label text) language sql stable set search_path=pg_catalog,dm_private as $$
  select s.n::integer,s.section->>'label' from dm_private.attempts a
    join dm_private.year_drawing_versions v on v.id=a.year_drawing_version
    join dm_private.attempt_items i on i.attempt_id=a.id
    cross join lateral jsonb_array_elements(v.sections) with ordinality s(section,n)
  where a.id=p_attempt_id and i.question_id=p_question_id and s.section->'chooseOne'='true'::jsonb
    and (s.section->'questionKeys') ? (i.key->>'externalKey')
$$;
revoke all on function dm_private.year_drawing_elective(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function dm_private.year_drawing_task_selected(p_attempt_id uuid,p_question_id uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
  select exists(select from dm_private.attempt_items i
    left join dm_private.year_drawing_choices ballot on ballot.attempt_id=i.attempt_id and ballot.question_id=i.question_id
    left join lateral dm_private.year_drawing_elective(i.attempt_id,i.question_id) section on true
    where i.attempt_id=p_attempt_id and i.question_id=p_question_id and
      (section.number is null or ballot.section_number=section.number) and
      (i.key#>'{drawing,alternatives}' is null or ballot.alternative is not null))
$$;

create or replace function dm_private.year_drawing_choice_fields(p_attempt_id uuid,p_question_id uuid) returns jsonb
language sql stable set search_path=pg_catalog,dm_private as $$
  select coalesce((select jsonb_build_object('drawingChoice',jsonb_build_object(
    'group',section.label,'selected',coalesce(selected.question_id=i.question_id,false),
    'chosenQuestionId',selected.question_id,'alternative',own.alternative,
    'uploadAllowed',dm_private.year_drawing_task_selected(i.attempt_id,i.question_id)))
    from dm_private.attempt_items i
      left join lateral dm_private.year_drawing_elective(i.attempt_id,i.question_id) section on true
      left join dm_private.year_drawing_choices selected on selected.attempt_id=i.attempt_id and selected.section_number=section.number
      left join dm_private.year_drawing_choices own on own.attempt_id=i.attempt_id and own.question_id=i.question_id
    where i.attempt_id=p_attempt_id and i.question_id=p_question_id
      and (section.number is not null or i.key#>'{drawing,alternatives}' is not null)), '{}'::jsonb)
$$;

create function public.choose_year_drawing_task(p_attempt_id uuid,p_question_id uuid,p_alternative text default null)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts; item dm_private.attempt_items;
  section_id integer; previous dm_private.year_drawing_choices; changed boolean;
begin
  select * into attempt from dm_private.attempts where id=p_attempt_id and user_id=auth.uid() for update;
  if not found or attempt.year_drawing_version is null or attempt.status<>'active' or attempt.deadline<=clock_timestamp()
    or not dm_private.year_drawing_session_open(p_attempt_id,p_question_id) then
    raise exception 'Drawing choice is closed'; end if;
  select * into item from dm_private.attempt_items where attempt_id=p_attempt_id and question_id=p_question_id and kind='drawing';
  if not found then raise exception 'Drawing task unavailable'; end if;
  select number into section_id from dm_private.year_drawing_elective(p_attempt_id,p_question_id);
  if section_id is null and item.key#>'{drawing,alternatives}' is null then raise exception 'No drawing choice is required'; end if;
  if item.key#>'{drawing,alternatives}' is not null then
    if not exists(select from jsonb_array_elements(item.key#>'{drawing,alternatives}') a where a->>'id'=p_alternative) then
      raise exception 'Select a printed alternative'; end if;
  elsif p_alternative is not null then raise exception 'No alternative is available'; end if;
  select * into previous from dm_private.year_drawing_choices where attempt_id=p_attempt_id and
    (question_id=p_question_id or (section_id is not null and section_number=section_id));
  changed:=previous.question_id is distinct from p_question_id or previous.alternative is distinct from p_alternative;
  if not changed then return; end if;
  if exists(select from dm_private.drawing_uploads where attempt_id=p_attempt_id and question_id=previous.question_id) then
    raise exception 'Remove the uploaded pages before changing your drawing choice'; end if;
  delete from dm_private.year_drawing_choices where attempt_id=p_attempt_id and question_id=previous.question_id;
  insert into dm_private.year_drawing_choices(attempt_id,question_id,section_number,alternative)
    values(p_attempt_id,p_question_id,section_id,p_alternative);
end $$;
revoke all on function public.choose_year_drawing_task(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.choose_year_drawing_task(uuid,uuid,text) to authenticated;

create or replace function dm_private.year_drawing_alternative(p_attempt_id uuid,p_question_id uuid) returns jsonb
language sql stable set search_path=pg_catalog,dm_private as $$
  select to_jsonb(c.alternative) from dm_private.year_drawing_choices c
    where c.attempt_id=p_attempt_id and c.question_id=p_question_id
$$;
revoke all on function dm_private.year_drawing_alternative(uuid,uuid) from public,anon,authenticated,service_role;
