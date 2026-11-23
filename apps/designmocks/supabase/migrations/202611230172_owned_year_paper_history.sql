begin;

-- A small, owner-scoped projection for the Papers cards. Keep the marks and
-- result holds from the same visibility function used by read_attempt.
create function public.my_year_paper_attempts()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  with owned as (
    select a.paper_id,v.id,v.status,v.started_at,v.deadline,v.results_pending,v.score,v.total,
      row_number() over (partition by a.paper_id,v.status order by v.started_at desc,v.id desc) as recent
    from dm_private.student_attempt_visibility(auth.uid()) v
    join dm_private.attempts a on a.id=v.id and a.user_id=auth.uid()
    join dm_private.year_paper_releases r on r.paper_id=a.paper_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'paperId',paper_id,'attemptId',id,'status',status,'startedAt',started_at,
    'resultsPending',results_pending,'score',score,'total',total
  ) order by started_at desc,id desc),'[]'::jsonb)
  from owned where recent=1 and (status='submitted' or deadline>now())
$$;
revoke all on function public.my_year_paper_attempts() from public,anon;
grant execute on function public.my_year_paper_attempts() to authenticated;

commit;
