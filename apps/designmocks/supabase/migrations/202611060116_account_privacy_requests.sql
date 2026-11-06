create table dm_private.account_privacy_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id)on delete cascade,
  request_type text not null check(request_type in('account_deletion')),
  status text not null default'open'check(status in('open','in_progress','closed','declined','cancelled')),
  admin_note text,
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index account_privacy_one_active on dm_private.account_privacy_requests(user_id,request_type)where status in('open','in_progress');
alter table dm_private.account_privacy_requests enable row level security;
revoke all on dm_private.account_privacy_requests from anon,authenticated;

create or replace function public.export_my_account_data()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception'Sign in required';end if;
  return jsonb_build_object(
    'schemaVersion',1,'exportedAt',now(),'accountId',u,
    'profile',(select to_jsonb(p)from public.profiles p where p.user_id=u),
    'access',jsonb_build_object(
      'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'planId',plan_id,'amount',amount,'currency',currency,'mode',mode,'status',status,'createdAt',created_at,'paidAt',paid_at)order by created_at)from dm_private.orders where user_id=u),'[]'),
      'passes',coalesce((select jsonb_agg(jsonb_build_object('mode',mode,'startsAt',starts_at,'expiresAt',expires_at))from dm_private.passes where user_id=u),'[]')),
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'paper',p.title,'exam',p.exam,'status',a.status,'startedAt',a.started_at,'deadline',a.deadline,'submittedAt',a.submitted_at,'score',a.score,'total',a.total,'responses',(select coalesce(jsonb_agg(jsonb_build_object('questionId',i.question_id,'ordinal',i.ordinal,'topic',i.topic,'kind',i.kind,'answer',i.answer)order by i.ordinal),'[]')from dm_private.attempt_items i where i.attempt_id=a.id))order by a.started_at)from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=u),'[]'),
    'learningProgress',coalesce((select jsonb_agg(jsonb_build_object('lessonId',lesson_id,'completedAt',completed_at)order by completed_at)from dm_private.learning_progress where user_id=u),'[]'),
    'community',jsonb_build_object(
      'posts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'exam',exam,'topic',topic,'title',title,'body',body,'status',status,'createdAt',created_at)order by created_at)from dm_private.community_posts where author_id=u),'[]'),
      'comments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'postId',post_id,'parentId',parent_id,'body',body,'status',status,'createdAt',created_at)order by created_at)from dm_private.community_comments where author_id=u),'[]')),
    'bugReports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'pageUrl',page_url,'status',status,'adminReply',admin_reply,'createdAt',created_at,'updatedAt',updated_at)order by created_at)from dm_private.bug_reports where reporter_id=u),'[]'),
    'drawingUploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'attemptId',attempt_id,'questionId',question_id,'ordinal',ordinal,'mimeType',mime_type,'byteSize',byte_size,'createdAt',created_at)order by created_at)from dm_private.drawing_uploads where student_id=u),'[]'));
end$$;

create or replace function public.request_account_deletion()returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v uuid;u uuid:=auth.uid();
begin
  if u is null then raise exception'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,17));
  select id into v from dm_private.account_privacy_requests where user_id=u and request_type='account_deletion'and status in('open','in_progress');
  if v is not null then return v;end if;
  insert into dm_private.account_privacy_requests(user_id,request_type)values(u,'account_deletion')returning id into v;return v;
end$$;

create or replace function public.my_privacy_requests()returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',request_type,'status',status,'adminNote',admin_note,'createdAt',created_at,'updatedAt',updated_at)order by created_at desc),'[]')from dm_private.account_privacy_requests where user_id=auth.uid()
$$;

create or replace function public.cancel_my_privacy_request(p_id uuid)returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  update dm_private.account_privacy_requests set status='cancelled',updated_at=now()where id=p_id and user_id=auth.uid()and status='open';
  if not found then raise exception'Open request not found';end if;
end$$;

create or replace function public.admin_privacy_requests()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public as $$
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'userId',user_id,'type',request_type,'status',status,'adminNote',admin_note,'createdAt',created_at,'updatedAt',updated_at)order by created_at desc),'[]')from dm_private.account_privacy_requests);
end$$;

create or replace function public.admin_resolve_privacy_request(p_id uuid,p_status text,p_note text)returns void language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  if p_status not in('in_progress','closed','declined')then raise exception'Invalid privacy request status';end if;
  if char_length(trim(p_note))not between 10 and 2000 then raise exception'An operator note is required';end if;
  update dm_private.account_privacy_requests set status=p_status,admin_note=trim(p_note),handled_by=auth.uid(),handled_at=now(),updated_at=now()where id=p_id and status in('open','in_progress');
  if not found then raise exception'Active request not found';end if;
end$$;

revoke all on function public.export_my_account_data(),public.request_account_deletion(),public.my_privacy_requests(),public.cancel_my_privacy_request(uuid),public.admin_privacy_requests(),public.admin_resolve_privacy_request(uuid,text,text)from public,anon;
grant execute on function public.export_my_account_data(),public.request_account_deletion(),public.my_privacy_requests(),public.cancel_my_privacy_request(uuid),public.admin_privacy_requests(),public.admin_resolve_privacy_request(uuid,text,text)to authenticated;
