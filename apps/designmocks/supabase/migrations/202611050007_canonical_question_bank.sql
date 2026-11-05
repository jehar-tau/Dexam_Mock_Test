create table dm_private.bank_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_commit text not null check(source_commit ~ '^[0-9a-f]{40}$'),
  source_path text not null,
  source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
  schema_version integer not null,
  source_total integer not null check(source_total >= 0),
  eligible_total integer not null check(eligible_total >= 0),
  held_total integer not null check(held_total >= 0 and source_total=eligible_total+held_total),
  imported_count integer not null default 0,
  status text not null default 'importing' check(status in ('importing','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(source_commit,source_sha256)
);

create table dm_private.bank_questions (
  external_key text primary key check(char_length(external_key) between 3 and 200),
  content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  exam text not null check(exam in ('uceed','nid','nift','ceed')),
  question_type text not null check(question_type in ('MCQ','MSQ','NAT','DESCRIPTIVE')),
  topic text not null,
  licence text not null,
  objective_ready boolean not null default false,
  owner_approved boolean not null default false,
  active boolean not null default true,
  payload jsonb not null check(jsonb_typeof(payload)='object' and payload ? 'holds' and jsonb_typeof(payload->'holds')='array' and payload->'holds'='[]'::jsonb),
  source_commit text not null,
  imported_at timestamptz not null default now()
);

create table dm_private.bank_import_run_items (
  run_id uuid not null references dm_private.bank_import_runs(id) on delete cascade,
  external_key text not null references dm_private.bank_questions(external_key),
  content_sha256 text not null,
  primary key(run_id,external_key)
);

alter table dm_private.bank_import_runs enable row level security;
alter table dm_private.bank_questions enable row level security;
alter table dm_private.bank_import_run_items enable row level security;
revoke all on dm_private.bank_import_runs,dm_private.bank_questions,dm_private.bank_import_run_items from anon,authenticated;

create or replace function public.begin_question_bank_import(p_source_commit text,p_source_path text,p_source_sha256 text,p_schema_version integer,p_source_total integer,p_eligible_total integer,p_held_total integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_source_path <> 'server/data/exports/dexam-bank-export.json' or p_schema_version <> 1 then raise exception 'Unsupported bank source'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-question-bank-import',0));
  if exists(select 1 from dm_private.bank_import_runs where status='importing' and (source_commit,source_sha256) is distinct from (lower(p_source_commit),lower(p_source_sha256))) then raise exception 'Another bank import is in progress'; end if;
  insert into dm_private.bank_import_runs(source_commit,source_path,source_sha256,schema_version,source_total,eligible_total,held_total)
  values(lower(p_source_commit),p_source_path,lower(p_source_sha256),p_schema_version,p_source_total,p_eligible_total,p_held_total)
  on conflict(source_commit,source_sha256) do update set source_path=excluded.source_path
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.import_question_bank_batch(p_run_id uuid,p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_run dm_private.bank_import_runs; v_record jsonb; v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_run from dm_private.bank_import_runs where id=p_run_id for update;
  if v_run.id is null or v_run.status not in ('importing','completed') then raise exception 'Import run unavailable'; end if;
  if v_run.status='completed' then return v_run.imported_count; end if;
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>200 then raise exception 'Invalid import batch'; end if;
  for v_record in select value from jsonb_array_elements(p_records) loop
    if v_record->'payload'->'holds' is distinct from '[]'::jsonb or v_record->>'externalKey' is distinct from v_record->'payload'->>'externalKey' then raise exception 'Only canonical empty-holds records may be imported'; end if;
    insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,payload,source_commit,active,imported_at)
    values(v_record->>'externalKey',v_record->>'contentSha256',lower(v_record->>'exam'),v_record->>'type',v_record->>'topic',v_record->>'licence',coalesce((v_record->>'objectiveReady')::boolean,false),v_record->'payload',v_run.source_commit,true,now())
    on conflict(external_key) do update set content_sha256=excluded.content_sha256,exam=excluded.exam,question_type=excluded.question_type,topic=excluded.topic,licence=excluded.licence,objective_ready=excluded.objective_ready,payload=excluded.payload,source_commit=excluded.source_commit,active=true,imported_at=now(),owner_approved=case when dm_private.bank_questions.content_sha256=excluded.content_sha256 then dm_private.bank_questions.owner_approved else false end;
    insert into dm_private.bank_import_run_items(run_id,external_key,content_sha256) values(p_run_id,v_record->>'externalKey',v_record->>'contentSha256') on conflict do nothing;
  end loop;
  select count(*) into v_count from dm_private.bank_import_run_items where run_id=p_run_id;
  update dm_private.bank_import_runs set imported_count=v_count where id=p_run_id;
  return v_count;
end $$;

create or replace function public.finish_question_bank_import(p_run_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_run dm_private.bank_import_runs;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_run from dm_private.bank_import_runs where id=p_run_id for update;
  if v_run.id is null then raise exception 'Import run unavailable'; end if;
  if v_run.status='completed' then return; end if;
  if v_run.imported_count <> v_run.eligible_total then raise exception 'Import count mismatch'; end if;
  update dm_private.bank_questions q set active=exists(select 1 from dm_private.bank_import_run_items i where i.run_id=p_run_id and i.external_key=q.external_key);
  update dm_private.bank_import_runs set status='completed',completed_at=coalesce(completed_at,now()) where id=p_run_id;
end $$;

revoke all on function public.begin_question_bank_import(text,text,text,integer,integer,integer,integer),public.import_question_bank_batch(uuid,jsonb),public.finish_question_bank_import(uuid) from public,anon,authenticated;
grant execute on function public.begin_question_bank_import(text,text,text,integer,integer,integer,integer),public.import_question_bank_batch(uuid,jsonb),public.finish_question_bank_import(uuid) to service_role;
