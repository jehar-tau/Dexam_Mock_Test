\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(passed boolean,label text) returns void language plpgsql as $$
begin if passed is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.rejects(statement text,expected_state text,expected_detail text default null) returns void language plpgsql as $$
declare actual_state text; actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=expected_state and (expected_detail is null or expected_detail=actual_detail) then return;end if;
  raise exception 'FAIL: % expected % / %, received % / %',statement,expected_state,expected_detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: should be rejected: %',statement;
end $$;
-- Private-table checks run as the owner while the session acts as a member.
create function pg_temp.q(statement text) returns boolean language plpgsql security definer as $$
declare result boolean; begin execute statement into result; return result; end $$;
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000095'||n,true)
$$;
create function pg_temp.text(n integer) returns text language sql as $$
 select 'An original fictional sentence about practising a perspective sketch, number '||n||'.'
$$;

-- 1 asker, 2 helper, 3 teacher, 4 another student, 5 administrator.
insert into auth.users(id,email) select ('00000000-0000-4000-8000-00000000095'||g)::uuid,'community-'||g||'@example.invalid' from generate_series(1,5)g;
insert into public.profiles(user_id,display_name) values('00000000-0000-4000-8000-000000000951','Asha Fictional'),('00000000-0000-4000-8000-000000000952','Ravi Fictional'),
 ('00000000-0000-4000-8000-000000000953','Meera Fictional'),('00000000-0000-4000-8000-000000000954','Kabir Fictional');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000955');
create temp table ids(name text primary key,id uuid);
grant all on ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

-- Work for feedback.
select pg_temp.as_user(1);
insert into ids select 'w1',(public.create_community_work(' NID ','Studio test','My first fictional poster for review',pg_temp.text(1)||' I wanted calm colours.',pg_temp.text(2)||' Is the hierarchy clear?','b0000000-0000-4000-8000-000000000001')->>'id')::uuid;
select pg_temp.ok(pg_temp.q($s$select kind='work' and exam='nid' and body like E'## What I was trying to do\n\n%## What I want feedback on%' from dm_private.community_posts where id=(select id from ids where name='w1')$s$),'work body has both prompts as sections');
select pg_temp.ok((public.create_community_work('nid','Studio test','My first fictional poster for review',pg_temp.text(1)||' I wanted calm colours.',pg_temp.text(2)||' Is the hierarchy clear?','b0000000-0000-4000-8000-000000000001'))
 @> jsonb_build_object('id',(select id from ids where name='w1'),'replayed',true),'identical retry replays');
