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
create function pg_temp.q(statement text) returns boolean language plpgsql security definer as $$
declare result boolean; begin execute statement into result; return result; end $$;
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000096'||n,true)
$$;

-- 1 and 2 students, 3 teacher-moderator, 4 administrator.
insert into auth.users(id,email) select ('00000000-0000-4000-8000-00000000096'||g)::uuid,'link-'||g||'@example.invalid' from generate_series(1,4)g;
insert into public.profiles(user_id,display_name) values('00000000-0000-4000-8000-000000000961','Asha Fictional'),('00000000-0000-4000-8000-000000000962','Ravi Fictional'),('00000000-0000-4000-8000-000000000963','Meera Fictional');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000964');
insert into dm_private.community_roles(user_id,teacher,moderator) values('00000000-0000-4000-8000-000000000963',true,true);
create temp table ids(name text primary key,id uuid);
create function pg_temp.id(name text) returns uuid language sql as $$ select id from ids where ids.name=$1 $$;
grant all on ids to authenticated,service_role;
grant execute on function pg_temp.id(text) to authenticated,service_role;

-- Previews are recorded by the service role, within thirty fetches an hour.
set local role service_role;
select public.service_begin_community_link_fetch('00000000-0000-4000-8000-000000000961') from generate_series(1,30);
select pg_temp.rejects($q$select public.service_begin_community_link_fetch('00000000-0000-4000-8000-000000000961')$q$,'P0001','community_link_limit');
insert into ids select 'l1',(public.service_record_community_link('https://example.org/two-hour-plan','example.org','fetched','A fictional guide to two-hour plans','Fictional Guides','How one fictional student split the paper.')->>'id')::uuid;
insert into ids select 'l2',(public.service_record_community_link('https://www.instagram.com/p/fictional/','www.instagram.com','skipped',null,'www.instagram.com',null)->>'id')::uuid;
insert into ids select 'l3',(public.service_record_community_link('https://example.net/colour','example.net','fetched','A fictional note on colour wheels',null,null)->>'id')::uuid;
insert into ids select 'l4',(public.service_record_community_link('https://studio.example.com/perspective','studio.example.com','fetched','Ok',null,null)->>'id')::uuid;
insert into ids select 'l5',(public.service_record_community_link('https://blog.studio.example.com/sketching','blog.studio.example.com','fetched','A fictional sketching routine',null,null)->>'id')::uuid;
select pg_temp.ok(public.service_record_community_link('https://example.org/two-hour-plan','example.org','unavailable',null,null,null)->>'title'='A fictional guide to two-hour plans','a failed refresh keeps the earlier preview');
select pg_temp.rejects($q$select public.service_record_community_link('javascript:alert(1)','example.org','fetched',null,null,null)$q$,'23514');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.rejects($q$select public.service_record_community_link('https://example.org/x','example.org','fetched',null,null,null)$q$,'42501');
select pg_temp.rejects($q$select public.service_begin_community_link_fetch('00000000-0000-4000-8000-000000000962')$q$,'42501');

