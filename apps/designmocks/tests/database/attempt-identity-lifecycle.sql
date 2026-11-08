-- Original fictional paper/accounts only. No externally verified phone or sale.
\set ON_ERROR_STOP on
\set first '00000000-0000-4000-8000-000000001661'
\set second '00000000-0000-4000-8000-000000001662'
\set free '00000000-0000-4000-8000-000000001663'
\set paper '10000000-0000-4000-8000-000000001661'
\set question '20000000-0000-4000-8000-000000001661'
\set drawing '20000000-0000-4000-8000-000000001662'
begin;
create function pg_temp.attempt_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.attempt_reject(statement text,expected text)returns void language plpgsql as $$begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;raise exception 'FAIL, expected error: %',expected;end$$;
insert into auth.users(id)values(:'first'),(:'second'),(:'free');
insert into public.profiles(user_id,display_name)values(:'first','Original fictional first candidate'),(:'second','Original fictional second candidate'),(:'free','Original fictional free candidate');
insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)values(:'first','annual',119300,'INR','test','paid'),(:'second','annual',119300,'INR','test','paid');
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)select user_id,id,'test',now()-interval'1 day',now()+interval'1 year'from dm_private.orders where user_id in(:'first',:'second');
insert into dm_private.papers(id,title,exam,duration_seconds,published,reviewed,rights_confirmed,upload_grace_seconds)values(:'paper','Original fictional account-bound paper','uceed',900,true,true,true,900);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,reviewed)values
 (:'question',:'paper',1,'Original fictional observation question','[{"id":"A","label":"Original first choice"},{"id":"B","label":"Original second choice"}]',4,1,'observation','mcq','{"correct":4,"wrong":-1}',true),
 (:'drawing',:'paper',2,'Original fictional drawing question','[]',20,0,'drawing','drawing','{"correct":20,"wrong":0,"humanReview":true}',true);
insert into dm_private.answer_keys(question_id,key,explanation)values(:'question','{"kind":"mcq","correct":["A"]}','Original fictional explanation'),(:'drawing','{"kind":"drawing"}','Original human drawing rubric');
select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)as profiles_before from public.profiles p\gset
select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)as passes_before from dm_private.passes p\gset
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'free',true);
select pg_temp.attempt_reject('select public.start_attempt('''||:'paper'||''')','An active pass is required');
select set_config('request.jwt.claim.sub',:'first',true);
select public.start_attempt(:'paper')as attempt\gset
select pg_temp.attempt_assert(public.start_attempt(:'paper')=:'attempt'::uuid,'reconnecting reuses the same active attempt and clock');
select pg_temp.attempt_assert(public.read_attempt(:'attempt')->>'status'='active'and jsonb_array_length(public.read_attempt(:'attempt')->'questions')=2 and not(public.read_attempt(:'attempt')->'questions'->0?'correctKey'),'only the owner opens the frozen paper without the key');
select public.read_attempt(:'attempt')->>'deadline'as deadline_before\gset
select pg_temp.attempt_assert(public.save_answer_revision(:'attempt',:'question','"B"',100)@>'{"accepted":true,"revision":100,"answer":"B"}'::jsonb,'accepted receipt includes exact canonical answer and revision');
select pg_temp.attempt_assert(public.save_answer_revision(:'attempt',:'question','"A"',100)@>'{"accepted":false,"revision":100,"answer":"B"}'::jsonb,'a lost commit is reconciled without replacing the accepted equal revision');
select pg_temp.attempt_assert(public.save_answer_revision(:'attempt',:'question','"A"',99)@>'{"accepted":false,"revision":100,"answer":"B"}'::jsonb,'an older device cannot overwrite the canonical answer');
select pg_temp.attempt_reject('select public.save_answer_revision('''||:'attempt'||''','''||:'question'||''',''"A"'',0)','Invalid answer revision');
select pg_temp.attempt_reject('select public.save_answer_revision('''||:'attempt'||''','''||:'question'||''',''"A"'',9007199254740992)','Invalid answer revision');
select set_config('request.jwt.claim.sub',:'second',true);
select pg_temp.attempt_reject('select public.read_attempt('''||:'attempt'||''')','Attempt not found');
select pg_temp.attempt_reject('select public.save_answer_revision('''||:'attempt'||''','''||:'question'||''',''"A"'',101)','Answer window closed');
select pg_temp.attempt_reject('select public.submit_attempt('''||:'attempt'||''')','Attempt not found');
select pg_temp.attempt_reject('select public.report_attempt_question('''||:'attempt'||''','''||:'question'||''',''incorrect'',''Original fictional other actor report'')','Question is not part of your attempt');
select pg_temp.attempt_reject('select * from dm_private.attempt_items','permission denied');
select pg_temp.attempt_reject('select public.save_answer('''||:'attempt'||''','''||:'question'||''',''"A"'')','permission denied');
select pg_temp.attempt_reject('select public.service_student_drawing_media_paths('''||:'first'||''','''||:'attempt'||''','''||:'drawing'||''')','permission denied');
set local role anon;
select pg_temp.attempt_reject('select public.read_attempt('''||:'attempt'||''')','permission denied');
select pg_temp.attempt_reject('select public.save_answer_revision('''||:'attempt'||''','''||:'question'||''',''"A"'',101)','permission denied');
select pg_temp.attempt_reject('select public.submit_attempt('''||:'attempt'||''')','permission denied');
reset role;
select md5(jsonb_agg(to_jsonb(i)-'answer'-'answer_revision'-'answered_at'order by ordinal)::text)as frozen_before from dm_private.attempt_items i where attempt_id=:'attempt'\gset
select pg_temp.attempt_assert((select answer='"B"'and answer_revision=100 from dm_private.attempt_items where attempt_id=:'attempt'and question_id=:'question'),'denied and replayed writes preserve the accepted answer');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'first',true);
select pg_temp.attempt_assert(public.submit_attempt(:'attempt')->>'status'='submitted','owner submission finalizes the paper');
select pg_temp.attempt_assert(public.submit_attempt(:'attempt')->>'deadline'=:'deadline_before','submission replay retains the fixed original deadline');
select pg_temp.attempt_assert((public.read_attempt(:'attempt')->>'uploadDeadline')::timestamptz-(:'deadline_before')::timestamptz=interval'15 minutes','drawing grace belongs to the fixed deadline');
select pg_temp.attempt_reject('select public.save_answer_revision('''||:'attempt'||''','''||:'question'||''',''"A"'',101)','Answer window closed');
reset role;
select pg_temp.attempt_assert((select md5(jsonb_agg(to_jsonb(i)-'answer'-'answer_revision'-'answered_at'order by ordinal)::text)from dm_private.attempt_items i where attempt_id=:'attempt')=:'frozen_before','submission and denied actors never rewrite the frozen questions');
select pg_temp.attempt_assert((select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)from public.profiles p)=:'profiles_before'and(select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)from dm_private.passes p)=:'passes_before'and(select count(*)from dm_private.question_reports where reporter_id=:'second')=0,'exam work cannot grant access, alter profile proofs or create another actor report');
rollback;
\echo 'PASS: private attempt ownership, exact revision receipts, reconnect idempotency, immutable submission and fixed drawing grace.'
