alter table dm_private.attempt_items add column answer_revision bigint not null default 0 check(answer_revision>=0),add column answered_at timestamptz;
create or replace function public.save_answer_revision(p_attempt_id uuid,p_question_id uuid,p_answer jsonb,p_revision bigint)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare a dm_private.attempts;i dm_private.attempt_items;
begin
 select*into a from dm_private.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if a.id is null or a.status<>'active'or a.deadline<=now()then raise exception'Answer window closed';end if;
 select*into i from dm_private.attempt_items where attempt_id=a.id and question_id=p_question_id for update;
 if i.question_id is null then raise exception'Question not in attempt';end if;
 if p_revision<=i.answer_revision then return jsonb_build_object('accepted',false,'revision',i.answer_revision);end if;
 perform public.save_answer(p_attempt_id,p_question_id,p_answer);
 update dm_private.attempt_items set answer_revision=p_revision,answered_at=now()where attempt_id=p_attempt_id and question_id=p_question_id;
 return jsonb_build_object('accepted',true,'revision',p_revision,'serverNow',now());
end$$;
revoke all on function public.save_answer_revision(uuid,uuid,jsonb,bigint)from public,anon;grant execute on function public.save_answer_revision(uuid,uuid,jsonb,bigint)to authenticated;