-- Lookup, private saves and notes.
select pg_temp.as_user(1);
select pg_temp.ok(public.community_link_lookup('https://example.org/two-hour-plan')->>'id'=pg_temp.id('l1')::text and public.community_link_lookup('https://example.org/missing') is null,'lookup returns a cached preview');
insert into ids select 'f1',(public.save_community_folder(null,'Time management')->>'id')::uuid;
insert into ids select 'p1',(public.create_community_post('uceed','time','A fictional saved discussion','An original fictional question about planning time.','c0000000-0000-4000-8000-000000000001')->>'id')::uuid;
select public.set_community_saves(pg_temp.id('p1'),array[pg_temp.id('f1')]);
select pg_temp.ok(public.save_community_link(pg_temp.id('l1'),array[pg_temp.id('f1')],'  Read before the next mock.  ') @> jsonb_build_object('note','Read before the next mock.','folderIds',jsonb_build_array(pg_temp.id('f1'))),'link saved with a note');
select public.save_community_link(pg_temp.id('l2'),array[pg_temp.id('f1')],'Poster idea from a fictional account.');
select pg_temp.ok((select (f->>'count')::int=3 from jsonb_array_elements(public.community_folders()->'folders')f),'folder count includes links');
select pg_temp.ok(jsonb_array_length(public.community_saved(pg_temp.id('f1'),null,25)->'items')=3,'folder lists posts and links together');
select pg_temp.ok(public.community_saved(pg_temp.id('f1'),null,25)#>'{items,0}' @> jsonb_build_object('type','link','id',pg_temp.id('l2'),'note','Poster idea from a fictional account.','suggestion',null),'newest save first, with its note');
select pg_temp.ok((select i @> jsonb_build_object('type','post','postId',pg_temp.id('p1'),'available',true) from jsonb_array_elements(public.community_saved(pg_temp.id('f1'),null,25)->'items')i where i->>'type'='post'),'post entries keep their shape');
create temp table pageone(v jsonb); grant all on pageone to authenticated;
insert into pageone select public.community_saved(pg_temp.id('f1'),null,2);
select pg_temp.ok((select v->'nextCursor' ?& array['savedAt','type','id'] and jsonb_array_length(v->'items')=2 from pageone)
 and jsonb_array_length(public.community_saved(pg_temp.id('f1'),(select v->'nextCursor' from pageone),2)->'items')=1,'mixed pages continue without repeats');
select pg_temp.ok(public.save_community_link(pg_temp.id('l2'),array[pg_temp.id('f1')],'  ')->'note'='null'::jsonb,'an empty note is removed');
select pg_temp.rejects($q$select public.save_community_link('a0000000-0000-4000-8000-00000000dead',array[pg_temp.id('f1')],null)$q$,'42501','community_link_unavailable');
select pg_temp.rejects($q$select public.save_community_link(pg_temp.id('l1'),array[pg_temp.id('f1')],repeat('x',2001))$q$,'22023','community_invalid_input');
select pg_temp.as_user(2);
select pg_temp.rejects($q$select public.save_community_link(pg_temp.id('l1'),array[pg_temp.id('f1')],null)$q$,'42501','community_folder_unavailable');
select pg_temp.ok(public.remove_community_link_save(pg_temp.id('l1'),pg_temp.id('f1'))->'removed'='false'::jsonb,'another member cannot remove the save');

-- Suggestions.
select pg_temp.rejects($q$select public.suggest_community_link(pg_temp.id('l1'),'uceed','Time management','A fictional reason why this helps with timing.')$q$,'42501','community_link_unavailable');
select pg_temp.as_user(1);
select pg_temp.rejects($q$select public.suggest_community_link(pg_temp.id('l2'),'nid','Posters','A fictional reason why this poster is useful.')$q$,'22023','community_link_social');
select pg_temp.rejects($q$select public.suggest_community_link(pg_temp.id('l1'),'uceed','Time management','Useful guide, ping me on 98765 43210.')$q$,'22023','community_contact_details');
select pg_temp.rejects($q$select public.suggest_community_link(pg_temp.id('l1'),'uceed','Time','too short')$q$,'22023','community_invalid_input');
insert into ids select 's1',(public.suggest_community_link(pg_temp.id('l1'),' UCEED ','Time management','A fictional guide that shows how to split two hours across sections.')->>'id')::uuid;
select pg_temp.ok(public.suggest_community_link(pg_temp.id('l1'),'uceed','Time management','A fictional guide that shows how to split two hours across sections.') @> jsonb_build_object('id',pg_temp.id('s1'),'status','pending'),'repeating returns the open suggestion');
select pg_temp.ok((select i->'suggestion' @> '{"status":"pending"}' from jsonb_array_elements(public.community_saved(pg_temp.id('f1'),null,25)->'items')i where i->>'id'=pg_temp.id('l1')::text),'saved link shows the pending suggestion');
select pg_temp.rejects($q$select public.community_link_review_queue()$q$,'42501','community_moderator_required');
select pg_temp.as_user(3);
select pg_temp.ok(public.community_link_review_queue() @> '{"canTrust":false}' and public.community_link_review_queue()#>'{items,0}' @> jsonb_build_object('id',pg_temp.id('s1'),'author','Asha','exam','uceed','isMine',false,'social',false),'moderator sees the queue');
select pg_temp.rejects($q$select public.review_community_link_suggestion(pg_temp.id('s1'),true,null,true)$q$,'42501','community_admin_required');
select pg_temp.rejects($q$select public.review_community_link_suggestion(pg_temp.id('s1'),false,'short',false)$q$,'22023','community_invalid_input');
insert into ids select 'lp1',(public.review_community_link_suggestion(pg_temp.id('s1'),true,null,false)->>'postId')::uuid;
select pg_temp.ok(pg_temp.q($s$select kind='link' and author_id='00000000-0000-4000-8000-000000000961' and title='A fictional guide to two-hour plans' and body like 'A fictional guide that shows%' and link_id=pg_temp.id('l1') from dm_private.community_posts where id=pg_temp.id('lp1')$s$),'approval creates the link post as the suggester');
select pg_temp.rejects($q$select public.review_community_link_suggestion(pg_temp.id('s1'),true,null,false)$q$,'42501','community_link_unavailable');
select pg_temp.as_user(2);
select pg_temp.ok(public.community_cards('links',null,null,25)#>'{cards,0}' @> jsonb_build_object('id',pg_temp.id('lp1'),'kind','link','link',jsonb_build_object('url','https://example.org/two-hour-plan','host','example.org')),'Links list carries the preview');
select pg_temp.ok(public.community_thread(pg_temp.id('lp1'),null,25)->'link' @> '{"site":"Fictional Guides"}' and public.community_thread(pg_temp.id('lp1'),null,25)->>'kind'='link','thread carries the preview');
select pg_temp.ok(public.community_feed(null,null,null,25)->'posts' @> '[]' and not(public.community_feed(null,null,null,25)::text like '%'||pg_temp.id('lp1')||'%'),'link posts stay out of discussions');
insert into ids select 'f2',(public.save_community_folder(null,'Ravi links')->>'id')::uuid;
select public.save_community_link(pg_temp.id('l1'),array[pg_temp.id('f2')],null);
select pg_temp.rejects($q$select public.suggest_community_link(pg_temp.id('l1'),'uceed','Time','Another fictional reason for the same link.')$q$,'P0001','community_link_posted');
select public.save_community_link(pg_temp.id('l3'),array[pg_temp.id('f2')],null);
insert into ids select 's3',(public.suggest_community_link(pg_temp.id('l3'),'nid','Colour','A fictional colour wheel reference for the studio test.')->>'id')::uuid;
select pg_temp.as_user(3);
select pg_temp.ok(public.review_community_link_suggestion(pg_temp.id('s3'),false,'Not specific to the design exams',false)->>'status'='rejected','moderator rejects with a reason');
select pg_temp.as_user(2);
select pg_temp.ok((select i->'suggestion' @> '{"status":"rejected","reason":"Not specific to the design exams"}' from jsonb_array_elements(public.community_saved(pg_temp.id('f2'),null,25)->'items')i where i->>'id'=pg_temp.id('l3')::text),'student sees the reason');

-- Own suggestions, trusted sites.
select pg_temp.as_user(3);
insert into ids select 'f3',(public.save_community_folder(null,'Meera links')->>'id')::uuid;
select public.save_community_link(pg_temp.id('l4'),array[pg_temp.id('f3')],null);
insert into ids select 's4',(public.suggest_community_link(pg_temp.id('l4'),'nid','Perspective','A fictional perspective exercise worth trying twice.')->>'id')::uuid;
select pg_temp.rejects($q$select public.review_community_link_suggestion(pg_temp.id('s4'),true,null,false)$q$,'22023','community_review_own');
select pg_temp.as_user(4);
select pg_temp.ok(public.my_community_standing()->'admin'='true'::jsonb and public.community_link_review_queue()->'canTrust'='true'::jsonb,'administrator may trust sites');
insert into ids select 'lp4',(public.review_community_link_suggestion(pg_temp.id('s4'),true,null,true)->>'postId')::uuid;
select pg_temp.ok(pg_temp.q($s$select title='Ok · studio.example.com' from dm_private.community_posts where id=pg_temp.id('lp4')$s$),'a short title is made readable');
select pg_temp.ok(public.admin_community_trusted_hosts()#>>'{hosts,0,host}'='studio.example.com','site trusted on approval');
select pg_temp.rejects($q$select public.admin_set_community_trusted_host('instagram.com',true)$q$,'22023','community_link_social');
select pg_temp.rejects($q$select public.admin_set_community_trusted_host('not a host',true)$q$,'22023','community_invalid_input');
select pg_temp.as_user(2);
select public.save_community_link(pg_temp.id('l5'),array[pg_temp.id('f2')],null);
select pg_temp.ok(public.suggest_community_link(pg_temp.id('l5'),'nid','Sketching','A fictional sketching routine from a trusted studio blog.') @> '{"status":"approved"}','a trusted site publishes at once');
select pg_temp.as_user(4);
select pg_temp.ok(public.admin_set_community_trusted_host('studio.example.com',false)->'trusted'='false'::jsonb,'trust removed');
select pg_temp.ok(public.admin_community_trusted_hosts()->'hosts'='[]'::jsonb,'trusted list is empty');
select pg_temp.as_user(2);
select pg_temp.rejects($q$select public.admin_community_trusted_hosts()$q$,'42501');

-- A paused member cannot suggest, and their pending suggestion cannot be published.
select pg_temp.as_user(1);
select public.save_community_link(pg_temp.id('l3'),array[pg_temp.id('f1')],null);
insert into ids select 's6',(public.suggest_community_link(pg_temp.id('l3'),'nid','Colour','Another fictional reason this colour reference helps.')->>'id')::uuid;
select pg_temp.as_user(4);
select public.admin_community_sanction('post',pg_temp.id('p1'),'mute',3,'Fictional pause for the link test');
select pg_temp.as_user(3);
select pg_temp.rejects($q$select public.review_community_link_suggestion(pg_temp.id('s6'),true,null,false)$q$,'P0001','community_sanctioned');
select pg_temp.as_user(1);
select pg_temp.rejects($q$select public.suggest_community_link(pg_temp.id('l1'),'uceed','Time','A fictional reason while paused.')$q$,'P0001','community_sanctioned');
select pg_temp.ok((select e->>'schemaVersion'='3' and jsonb_array_length(e->'links')=3 and jsonb_array_length(e->'linkSuggestions')=2 from public.export_my_community_library() e),'export includes links and suggestions');

reset role;
select pg_temp.ok(not has_function_privilege('anon','public.save_community_link(uuid,uuid[],text)','execute')
 and not has_function_privilege('authenticated','public.service_record_community_link(text,text,text,text,text,text)','execute')
 and not has_function_privilege('authenticated','public.service_begin_community_link_fetch(uuid)','execute')
 and not has_function_privilege('anon','public.community_link_review_queue()','execute'),'function privileges');
select pg_temp.ok(not has_table_privilege('authenticated','dm_private.community_links','select')
 and not has_table_privilege('authenticated','dm_private.community_notes','select')
 and not has_table_privilege('authenticated','dm_private.community_link_suggestions','select'),'table privileges');
rollback;
\echo community-links: ok
