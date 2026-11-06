create or replace function public.admin_drawing_review_media_paths(p_review_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from dm_private.drawing_reviews where id=p_review_id) then raise exception 'Drawing review not found'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'ordinal',u.ordinal,'storagePath',u.storage_path,'mimeType',u.mime_type) order by u.ordinal),'[]')
    from dm_private.drawing_uploads u join dm_private.drawing_reviews r on r.attempt_id=u.attempt_id and r.question_id=u.question_id where r.id=p_review_id);
end $$;
revoke all on function public.admin_drawing_review_media_paths(uuid) from public,anon;
grant execute on function public.admin_drawing_review_media_paths(uuid) to authenticated;
