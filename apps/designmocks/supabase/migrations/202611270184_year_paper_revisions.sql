-- Server-staged, digest-bound revisions of the same historical paper. Student
-- attempts keep their original question IDs, item snapshots and Storage paths.
create table dm_private.year_paper_revisions (
  digest text primary key check (digest ~ '^[a-f0-9]{64}$'),
  document jsonb not null check (jsonb_typeof(document)='object'),
  verified_manifest text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  previous_preparation jsonb,
  applied_at timestamptz,
  check (digest=encode(sha256(convert_to(document::text,'UTF8')),'hex'))
);
alter table dm_private.year_paper_revisions enable row level security;
revoke all on dm_private.year_paper_revisions from public,anon,authenticated,service_role;

create function public.approve_year_paper_revision(p_digest text,p_manifest text) returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare revision dm_private.year_paper_revisions;
begin
  if auth.uid() is null or not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into strict revision from dm_private.year_paper_revisions where digest=p_digest for update;
  perform 1 from dm_private.admins where user_id=auth.uid() for share;
  if not found then raise exception 'Admin access required' using errcode='42501'; end if;
  if revision.verified_manifest is null or revision.verified_manifest is distinct from p_manifest then
    raise exception 'The rehearsed paper manifest is required'; end if;
  if revision.applied_at is null and revision.approved_by is distinct from auth.uid() then
    update dm_private.year_paper_revisions set approved_by=auth.uid(),approved_at=clock_timestamp() where digest=p_digest;
  end if;
end $$;
revoke all on function public.approve_year_paper_revision(text,text) from public,anon,service_role;
grant execute on function public.approve_year_paper_revision(text,text) to authenticated;

create function dm_private.install_year_paper_revision(revision dm_private.year_paper_revisions) returns text
language plpgsql set search_path=pg_catalog,dm_private,public as $$
declare
  doc jsonb:=revision.document; plan jsonb:=doc->'plan'; exam_name text:=plan->>'exam';
  source_id text:=plan->>'sourcePaperId'; yr integer:=(plan->>'year')::integer;
  pid uuid:=(doc->>'paperId')::uuid; old_release dm_private.year_paper_releases;
  cnt integer:=jsonb_array_length(plan->'questions'); item jsonb; rec jsonb; raw jsonb;
  bank dm_private.bank_questions; curr dm_private.questions; grade jsonb; runtime jsonb;
  n integer:=0; qid uuid; previous_key text; manifest text; note text; prep_sha text;
  media jsonb:=doc->'media'; runtime_batch jsonb; off integer;
