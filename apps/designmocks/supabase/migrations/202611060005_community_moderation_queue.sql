alter table dm_private.community_reports add column status text not null default 'open' check(status in('open','resolved')),add column resolved_at timestamptz,add column resolved_by uuid references auth.users(id),add column resolution text check(resolution is null or resolution in('hide','dismiss'));
create index community_reports_open_idx on dm_private.community_reports(created_at) where status='open';
create or replace function public.admin_community_report_queue() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'targetType',case when r.post_id is null then'comment'else'post'end,'targetId',coalesce(r.post_id,r.comment_id),'reason',r.reason,'details',r.details,'createdAt',r.created_at,'content',coalesce(p.title||E'\n'||p.body,c.body),'contentStatus',coalesce(p.status,c.status)) order by r.created_at),'[]') from dm_private.community_reports r left join dm_private.community_posts p on p.id=r.post_id left join dm_private.community_comments c on c.id=r.comment_id where r.status='open');
end $$;
create or replace function public.admin_resolve_community_report(p_report_id uuid,p_resolution text,p_note text default null) returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare r dm_private.community_reports;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if p_resolution not in('hide','dismiss') then raise exception 'Invalid resolution'; end if;
  select*into r from dm_private.community_reports where id=p_report_id and status='open' for update;
  if r.id is null then raise exception 'Community report not found'; end if;
  if p_resolution='hide' then perform public.admin_moderate_community(case when r.post_id is null then'comment'else'post'end,coalesce(r.post_id,r.comment_id),'hide',p_note); end if;
  update dm_private.community_reports set status='resolved',resolved_at=now(),resolved_by=auth.uid(),resolution=p_resolution where id=r.id;
end $$;
revoke all on function public.admin_community_report_queue(),public.admin_resolve_community_report(uuid,text,text) from public,anon;
grant execute on function public.admin_community_report_queue(),public.admin_resolve_community_report(uuid,text,text) to authenticated;
