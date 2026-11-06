create table dm_private.drawing_ai_suggestions(
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references dm_private.drawing_reviews(id) on delete cascade,
  provider text not null,
  model text not null,
  rubric_version text not null,
  criterion_marks jsonb not null,
  comments text not null,
  proposed_score numeric not null,
  confidence numeric not null check(confidence between 0 and 1),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index drawing_ai_suggestions_review_created_idx on dm_private.drawing_ai_suggestions(review_id,created_at desc);
alter table dm_private.drawing_ai_suggestions enable row level security;
revoke all on dm_private.drawing_ai_suggestions from anon,authenticated;

create or replace function public.record_drawing_ai_suggestion(p_review_id uuid,p_provider text,p_model text,p_rubric_version text,p_criterion_marks jsonb,p_comments text,p_proposed_score numeric,p_confidence numeric,p_evidence jsonb default '[]'::jsonb)returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_id uuid;v_max numeric;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  select i.points into v_max from dm_private.drawing_reviews r join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id where r.id=p_review_id;
  if v_max is null then raise exception'Review not found';end if;
  if char_length(trim(p_provider))not between 2 and 80 or char_length(trim(p_model))not between 2 and 120 or char_length(trim(p_rubric_version))not between 1 and 80 then raise exception'Invalid model provenance';end if;
  if jsonb_typeof(p_criterion_marks)<>'object'or p_criterion_marks='{}'::jsonb or exists(select 1 from jsonb_each(p_criterion_marks)e where jsonb_typeof(e.value)<>'number'or(e.value#>>'{}')::numeric<0)then raise exception'Invalid suggested criteria';end if;
  if char_length(trim(p_comments))<5 or p_proposed_score<0 or p_proposed_score>v_max or p_confidence<0 or p_confidence>1 or jsonb_typeof(p_evidence)<>'array'then raise exception'Invalid AI suggestion';end if;
  insert into dm_private.drawing_ai_suggestions(review_id,provider,model,rubric_version,criterion_marks,comments,proposed_score,confidence,evidence)values(p_review_id,trim(p_provider),trim(p_model),trim(p_rubric_version),p_criterion_marks,trim(p_comments),p_proposed_score,p_confidence,p_evidence)returning id into v_id;
  return v_id;
end$$;

create or replace function public.admin_drawing_queue()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('reviewId',r.id,'attemptId',r.attempt_id,'questionId',r.question_id,'prompt',i.prompt,'status',r.status,'uploadCount',(select count(*)from dm_private.drawing_uploads u where u.attempt_id=r.attempt_id and u.question_id=r.question_id),'maxScore',i.points,'criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'reviewedAt',r.reviewed_at,'releasedAt',r.released_at,'aiSuggestion',(select jsonb_build_object('provider',s.provider,'model',s.model,'rubricVersion',s.rubric_version,'criteria',s.criterion_marks,'comments',s.comments,'proposedScore',s.proposed_score,'confidence',s.confidence,'evidence',s.evidence,'createdAt',s.created_at)from dm_private.drawing_ai_suggestions s where s.review_id=r.id order by s.created_at desc,s.id desc limit 1))order by case r.status when'pending'then 1 when'assigned'then 2 when'reviewed'then 3 else 4 end,r.id),'[]')from dm_private.drawing_reviews r join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id);
end$$;

revoke all on function public.record_drawing_ai_suggestion(uuid,text,text,text,jsonb,text,numeric,numeric,jsonb)from public,anon,authenticated;
grant execute on function public.record_drawing_ai_suggestion(uuid,text,text,text,jsonb,text,numeric,numeric,jsonb)to service_role;