select pg_temp.rejects($q$select public.create_community_work('nid','Studio','A fictional valid title','too short','also short','b0000000-0000-4000-8000-000000000002')$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.create_community_work('nid','Studio','A fictional valid title',pg_temp.text(3),pg_temp.text(4)||' DM me for the file.','b0000000-0000-4000-8000-000000000002')$q$,'22023','community_contact_details');
select pg_temp.ok(public.community_cards('work',null,null,25)#>>'{cards,0,id}'=(select id::text from ids where name='w1')
 and public.community_cards('work',null,null,25)#>'{cards,0}' @> '{"kind":"work","author":"Asha","isMine":true,"teacher":false,"answered":false}','work list shows the post');
select pg_temp.ok(public.community_feed(null,null,null,25)->'posts'='[]'::jsonb and public.community_articles(null,'latest',null,25)->'articles'='[]'::jsonb,'work stays out of discussions and articles');

-- Questions and accepted answers.
insert into ids select 'q1',(public.create_community_post('uceed','time management','How do you split the two hours?',pg_temp.text(5),'b0000000-0000-4000-8000-000000000003')->>'id')::uuid;
insert into ids select 'own',(public.add_community_comment((select id from ids where name='q1'),null,'Adding context to my own question.','b0000000-0000-4000-8000-000000000004')->>'id')::uuid;
select pg_temp.as_user(2);
insert into ids select 'r1',(public.add_community_comment((select id from ids where name='q1'),null,'I spend twenty minutes on the first section.','b0000000-0000-4000-8000-000000000005')->>'id')::uuid;
select pg_temp.ok(public.community_cards('unanswered',null,null,25)#>>'{cards,0,id}'=(select id::text from ids where name='q1'),'question is unanswered');
select pg_temp.rejects($q$select public.accept_community_answer((select id from ids where name='q1'),(select id from ids where name='r1'))$q$,'42501','community_target_unavailable');
select pg_temp.as_user(1);
select pg_temp.rejects($q$select public.accept_community_answer((select id from ids where name='q1'),(select id from ids where name='own'))$q$,'42501','community_target_unavailable');
select pg_temp.rejects($q$select public.accept_community_answer((select id from ids where name='w1'),null)$q$,'42501','community_target_unavailable');
select pg_temp.ok(public.accept_community_answer((select id from ids where name='q1'),(select id from ids where name='r1'))->>'acceptedCommentId'=(select id::text from ids where name='r1'),'asker accepts a reply');
select pg_temp.ok(public.community_cards('unanswered',null,null,25)->'cards'='[]'::jsonb,'answered question leaves the unanswered list');
select pg_temp.ok(public.community_feed(null,null,null,25)#>'{posts,0,answered}'='true'::jsonb,'feed marks it answered');
select pg_temp.ok(public.community_thread((select id from ids where name='q1'),null,25)->>'acceptedCommentId'=(select id::text from ids where name='r1')
 and (select c->'accepted'='true'::jsonb from jsonb_array_elements(public.community_thread((select id from ids where name='q1'),null,25)->'comments')c where c->>'id'=(select id::text from ids where name='r1'))
 and public.community_thread((select id from ids where name='q1'),null,25) @> '{"canAccept":true,"canEdit":true,"canHold":false,"canSanction":false,"canFeature":false}','thread shows the accepted reply and the asker''s options');
select pg_temp.ok(public.accept_community_answer((select id from ids where name='q1'),null)->'acceptedCommentId'='null'::jsonb,'asker clears the answer');
select pg_temp.ok(public.community_cards('unanswered',null,null,25)#>>'{cards,0,id}'=(select id::text from ids where name='q1'),'clearing returns it to unanswered');
select public.accept_community_answer((select id from ids where name='q1'),(select id from ids where name='r1'));

-- Roles: only an administrator grants them, by email.
select pg_temp.rejects($q$select public.admin_set_community_role('community-3@example.invalid',true,false)$q$,'42501');
select pg_temp.as_user(5);
select pg_temp.rejects($q$select public.admin_set_community_role('community-3@example.invalid',false,true)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.admin_set_community_role('nobody@example.invalid',true,false)$q$,'P0001','community_role_unknown');
select pg_temp.ok(public.admin_set_community_role(' Community-3@example.invalid ',true,false) @> '{"teacher":true,"moderator":false}','teacher granted');
select pg_temp.ok(public.admin_community_roles()#>'{roles,0}' @> '{"email":"community-3@example.invalid","teacher":true,"moderator":false}','role list');
select pg_temp.as_user(3);
select pg_temp.ok(public.my_community_standing() @> '{"teacher":true,"moderator":false,"sanction":null}','teacher sees their standing');
insert into ids select 't1',(public.add_community_comment((select id from ids where name='w1'),null,'What works: the calm palette. Improve: the headline size.','b0000000-0000-4000-8000-000000000006')->>'id')::uuid;
select pg_temp.ok((select c->'teacher'='true'::jsonb from jsonb_array_elements(public.community_thread((select id from ids where name='w1'),null,25)->'comments')c where c->>'id'=(select id::text from ids where name='t1')),'teacher reply is labelled');
select pg_temp.ok(public.community_thread((select id from ids where name='w1'),null,25) @> '{"canFeature":true,"canHold":false,"teacher":false,"kind":"work"}','teacher may feature work');
select pg_temp.rejects($q$select public.admin_community_roles()$q$,'42501');

-- Featured shelf.
select pg_temp.ok(public.set_community_featured((select id from ids where name='w1'),true)->'featured'='true'::jsonb,'teacher features work');
select pg_temp.rejects($q$select public.set_community_featured((select id from ids where name='q1'),true)$q$,'42501','community_target_unavailable');
select pg_temp.as_user(4);
select pg_temp.ok(public.community_featured_list()#>>'{cards,0,id}'=(select id::text from ids where name='w1'),'members see the shelf');
select pg_temp.rejects($q$select public.set_community_featured((select id from ids where name='w1'),false)$q$,'42501','community_teacher_required');
insert into ids select 'k1',(public.add_community_comment((select id from ids where name='w1'),null,'An unkind fictional reply that a moderator will hold.','b0000000-0000-4000-8000-000000000007')->>'id')::uuid;

-- Moderator hold.
select pg_temp.as_user(3);
select pg_temp.rejects($q$select public.moderator_hold_community('comment',(select id from ids where name='k1'),'Unkind reply to a student')$q$,'42501','community_moderator_required');
select pg_temp.as_user(5);
select public.admin_set_community_role('community-3@example.invalid',true,true);
select pg_temp.as_user(3);
select pg_temp.ok(public.community_thread((select id from ids where name='w1'),null,25)->'canHold'='true'::jsonb,'moderator flag');
select pg_temp.rejects($q$select public.moderator_hold_community('comment',(select id from ids where name='k1'),'short')$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.moderator_hold_community('comment',(select id from ids where name='t1'),'Holding my own reply')$q$,'22023','community_hold_own');
select pg_temp.ok(public.moderator_hold_community('comment',(select id from ids where name='k1'),'Unkind reply to a student')->>'status'='hidden','moderator holds a reply');
select pg_temp.ok(pg_temp.q($s$select status='hidden' from dm_private.community_comments where id=(select id from ids where name='k1')$s$)
 and pg_temp.q($s$select note like 'Moderator hold, pending review: %' and actor_id='00000000-0000-4000-8000-000000000953' from dm_private.community_moderation_log where target_id=(select id from ids where name='k1')$s$),'hold is hidden and logged with the moderator');
select pg_temp.rejects($q$select public.moderator_hold_community('comment',(select id from ids where name='k1'),'Holding it a second time')$q$,'42501','community_target_unavailable');

-- Editing with history.
select pg_temp.as_user(1);
select pg_temp.rejects($q$select public.edit_community_post((select id from ids where name='q1'),'time management','How do you split the two hours?',pg_temp.text(6),1000)$q$,'40001','community_thread_changed');
create temp table v(version bigint); grant all on v to authenticated;
insert into v select (public.community_thread((select id from ids where name='q1'),null,25)->>'version')::bigint;
select pg_temp.ok(public.edit_community_post((select id from ids where name='q1'),'time management','How do you split the two hours?',pg_temp.text(5),(select version from v))->'changed'='false'::jsonb,'unchanged text records nothing');
select pg_temp.ok(public.edit_community_post((select id from ids where name='q1'),'time management','How do you split the two hours in UCEED?',pg_temp.text(6),(select version from v)) @> '{"changed":true}'
 and (public.community_thread((select id from ids where name='q1'),null,25)->>'version')::bigint>(select version from v)
 and public.community_thread((select id from ids where name='q1'),null,25)->>'editedAt' is not null,'edit saves, bumps the version and records the time');
select pg_temp.rejects($q$select public.edit_community_post((select id from ids where name='q1'),'time management','How do you split the two hours in UCEED?',pg_temp.text(7),(select version from v))$q$,'40001','community_thread_changed');
select pg_temp.rejects($q$select public.edit_community_post((select id from ids where name='q1'),'time management','Call me on 98765 43210 please',pg_temp.text(7),(public.community_thread((select id from ids where name='q1'),null,25)->>'version')::bigint)$q$,'22023','community_contact_details');
select pg_temp.as_user(2);
select pg_temp.rejects($q$select public.edit_community_post((select id from ids where name='q1'),'x','A fictional takeover title',pg_temp.text(8),1)$q$,'42501','community_target_unavailable');
select pg_temp.rejects($q$select public.admin_community_post_revisions((select id from ids where name='q1'))$q$,'42501');
select pg_temp.as_user(5);
select pg_temp.ok(public.admin_community_post_revisions((select id from ids where name='q1')) @> jsonb_build_object('current',jsonb_build_object('title','How do you split the two hours in UCEED?'))
 and jsonb_array_length(public.admin_community_post_revisions((select id from ids where name='q1'))->'revisions')=1
 and public.admin_community_post_revisions((select id from ids where name='q1'))#>>'{revisions,0,body}'=pg_temp.text(5),'administrator sees the replaced text');

-- Sanctions: a mute stops every kind of write, lifting restores it.
select pg_temp.rejects($q$select public.admin_community_sanction('comment',(select id from ids where name='k1'),'mute',7,'short')$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.admin_community_sanction('comment',(select id from ids where name='k1'),'mute',null,'Repeated unkind replies to students')$q$,'22023','community_invalid_input');
select pg_temp.ok(public.admin_community_sanction('comment',(select id from ids where name='k1'),'mute',7,'Repeated unkind replies to students')->>'kind'='mute','administrator mutes the author of a reply');
select pg_temp.ok(public.admin_community_sanctions()#>'{sanctions,0}' @> '{"email":"community-4@example.invalid","kind":"mute"}','sanction list');
select pg_temp.as_user(4);
select pg_temp.ok(public.my_community_standing()#>>'{sanction,kind}'='mute' and public.my_community_standing()#>>'{sanction,reason}'='Repeated unkind replies to students','member sees why');
select pg_temp.rejects($q$select public.add_community_comment((select id from ids where name='q1'),null,'A fictional reply while muted.','b0000000-0000-4000-8000-000000000008')$q$,'P0001','community_sanctioned');
select pg_temp.rejects($q$select public.create_community_post('nid','studio','A fictional question while muted',pg_temp.text(9),'b0000000-0000-4000-8000-000000000009')$q$,'P0001','community_sanctioned');
select pg_temp.rejects($q$select public.create_community_work('nid','studio','A fictional work post while muted',pg_temp.text(9),pg_temp.text(10),'b0000000-0000-4000-8000-000000000010')$q$,'P0001','community_sanctioned');
select pg_temp.ok(public.community_cards('work',null,null,25)->'cards'<>'[]'::jsonb and public.set_community_like((select id from ids where name='w1'),true)->'liked'='true'::jsonb,'a muted member can still read and like');
select pg_temp.as_user(5);
select pg_temp.ok(public.admin_lift_community_sanction((public.admin_community_sanctions()#>>'{sanctions,0,id}')::uuid)->'lifted'='true'::jsonb,'lift');
select pg_temp.as_user(4);
select pg_temp.ok(public.add_community_comment((select id from ids where name='q1'),null,'A kinder fictional reply after the mute.','b0000000-0000-4000-8000-000000000011')->>'status'='visible','lifted member can reply again');
select pg_temp.as_user(5);
select public.admin_community_sanction('post',(select id from ids where name='w1'),'ban',null,'Fictional ban to check the shelf and standing');
select pg_temp.rejects($q$select public.admin_community_sanction('post',(select id from ids where name='w1'),'mute',0,'Zero-day mutes are refused')$q$,'22023','community_invalid_input');
select pg_temp.as_user(1);
select pg_temp.ok(public.my_community_standing() @> '{"sanction":{"kind":"ban","until":null}}','ban has no end date');
select pg_temp.rejects($q$select public.edit_community_post((select id from ids where name='q1'),'time management','A fictional edit while banned',pg_temp.text(11),(public.community_thread((select id from ids where name='q1'),null,25)->>'version')::bigint)$q$,'P0001','community_sanctioned');
select pg_temp.ok((select (e->>'schemaVersion')::int>=2 and jsonb_array_length(e->'revisions')=1 and e#>>'{sanctions,0,kind}'='ban' from public.export_my_community_library() e),'export includes replaced text and sanctions');

-- Safety reports come first for the administrator.
select pg_temp.as_user(2);
select public.report_community_content((select id from ids where name='w1'),null,'spam',null);
select pg_temp.as_user(4);
select public.report_community_content(null,(select id from ids where name='t1'),'safety','A fictional safety concern.');
select pg_temp.as_user(5);
select pg_temp.ok(public.admin_community_report_queue()#>>'{0,reason}'='safety' and jsonb_array_length(public.admin_community_report_queue())=2,'safety report is listed first');

-- Article cards carry the teacher label.
select pg_temp.as_user(3);
select public.create_community_article('nid','Studio test','A fictional teacher article on layout',repeat('An original fictional sentence about layout. ',8),'b0000000-0000-4000-8000-000000000012',null);
select pg_temp.ok(public.community_articles(null,'latest',null,25)#>'{articles,0,teacher}'='true'::jsonb,'article card shows teacher');

-- Removing a teacher removes the shelf permission, not the posts.
select pg_temp.as_user(5);
select pg_temp.ok(public.admin_set_community_role('community-3@example.invalid',false,false)->'teacher'='false'::jsonb,'role removed');
select pg_temp.as_user(3);
select pg_temp.rejects($q$select public.set_community_featured((select id from ids where name='w1'),false)$q$,'42501','community_teacher_required');
select pg_temp.ok(public.my_community_standing()->'teacher'='false'::jsonb,'standing reflects the removal');

reset role;
select pg_temp.ok(not has_function_privilege('anon','public.create_community_work(text,text,text,text,text,uuid)','execute')
 and not has_function_privilege('anon','public.community_cards(text,text,jsonb,integer)','execute')
 and not has_function_privilege('anon','public.moderator_hold_community(text,uuid,text)','execute')
 and not has_function_privilege('anon','public.admin_community_sanction(text,uuid,text,integer,text)','execute')
 and not has_function_privilege('authenticated','dm_private.community_active_sanction(uuid)','execute'),'function privileges');
select pg_temp.ok(not has_table_privilege('authenticated','dm_private.community_roles','select')
 and not has_table_privilege('authenticated','dm_private.community_post_revisions','select')
 and not has_table_privilege('authenticated','dm_private.community_sanctions','select')
 and not has_table_privilege('authenticated','dm_private.community_featured','select'),'table privileges');
rollback;
\echo community-feedback: ok