begin
  if doc->>'format' is distinct from 'dmocks-year-revision-v1'
    or plan->>'format' is distinct from 'dmocks-free-year-paper-v1'
    or exam_name is null or exam_name not in ('ceed','uceed') or yr is null or yr not between 2000 and 2100
    or source_id is distinct from exam_name||'-'||yr or pid is null
    or coalesce(doc->>'sourceCommit','') !~ '^[a-f0-9]{40}$' or coalesce(doc->>'planSha256','') !~ '^[a-f0-9]{64}$'
    or coalesce(char_length(plan->>'title'),0) not between 2 and 180
    or coalesce(char_length(plan->>'partLabel'),0) not between 2 and 40
    or coalesce(char_length(plan->>'markingReference'),0) not between 8 and 2000
    or coalesce((plan->>'durationSeconds')::int,0) not between 60 and 21600
    or jsonb_typeof(plan->'questions') is distinct from 'array' or cnt not between 1 and 200
    or jsonb_typeof(doc->'items') is distinct from 'array' or jsonb_array_length(doc->'items')<>cnt
    or jsonb_typeof(media) is distinct from 'array' or jsonb_array_length(media)>200
    or (select count(distinct i->'record'->>'externalKey') from jsonb_array_elements(doc->'items') i)<>cnt
    or (select count(distinct i->>'id') from jsonb_array_elements(doc->'items') i)<>cnt then
    raise exception 'Invalid scoped year-paper revision';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-question-bank-import',0));
  perform pg_advisory_xact_lock(hashtextextended('year-paper-revision:'||source_id,0));
  select * into old_release from dm_private.year_paper_releases
    where exam=exam_name and source_paper_id=source_id and part_label=plan->>'partLabel' for update;
  if old_release.paper_id is not null then
    perform dm_private.lock_year_paper(old_release.paper_id);
    if old_release.paper_id<>pid or old_release.review_sha256 is distinct from doc->>'baseManifest'
      or old_release.question_count<>cnt or not dm_private.year_paper_ready(pid) then
      raise exception 'The released base paper changed'; end if;
  elsif doc->>'baseManifest' is not null or exists(select 1 from dm_private.papers where id=pid) then
    raise exception 'The initial paper identity changed';
  end if;
  if (select count(*) from dm_private.bank_questions b where b.active and b.exam=exam_name
    and b.payload#>>'{provenance,paperId}'=source_id and b.payload#>>'{provenance,year}'=yr::text
    and b.question_type<>'DESCRIPTIVE' and b.payload->'holds'='[]'::jsonb)<>cnt then
    raise exception 'The complete hold-free objective source group is required'; end if;
  for item in select value from jsonb_array_elements(doc->'items') loop
    rec:=item->'record';raw:=rec->'payload';grade:=plan->'questions'->n;n:=n+1;
    select * into strict bank from dm_private.bank_questions where external_key=rec->>'externalKey' for update;
    if not bank.active or bank.exam<>exam_name or bank.payload#>>'{provenance,paperId}' is distinct from source_id
      or bank.question_type='DESCRIPTIVE' or bank.content_sha256 is distinct from item->>'previousContentSha256'
      or exists(select 1 from dm_private.bank_local_holds where external_key=bank.external_key)
      or raw->>'externalKey' is distinct from bank.external_key or rec->>'exam' is distinct from exam_name
      or raw#>>'{provenance,exam}' is distinct from exam_name or raw#>>'{provenance,paperId}' is distinct from source_id
      or raw#>>'{provenance,year}' is distinct from yr::text or raw->'holds' is distinct from '[]'::jsonb
      or raw->>'type' is distinct from rec->>'type' or rec->>'type' not in ('MCQ','MSQ','NAT')
      or rec->>'externalKey' is distinct from grade->>'externalKey'
      or rec->>'contentSha256' is distinct from grade->>'contentSha256'
      or item->'runtime'->>'kind' not in ('mcq','msq','nat') or jsonb_typeof(item->'runtime') is distinct from 'object'
      or coalesce(char_length(btrim(grade->>'explanation')),0) not between 20 and 10000
      or jsonb_typeof(grade#>'{marking,correct}') is distinct from 'number'
      or jsonb_typeof(grade#>'{marking,wrong}') is distinct from 'number'
      or (grade#>>'{marking,correct}')::numeric<=0 or (grade#>>'{marking,correct}')::numeric>100
      or (grade#>>'{marking,wrong}')::numeric not between -100 and 0 then
      raise exception 'Source, key, marking or explanation changed at question %',n;
    end if;
    update dm_private.bank_questions set content_sha256=rec->>'contentSha256',payload=raw,exam=exam_name,
      question_type=rec->>'type',topic=rec->>'topic',licence=rec->>'licence',source_commit=doc->>'sourceCommit'
      where external_key=bank.external_key;
  end loop;
  for rec in select value from jsonb_array_elements(media) loop
    if not exists(select 1 from jsonb_array_elements(doc->'items') it,
      lateral jsonb_array_elements(it#>'{record,payload,assets}') a
      where a->>'sha256'=rec->>'sha256' and a->>'path' ~ ('^'||source_id||'/figures/[a-zA-Z0-9_.-]+\.png$')) then
      raise exception 'Media is outside this paper’s diagram scope'; end if;
  end loop;
  for off in 0..(jsonb_array_length(media)-1)/100 loop
    select jsonb_agg(value order by ordinal) into runtime_batch from jsonb_array_elements(media) with ordinality a(value,ordinal)
      where ordinal between off*100+1 and (off+1)*100;
    if runtime_batch is not null then perform public.register_bank_media_assets(runtime_batch); end if;
  end loop;
  for off in 0..(cnt-1)/100 loop
    select jsonb_agg(jsonb_build_object('externalKey',it#>>'{record,externalKey}','contentSha256',it#>>'{record,contentSha256}',
      'exam',exam_name,'runtime',it->'runtime') order by ordinal) into runtime_batch
      from jsonb_array_elements(doc->'items') with ordinality a(it,ordinal) where ordinal between off*100+1 and (off+1)*100;
    perform public.upsert_question_bank_runtime_batch(runtime_batch);
  end loop;
  note:='Owner-approved reviewed historical year paper '||source_id||', revision '||revision.digest;
  if old_release.paper_id is null then
    insert into dm_private.papers(id,title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind)
      values(pid,plan->>'title',exam_name,(plan->>'durationSeconds')::int,true,true,true,'year');
  else
    update dm_private.papers set title=plan->>'title',duration_seconds=(plan->>'durationSeconds')::int where id=pid;
  end if;
  n:=0;
  for item in select value from jsonb_array_elements(doc->'items') loop
    rec:=item->'record';qid:=(item->>'id')::uuid;grade:=plan->'questions'->n;n:=n+1;
    update dm_private.bank_questions set owner_approved=true,rights_confirmed=true,reviewed_by=revision.approved_by,
      reviewed_at=clock_timestamp(),review_note=note where external_key=rec->>'externalKey'
      and runtime_payload=item->'runtime' and runtime_payload->>'kind' in ('mcq','nat','msq')
      returning runtime_payload into strict runtime;
    if revision.approved_by is not null then
      insert into dm_private.bank_question_reviews(external_key,reviewer_id,approved,rights_confirmed,note)
        values(rec->>'externalKey',revision.approved_by,true,true,note);
    end if;
    if old_release.paper_id is not null then
      select * into strict curr from dm_private.questions where id=qid and paper_id=pid and ordinal=n;
      select key->>'sourceExternalKey' into strict previous_key from dm_private.answer_keys where question_id=qid;
      if previous_key is distinct from rec->>'externalKey' then raise exception 'Frozen question identity changed'; end if;
      update dm_private.questions set prompt=runtime->>'prompt',options=runtime->'options',kind=runtime->>'kind',
        marking=grade->'marking',media=runtime->'media',points=(grade#>>'{marking,correct}')::numeric,
        negative_points=-(grade#>>'{marking,wrong}')::numeric,topic=rec->>'topic',reviewed=true where id=qid;
      update dm_private.answer_keys set key=runtime->'key',explanation=grade->>'explanation' where question_id=qid;
    else
      insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
        values(qid,pid,n,runtime->>'prompt',runtime->'options',runtime->>'kind',grade->'marking',runtime->'media',
          (grade#>>'{marking,correct}')::numeric,-(grade#>>'{marking,wrong}')::numeric,rec->>'topic',true);
      insert into dm_private.answer_keys(question_id,key,explanation) values(qid,runtime->'key',grade->>'explanation');
    end if;
  end loop;
  manifest:=dm_private.year_paper_manifest(pid);
  prep_sha:=encode(sha256(convert_to(plan::text,'UTF8')),'hex');
  if old_release.paper_id is not null then
    update dm_private.year_paper_revisions set previous_preparation=(select to_jsonb(p) from dm_private.year_paper_preparations p where p.paper_id=pid)
      where digest=revision.digest;
    update dm_private.year_paper_releases set review_sha256=manifest,released_at=clock_timestamp() where paper_id=pid;
  end if;
  insert into dm_private.year_paper_preparations(plan_sha256,paper_id,manifest_sha256,marking_reference)
    values(prep_sha,pid,manifest,plan->>'markingReference')
    on conflict(paper_id) do update set plan_sha256=excluded.plan_sha256,manifest_sha256=excluded.manifest_sha256,
      marking_reference=excluded.marking_reference,prepared_at=clock_timestamp();
  perform public.register_free_year_paper(pid,exam_name,yr,source_id,plan->>'partLabel',cnt,manifest);
  return manifest;
end $$;
revoke all on function dm_private.install_year_paper_revision(dm_private.year_paper_revisions) from public,anon,authenticated,service_role;

create function public.publish_year_paper_revision(p_digest text,p_manifest text) returns text
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare revision dm_private.year_paper_revisions; result text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into strict revision from dm_private.year_paper_revisions where digest=p_digest for update;
  if revision.applied_at is not null then
    if revision.verified_manifest is distinct from coalesce(p_manifest,revision.verified_manifest)
      or dm_private.year_paper_manifest((revision.document->>'paperId')::uuid) is distinct from revision.verified_manifest
      or not dm_private.year_paper_ready((revision.document->>'paperId')::uuid) then raise exception 'Applied revision changed'; end if;
    return revision.verified_manifest;
  end if;
  if p_manifest is null then
    -- The dry run executes the same release and rolls it back, including every
    -- source, media registry, preparation and review write. Return its digest.
    begin
      result:=dm_private.install_year_paper_revision(revision);
      raise exception using errcode='ZYP01',message='Roll back paper rehearsal';
    exception when sqlstate 'ZYP01' then null; end;
    update dm_private.year_paper_revisions set verified_manifest=result where digest=p_digest;
    return result;
  end if;
  if revision.verified_manifest is distinct from p_manifest or revision.approved_by is null then
    raise exception 'Owner approval of the exact rehearsed manifest is required'; end if;
  perform 1 from dm_private.admins where user_id=revision.approved_by for share;
  if not found then raise exception 'Owner reviewer is no longer authorized' using errcode='42501'; end if;
  result:=dm_private.install_year_paper_revision(revision);
  if result is distinct from p_manifest then raise exception 'Rehearsed paper manifest changed'; end if;
  update dm_private.year_paper_revisions set applied_at=clock_timestamp() where digest=p_digest;
  return result;
end $$;
revoke all on function public.publish_year_paper_revision(text,text) from public,anon,authenticated;
grant execute on function public.publish_year_paper_revision(text,text) to service_role;
