begin;

create function public.admin_read_question_export(p_export_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  artifact record;
begin
  -- Hold membership through the read so a concurrent revocation is ordered
  -- with the disclosure. The artifact and draft are read from one snapshot.
  perform 1 from dm_private.admins where user_id=auth.uid() for key share;
  if not found then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  select e.id,e.external_key,e.content_sha256,e.payload::text as payload_text,
    e.rights_note,e.created_at,d.source_type
  into artifact
  from dm_private.question_draft_exports e
  join dm_private.question_drafts d on d.id=e.draft_id and d.status='exported'
  where e.id=p_export_id
    and jsonb_typeof(e.payload)='object'
    and e.payload->'externalKey'=to_jsonb(e.external_key)
    and e.payload->'holds'='[]'::jsonb;
  if not found or encode(sha256(convert_to(artifact.payload_text,'UTF8')),'hex') is distinct from artifact.content_sha256 then
    raise exception 'Question export packet unavailable';
  end if;

  return jsonb_build_object(
    'format','dmocks-question-export-v1',
    'artifactId',artifact.id,
    'externalKey',artifact.external_key,
    'contentSha256',artifact.content_sha256,
    'payloadText',artifact.payload_text,
    'rightsNote',artifact.rights_note,
    'createdAt',artifact.created_at,
    'sourceType',artifact.source_type,
    'publicationState','git-review-required'
  );
end $$;

revoke all on function public.admin_read_question_export(uuid) from public,anon,authenticated,service_role;
do $$begin
  if to_regclass('dm_private.mvp_rpc_allowlist') is null then
    grant execute on function public.admin_read_question_export(uuid) to authenticated;
  end if;
end $$;

commit;
