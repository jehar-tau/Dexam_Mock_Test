create or replace function dm_private.exam_mock_results_pending(p_attempt_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
 select coalesce((select s.part_b_attempt is null or b.status<>'submitted' or now()<coalesce(b.upload_deadline,b.deadline) or exists(select 1 from dm_private.drawing_uploads u where u.attempt_id=b.id and not exists(select 1 from dm_private.drawing_reviews r where r.attempt_id=u.attempt_id and r.question_id=u.question_id and r.status='released'))from dm_private.exam_mock_sessions s left join dm_private.attempts b on b.id=s.part_b_attempt where p_attempt_id in(s.part_a_attempt,s.part_b_attempt)),false)
$$;
revoke all on function dm_private.exam_mock_results_pending(uuid)from public,anon,authenticated;

create or replace function public.my_exam_mock_report(p_attempt_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare s dm_private.exam_mock_sessions;a dm_private.attempts;b dm_private.attempts;v_pending boolean;v_drawing_score numeric;v_drawing_total numeric;
begin
 select*into s from dm_private.exam_mock_sessions where user_id=auth.uid()and p_attempt_id in(part_a_attempt,part_b_attempt);if s.id is null then return null;end if;
 select*into a from dm_private.attempts where id=s.part_a_attempt;select*into b from dm_private.attempts where id=s.part_b_attempt;
 v_pending:=dm_private.exam_mock_results_pending(p_attempt_id);
 select coalesce(sum(case when r.status='released'then r.score else 0 end),0),coalesce(sum(i.points),0)into v_drawing_score,v_drawing_total from dm_private.attempt_items i left join dm_private.drawing_reviews r on r.attempt_id=i.attempt_id and r.question_id=i.question_id where i.attempt_id=s.part_b_attempt and i.kind='drawing';
 return jsonb_build_object('sessionId',s.id,'exam',s.exam,'partAAttemptId',s.part_a_attempt,'partBAttemptId',s.part_b_attempt,'state',case when s.part_b_attempt is null then'part_b_not_started'when b.status='active'then'part_b_active'when now()<coalesce(b.upload_deadline,b.deadline)then'upload_open'when v_pending then'review_pending'else'released'end,'resultsPending',v_pending,'objectiveScore',case when v_pending then null else a.score end,'objectiveTotal',case when v_pending then null else a.total end,'drawingScore',case when v_pending then null else v_drawing_score end,'drawingTotal',case when v_pending then null else v_drawing_total end,'combinedScore',case when v_pending then null else coalesce(a.score,0)+v_drawing_score end,'combinedTotal',case when v_pending then null else coalesce(a.total,0)+v_drawing_total end);
end$$;

create or replace function public.read_attempt(p_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;items jsonb;v_event_pending boolean;v_exam_pending boolean;v_review_ends_at timestamptz;
begin
 select*into a from dm_private.attempts where id=p_id and user_id=auth.uid();if a.id is null then raise exception'Attempt not found';end if;
 if a.status='active'and a.deadline<=now()then perform dm_private.finalize_attempt(a.id);select*into a from dm_private.attempts where id=a.id;end if;
 select e.results_released_at is null,e.review_ends_at into v_event_pending,v_review_ends_at from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id;
 v_event_pending:=coalesce(v_event_pending,false)and a.status='submitted';v_exam_pending:=a.status='submitted'and dm_private.exam_mock_results_pending(a.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt,'options',i.options,'topic',i.topic,'answer',i.answer,'points',i.points,'negativePoints',i.negative_points,'marking',i.marking,'kind',i.kind,'media',i.media)||case when a.status='submitted'and not v_event_pending and not v_exam_pending then jsonb_build_object('correctKey',i.key,'explanation',i.explanation,'outcome',(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking)))else'{}'::jsonb end||case when a.status='submitted'and i.kind='drawing'then jsonb_build_object('drawingReview',coalesce((select case when r.status='released'then jsonb_build_object('status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at)else jsonb_build_object('status','pending')end from dm_private.drawing_reviews r where r.attempt_id=i.attempt_id and r.question_id=i.question_id),jsonb_build_object('status','not_submitted')))else'{}'::jsonb end order by i.ordinal),'[]')into items from dm_private.attempt_items i where i.attempt_id=a.id;
 return jsonb_build_object('title',(select title from dm_private.papers where id=a.paper_id),'id',a.id,'status',a.status,'deadline',a.deadline,'uploadDeadline',a.upload_deadline,'serverNow',now(),'score',case when v_event_pending or v_exam_pending then null else a.score end,'total',case when v_event_pending or v_exam_pending then null else a.total end,'resultsPending',v_event_pending,'examResultsPending',v_exam_pending,'reviewEndsAt',v_review_ends_at,'questions',case when v_event_pending then'[]'::jsonb else items end);
end$$;

revoke all on function public.my_exam_mock_report(uuid)from public,anon;
grant execute on function public.my_exam_mock_report(uuid)to authenticated;
