create or replace function public.my_overview_analytics() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object(
  'activeAttempt',(select jsonb_build_object('id',a.id,'title',p.title,'deadline',a.deadline) from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=v_user and a.status='active' and a.deadline>now() order by a.started_at desc limit 1),
  'completed',(select count(*) from dm_private.attempts where user_id=v_user and status='submitted'),
  'topics',coalesce((select jsonb_agg(jsonb_build_object('topic',topic,'answered',answered,'correct',correct,'accuracy',case when answered=0 then 0 else round(correct*100.0/answered) end) order by answered desc,topic) from(select i.topic,count(*)filter(where i.answer is not null)answered,count(*)filter(where i.answer is not null and (select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking)) in('correct','full_marks'))correct from dm_private.attempt_items i join dm_private.attempts a on a.id=i.attempt_id where a.user_id=v_user and a.status='submitted' and i.kind<>'drawing' group by i.topic)t),'[]'::jsonb)
 );
end $$;
revoke all on function public.my_overview_analytics() from public,anon;grant execute on function public.my_overview_analytics() to authenticated;
