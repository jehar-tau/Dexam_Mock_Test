-- AIM figures are part of the private paper plan, not of the active year-paper bank.
-- Register the verified uploads in the same transaction that stages the paper.
begin;

alter function public.stage_all_india_paper(jsonb,text) set schema dm_private;
revoke all on function dm_private.stage_all_india_paper(jsonb,text) from public,anon,authenticated,service_role;

create function public.stage_all_india_paper(p_plan jsonb,p_plan_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  v_paper_key text:=p_plan->>'paperKey';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_plan_sha256 is null or p_plan_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Exact plan digest required'; end if;

  -- Match the lock in the original staging function. An exact retry can restore
  -- an uploaded object without registering any extra figures against an existing paper.
  perform pg_advisory_xact_lock(hashtextextended('all-india-paper:'||v_paper_key,33));
  if not exists(select 1 from dm_private.all_india_paper_sources s where s.paper_key=v_paper_key) then
    insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size)
    select distinct figure->>'sha256',stored.name,(figure->>'width')::integer,(figure->>'height')::integer,
      (stored.metadata->>'size')::integer
    from jsonb_path_query(p_plan,'strict $.questions[*].runtime.media[*]','{}',true) figure
    join storage.objects stored on stored.bucket_id='paper-media'
      and stored.name='papers/canonical/'||(figure->>'sha256')||'.png' and stored.name=figure->>'path'
    join storage.buckets bucket on bucket.id=stored.bucket_id and not bucket.public
      and 'image/png'=any(bucket.allowed_mime_types)
    where figure->>'sha256' ~ '^[a-f0-9]{64}$' and stored.metadata->>'mimetype'='image/png'
    order by 1
    on conflict(sha256) do nothing;
  end if;
  return dm_private.stage_all_india_paper(p_plan,p_plan_sha256);
end $$;

revoke all on function public.stage_all_india_paper(jsonb,text) from public,anon,authenticated;
grant execute on function public.stage_all_india_paper(jsonb,text) to service_role;

commit;
