\set ON_ERROR_STOP on
\set first '00000000-0000-4000-8000-000000001501'
\set second '00000000-0000-4000-8000-000000001502'
\set admin '00000000-0000-4000-8000-000000001503'
\set lesson '50000000-0000-4000-8000-000000001501'
\set draft '50000000-0000-4000-8000-000000001502'
\set no_rights '50000000-0000-4000-8000-000000001503'
begin;
create function pg_temp.learn_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.learn_reject(statement text,expected text)returns void language plpgsql as $$begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;raise exception 'FAIL, expected error: %',expected;end$$;
insert into auth.users(id)values(:'first'),(:'second'),(:'admin');
insert into public.profiles(user_id,display_name)values(:'first','Original Fictional First Learner'),(:'second','Original Fictional Second Learner');
insert into dm_private.learning_lessons(id,slug,exam,topic,title,summary,body,ordinal,published,rights_confirmed,created_by)values
 (:'lesson','original-fictional-published','ceed','observation','Original Fictional Published Lesson','An original fictional published summary.','An original fictional published theory body.',1,true,true,:'admin'),
 (:'draft','original-fictional-draft','ceed','observation','Original Fictional Draft Lesson','An original fictional unpublished summary.','An original fictional private draft theory body.',2,false,false,:'admin'),
 (:'no_rights','original-fictional-no-rights','ceed','observation','Original Fictional Unconfirmed Lesson','An original fictional unconfirmed summary.','An original fictional rights-unconfirmed theory body.',3,true,false,:'admin');
select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)as profiles_before from public.profiles p\gset
select md5(jsonb_agg(to_jsonb(l)order by id)::text)as content_before from dm_private.learning_lessons l\gset
set local role anon;
select pg_temp.learn_reject('select public.learning_catalog()','permission denied');
select pg_temp.learn_reject('select public.learning_progress()','permission denied');
select pg_temp.learn_reject('select public.read_learning_lesson(''original-fictional-published'')','permission denied');
select pg_temp.learn_reject('select public.complete_learning_lesson('''||:'lesson'||''')','permission denied');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.learn_assert(public.learning_catalog()='[]'::jsonb,'missing identity cannot read a learning catalogue');
select pg_temp.learn_reject('select public.learning_progress()','Sign in required');
select pg_temp.learn_reject('select public.read_learning_lesson(''original-fictional-published'')','Sign in required');
select pg_temp.learn_reject('select public.complete_learning_lesson('''||:'lesson'||''')','Sign in required');
select set_config('request.jwt.claim.sub',:'first',true);
select pg_temp.learn_assert(jsonb_array_length(public.learning_catalog())=1 and public.learning_catalog()->0->>'id'=:'lesson' and public.learning_catalog()->0->>'completed'='false','a free unverified learner sees only rights-confirmed published theory');
select pg_temp.learn_assert(public.read_learning_lesson('original-fictional-published')->>'body'='An original fictional published theory body.','the published theory body remains exact');
select pg_temp.learn_reject('select public.read_learning_lesson(''original-fictional-draft'')','Lesson not found');
select pg_temp.learn_reject('select public.read_learning_lesson(''original-fictional-no-rights'')','Lesson not found');
select pg_temp.learn_reject('select public.complete_learning_lesson('''||:'draft'||''')','Lesson not found');
select pg_temp.learn_reject('select public.complete_learning_lesson('''||:'no_rights'||''')','Lesson not found');
select pg_temp.learn_reject('select * from dm_private.learning_progress','permission denied');
select pg_temp.learn_reject('select * from dm_private.learning_lessons','permission denied');
select pg_temp.learn_reject('insert into dm_private.learning_progress values('''||:'second'||''','''||:'lesson'||''',now())','permission denied');
select public.complete_learning_lesson(:'lesson');
select public.complete_learning_lesson(:'lesson');
select pg_temp.learn_assert(public.learning_catalog()->0->>'completed'='true' and public.learning_progress()->>'completed'='1' and public.learning_progress()->>'percent'='100' and public.learning_progress()->'recommendation'='null'::jsonb,'completion is idempotent and removes the completed recommendation');
select set_config('request.jwt.claim.sub',:'second',true);
select pg_temp.learn_assert(public.learning_catalog()->0->>'completed'='false' and public.learning_progress()->>'completed'='0' and public.learning_progress()->'recommendation'->>'id'=:'lesson' and public.read_learning_lesson('original-fictional-published')->>'completed'='false','another account keeps its own incomplete progress');
reset role;
select pg_temp.learn_assert((select count(*)from dm_private.learning_progress where lesson_id=:'lesson')=1 and(select md5(jsonb_agg(to_jsonb(l)order by id)::text)from dm_private.learning_lessons l)=:'content_before','student completion does not rewrite theory or duplicate progress');
update dm_private.learning_lessons set published=false where id=:'lesson';
set local role authenticated;
select set_config('request.jwt.claim.sub',:'first',true);
select pg_temp.learn_assert(public.learning_catalog()='[]'::jsonb and public.learning_progress()->>'total'='0' and public.learning_progress()->>'completed'='0','withdrawn content disappears from current catalogue and progress totals');
select pg_temp.learn_reject('select public.read_learning_lesson(''original-fictional-published'')','Lesson not found');
select pg_temp.learn_reject('select public.complete_learning_lesson('''||:'lesson'||''')','Lesson not found');
reset role;
select pg_temp.learn_assert((select count(*)from dm_private.learning_progress where lesson_id=:'lesson')=1 and(select count(*)from dm_private.passes where user_id in(:'first',:'second'))=0 and(select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)from public.profiles p)=:'profiles_before','historical progress is retained without granting access or changing profiles');
rollback;
\echo 'PASS: free published theory, private progress, role/ownership isolation, idempotent completion and withdrawal without access/profile changes.'
