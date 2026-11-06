create index community_posts_author_rate_idx on dm_private.community_posts(author_id,created_at desc);
create index community_comments_author_rate_idx on dm_private.community_comments(author_id,created_at desc);
create index community_reports_reporter_rate_idx on dm_private.community_reports(reporter_id,created_at desc);

create or replace function public.create_community_post(p_exam text,p_topic text,p_title text,p_body text)returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v uuid;
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended('community-post:'||auth.uid()::text,0));
  if(select count(*)from dm_private.community_posts where author_id=auth.uid()and created_at>now()-interval'1 hour')>=5 then raise exception'Too many community posts. Please try again later';end if;
  insert into dm_private.community_posts(author_id,exam,topic,title,body)values(auth.uid(),lower(trim(p_exam)),trim(p_topic),trim(p_title),trim(p_body))returning id into v;
  return v;
end$$;

create or replace function public.add_community_comment(p_post_id uuid,p_parent_id uuid,p_body text)returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v uuid;
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended('community-comment:'||auth.uid()::text,0));
  if(select count(*)from dm_private.community_comments where author_id=auth.uid()and created_at>now()-interval'1 hour')>=30 then raise exception'Too many replies. Please try again later';end if;
  if not exists(select 1 from dm_private.community_posts where id=p_post_id and status='visible')then raise exception'Post is unavailable or locked';end if;
  if p_parent_id is not null and not exists(select 1 from dm_private.community_comments where id=p_parent_id and post_id=p_post_id and status='visible')then raise exception'Reply target not found';end if;
  insert into dm_private.community_comments(post_id,parent_id,author_id,body)values(p_post_id,p_parent_id,auth.uid(),trim(p_body))returning id into v;
  return v;
end$$;

create or replace function public.mark_community_helpful(p_comment_id uuid)returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  if exists(select 1 from dm_private.community_comments where id=p_comment_id and author_id=auth.uid())then raise exception'You cannot mark your own reply helpful';end if;
  if not exists(select 1 from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id where c.id=p_comment_id and c.status='visible'and p.status<>'hidden')then raise exception'Reply unavailable';end if;
  insert into dm_private.community_helpful values(auth.uid(),p_comment_id)on conflict do nothing;
  if found then update dm_private.community_comments set helpful_count=helpful_count+1 where id=p_comment_id;end if;
end$$;

create or replace function public.report_community_content(p_post_id uuid,p_comment_id uuid,p_reason text,p_details text default null)returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended('community-report:'||auth.uid()::text,0));
  if p_reason not in('spam','abuse','copyright','answer_leak','other')or char_length(coalesce(p_details,''))>1000 then raise exception'Invalid community report';end if;
  if(p_post_id is null)=(p_comment_id is null)then raise exception'Choose one community target';end if;
  if(select count(*)from dm_private.community_reports where reporter_id=auth.uid()and created_at>now()-interval'1 hour')>=10 then raise exception'Too many reports. Please try again later';end if;
  if p_post_id is not null and not exists(select 1 from dm_private.community_posts where id=p_post_id and status<>'hidden')then raise exception'Post unavailable';end if;
  if p_comment_id is not null and not exists(select 1 from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id where c.id=p_comment_id and c.status='visible'and p.status<>'hidden')then raise exception'Reply unavailable';end if;
  insert into dm_private.community_reports(reporter_id,post_id,comment_id,reason,details)values(auth.uid(),p_post_id,p_comment_id,p_reason,nullif(trim(p_details),''));
end$$;
