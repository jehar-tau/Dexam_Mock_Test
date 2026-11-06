create or replace function public.learning_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,dm_private
as $$
declare
  v_user uuid:=auth.uid();
  v_total integer;
  v_completed integer;
  v_recommendation jsonb;
begin
  if v_user is null then raise exception 'Sign in required'; end if;

  select count(*),count(p.lesson_id)
    into v_total,v_completed
  from dm_private.learning_lessons l
  left join dm_private.learning_progress p on p.lesson_id=l.id and p.user_id=v_user
  where l.published and l.rights_confirmed;

  with performance as (
    select lower(i.topic) topic,
      count(*) filter(where i.answer is not null) answered,
      count(*) filter(where i.answer is not null and
        (select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking)) in('correct','full_marks')) correct
    from dm_private.attempt_items i
    join dm_private.attempts a on a.id=i.attempt_id
    where a.user_id=v_user and a.status='submitted' and i.kind<>'drawing'
      and not exists(
        select 1 from dm_private.all_india_attempts ai
        join dm_private.all_india_events e on e.id=ai.event_id
        where ai.attempt_id=a.id and e.results_released_at is null)
    group by lower(i.topic)
  ), candidate as (
    select l.*,coalesce(s.answered,0) answered,
      case when coalesce(s.answered,0)=0 then null else round(s.correct*100.0/s.answered) end accuracy
    from dm_private.learning_lessons l
    left join dm_private.learning_progress p on p.lesson_id=l.id and p.user_id=v_user
    left join performance s on s.topic=lower(l.topic)
    where l.published and l.rights_confirmed and p.lesson_id is null
    order by (coalesce(s.answered,0)>0) desc,
      case when coalesce(s.answered,0)=0 then 101 else s.correct*100.0/s.answered end,
      l.exam,l.ordinal
    limit 1
  )
  select jsonb_build_object(
    'id',id,'slug',slug,'exam',exam,'topic',topic,'title',title,
    'answered',answered,'accuracy',accuracy,
    'reason',case when answered>0
      then 'Recommended from your '||accuracy||'% accuracy across '||answered||' answered '||topic||' question'||case when answered=1 then '' else 's' end||'.'
      else 'Recommended as the next incomplete lesson in your learning path.' end)
  into v_recommendation from candidate;

  return jsonb_build_object(
    'total',v_total,
    'completed',v_completed,
    'percent',case when v_total=0 then 0 else round(v_completed*100.0/v_total) end,
    'recommendation',v_recommendation);
end $$;

revoke all on function public.learning_progress() from public,anon;
grant execute on function public.learning_progress() to authenticated;
