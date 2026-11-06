-- Approved drafts become immutable canonical-review artifacts. They still require
-- a reviewed Git change before the canonical importer can see them.
create extension if not exists pgcrypto;

create table dm_private.question_draft_exports(
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null unique references dm_private.question_drafts(id),
  external_key text not null unique check(external_key~'^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  content_sha256 text not null check(content_sha256~'^[0-9a-f]{64}$'),
  payload jsonb not null,
  rights_note text not null check(char_length(rights_note)between 10 and 1000),
  exported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table dm_private.question_draft_exports enable row level security;
revoke all on dm_private.question_draft_exports from anon,authenticated;

create or replace function public.admin_export_question_draft(p_draft_id uuid,p_external_key text,p_rights_confirmed boolean,p_rights_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare d dm_private.question_drafts;v_payload jsonb;v dm_private.question_draft_exports;
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  if p_rights_confirmed is distinct from true then raise exception'Rights confirmation is required';end if;
  p_external_key:=lower(trim(p_external_key));p_rights_note:=trim(p_rights_note);
  if p_external_key!~'^[a-z0-9]+(?:-[a-z0-9]+)*$'then raise exception'External key must be lowercase words separated by hyphens';end if;
  if char_length(p_rights_note)not between 10 and 1000 then raise exception'Rights note must be 10 to 1000 characters';end if;
  select*into d from dm_private.question_drafts where id=p_draft_id for update;
  if d.id is null or d.status<>'approved'then raise exception'Only an approved draft can be exported';end if;
  if jsonb_typeof(d.payload)<>'object'or char_length(trim(d.payload->>'prompt'))<3
    or coalesce(d.payload->>'type','')not in('MCQ','MSQ','NAT','DESCRIPTIVE')
    or char_length(trim(d.payload#>>'{provenance,exam}'))<2 then raise exception'Draft is missing canonical prompt, type, or provenance.exam';end if;
  v_payload:=(d.payload-'externalKey'-'holds')||jsonb_build_object('externalKey',p_external_key,'holds','[]'::jsonb);
  insert into dm_private.question_draft_exports(draft_id,external_key,content_sha256,payload,rights_note,exported_by)
  values(d.id,p_external_key,encode(digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex'),v_payload,p_rights_note,auth.uid())returning*into v;
  update dm_private.question_drafts set status='exported'where id=d.id;
  return jsonb_build_object('id',v.id,'externalKey',v.external_key,'contentSha256',v.content_sha256,'payload',v.payload,'rightsNote',v.rights_note,'createdAt',v.created_at,'publicationState','git-review-required');
exception when unique_violation then
  raise exception'External key or draft has already been exported';
end$$;

create or replace function public.admin_question_drafts()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public as $$
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'sourceType',d.source_type,'sourceName',d.source_name,'payload',d.payload,'status',d.status,'reviewNote',d.review_note,'createdAt',d.created_at,'export',case when e.id is null then null else jsonb_build_object('id',e.id,'externalKey',e.external_key,'contentSha256',e.content_sha256,'payload',e.payload,'rightsNote',e.rights_note,'createdAt',e.created_at,'publicationState','git-review-required')end)order by d.created_at desc),'[]')from dm_private.question_drafts d left join dm_private.question_draft_exports e on e.draft_id=d.id);
end$$;

revoke all on function public.admin_export_question_draft(uuid,text,boolean,text)from public,anon;
grant execute on function public.admin_export_question_draft(uuid,text,boolean,text)to authenticated;
