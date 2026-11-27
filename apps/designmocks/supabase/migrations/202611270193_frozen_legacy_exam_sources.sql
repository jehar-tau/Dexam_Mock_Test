-- An unpublished legacy mock can share a canonical key with a newly ingested
-- year paper. Verify the existing attempts already carry their entire original
-- scoring and review inputs, including any private figures.
create function dm_private.unpublished_exam_attempts_frozen(p_paper uuid,p_question uuid)
returns boolean language sql stable set search_path=pg_catalog,dm_private as $$
  select not exists(
    select 1 from dm_private.attempts a where a.paper_id=p_paper and (
      a.status<>'submitted' or a.submitted_at is null or a.score is null or a.total is null or not exists(
        select 1 from dm_private.attempt_items i join dm_private.questions q on q.id=i.question_id
        join dm_private.answer_keys k on k.question_id=q.id
        where i.attempt_id=a.id and q.id=p_question and q.paper_id=p_paper
          and row(i.ordinal,i.prompt,i.options,i.kind,i.marking,i.points,i.negative_points,i.topic,i.media,i.key,i.explanation)
            is not distinct from row(q.ordinal,q.prompt,q.options,q.kind,q.marking,q.points,q.negative_points,q.topic,q.media,k.key,k.explanation)
          and jsonb_typeof(i.media)='array'
          and not exists(select 1 from jsonb_array_elements(i.media) m
            left join dm_private.bank_media_assets media on media.sha256=m->>'sha256'
            left join storage.objects object on object.bucket_id='paper-media' and object.name=media.storage_path
            where media.storage_path is distinct from m->>'path' or media.width::text is distinct from m->>'width'
              or media.height::text is distinct from m->>'height' or object.metadata->>'mimetype' is distinct from 'image/png'
              or object.metadata->>'size' is distinct from media.byte_size::text)
      )
    )
  )
$$;
revoke all on function dm_private.unpublished_exam_attempts_frozen(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.stage_objective_year_sources(p_plan jsonb,p_source_commit text,p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  source_id text := p_plan->>'sourcePaperId';
  exam_id text := p_plan->>'exam';
  r jsonb;
  b dm_private.bank_questions;
  n integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_plan->>'format' is distinct from 'dmocks-free-year-paper-v1'
    or coalesce(exam_id,'') not in ('ceed','uceed','nift','nid')
    or coalesce(source_id,'') !~ '^[a-z0-9-]{4,100}$'
    or coalesce(p_source_commit,'') !~ '^[0-9a-f]{40}$'
    or coalesce(p_plan->>'year','') !~ '^20[0-9]{2}$'
    or jsonb_typeof(p_plan->'questions') is distinct from 'array'
    or jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Invalid objective year source plan'; end if;
  n:=jsonb_array_length(p_plan->'questions');
  if n not between 1 and 200 or jsonb_array_length(p_records)<>n
    or (select count(distinct entry->>'externalKey') from jsonb_array_elements(p_records) entry)<>n
    or (select count(distinct entry->>'externalKey') from jsonb_array_elements(p_plan->'questions') entry)<>n then
    raise exception 'Objective source count differs from plan'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-question-bank-import',0));
  if exists(select 1 from dm_private.year_paper_releases where source_paper_id=source_id and exam=exam_id)
    or exists(select 1 from dm_private.bank_import_runs where status='importing') then
    raise exception 'Year source is released or a bank import is in progress'; end if;
  for r in select value from jsonb_array_elements(p_records) loop
    if (r->>'type') is null or (r->>'type') not in ('MCQ','MSQ','NAT')
      or r->>'type' is distinct from r#>>'{payload,type}'
      or r->>'exam' is distinct from exam_id or lower(r#>>'{payload,provenance,exam}') is distinct from exam_id
      or r#>>'{payload,provenance,paperId}' is distinct from source_id
      or r#>>'{payload,provenance,year}' is distinct from p_plan->>'year'
      or r#>'{payload,holds}' is distinct from '[]'::jsonb
      or r->>'externalKey' is distinct from r#>>'{payload,externalKey}'
      or coalesce(r->>'contentSha256','') !~ '^[a-f0-9]{64}$'
      or not exists(select 1 from jsonb_array_elements(p_plan->'questions') item
                    where item->>'externalKey'=r->>'externalKey' and item->>'contentSha256'=r->>'contentSha256') then
      raise exception 'Objective record differs from its plan'; end if;
    select * into b from dm_private.bank_questions where external_key=r->>'externalKey' for update;
    if found then
      if b.exam is distinct from exam_id or b.payload#>>'{provenance,paperId}' is distinct from source_id
         or b.payload#>>'{provenance,year}' is distinct from p_plan->>'year' then raise exception 'External key belongs to another paper'; end if;
      if b.active then
        if b.content_sha256 is distinct from r->>'contentSha256' or b.payload is distinct from r->'payload' then
          raise exception 'Active source already differs'; end if;
        continue;
      end if;
      -- Prevent a concurrent publication of a paper while checking old bindings.
      perform p.id from dm_private.answer_keys k join dm_private.questions q on q.id=k.question_id
        join dm_private.papers p on p.id=q.paper_id where k.key->>'sourceExternalKey'=b.external_key
        order by p.id for share of p;
      if exists(select 1 from dm_private.answer_keys k join dm_private.questions q on q.id=k.question_id
        join dm_private.papers p on p.id=q.paper_id where k.key->>'sourceExternalKey'=b.external_key
        and (p.published or exists(select 1 from dm_private.year_paper_releases y where y.paper_id=p.id)
          or (exists(select 1 from dm_private.attempts a where a.paper_id=p.id) and
            (p.source_kind<>'exam' or not dm_private.unpublished_exam_attempts_frozen(p.id,q.id))))) then
        raise exception 'Retired source is bound to a published paper or an unfrozen attempt'; end if;
    end if;
    insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,payload,source_commit)
    values(r->>'externalKey',r->>'contentSha256',exam_id,r->>'type',r->>'topic',r->>'licence',
           coalesce((r->>'objectiveReady')::boolean,false),r->'payload',p_source_commit)
    on conflict(external_key) do update set active=true,content_sha256=excluded.content_sha256,
      exam=excluded.exam,question_type=excluded.question_type,topic=excluded.topic,licence=excluded.licence,
      objective_ready=excluded.objective_ready,payload=excluded.payload,source_commit=excluded.source_commit,
      imported_at=now(),runtime_payload=null;
  end loop;
  if (select count(*) from dm_private.bank_questions q where q.active and q.exam=exam_id
    and q.question_type<>'DESCRIPTIVE' and q.payload#>>'{provenance,paperId}'=source_id)<>n then
    raise exception 'Objective source group contains records outside plan'; end if;
  return n;
end$$;
