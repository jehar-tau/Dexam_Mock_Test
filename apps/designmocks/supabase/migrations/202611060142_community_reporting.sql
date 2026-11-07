begin;

-- Preserve the public void signature and one report per account/target. Known
-- duplicate receipts precede quota/visibility checks and never overwrite notes.
create or replace function public.report_community_content(p_post_id uuid,p_comment_id uuid,p_reason text,p_details text default null)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); parent_post_id uuid; target dm_private.community_posts;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501',detail='community_report_sign_in'; end if;
 if (p_post_id is null)=(p_comment_id is null) or p_reason is null or p_reason not in('spam','abuse','copyright','answer_leak','other')
  or char_length(coalesce(p_details,''))>1000 then
  raise exception 'Invalid community report' using errcode='22023',detail='community_report_invalid';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-report:'||actor::text,0));
 if exists(select 1 from dm_private.community_reports where reporter_id=actor and
  ((p_post_id is not null and post_id=p_post_id) or (p_comment_id is not null and comment_id=p_comment_id))) then
  raise exception 'This account has already reported this content' using errcode='23505',detail='community_report_exists';
 end if;
 if(select count(*) from dm_private.community_reports where reporter_id=actor and created_at>clock_timestamp()-interval'1 hour')>=10 then
  raise exception 'Too many reports. Please try again later' using errcode='P0001',detail='community_report_limit';
 end if;
 parent_post_id:=coalesce(p_post_id,(select post_id from dm_private.community_comments where id=p_comment_id));
 select * into target from dm_private.community_posts where id=parent_post_id and status<>'hidden' for share;
 if not found then raise exception 'Community content is unavailable' using errcode='42501',detail='community_report_unavailable'; end if;
 if p_comment_id is not null then
  perform 1 from dm_private.community_comments where id=p_comment_id and post_id=target.id and status='visible' for share;
  if not found then raise exception 'Community content is unavailable' using errcode='42501',detail='community_report_unavailable'; end if;
 end if;
 insert into dm_private.community_reports(reporter_id,post_id,comment_id,reason,details,created_at)
 values(actor,p_post_id,p_comment_id,p_reason,nullif(trim(p_details),''),clock_timestamp());
end $$;
revoke all on function public.report_community_content(uuid,uuid,text,text) from public,anon;
grant execute on function public.report_community_content(uuid,uuid,text,text) to authenticated;

commit;
