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
create function pg_temp.u(statement text) returns uuid language plpgsql security definer as $$
declare result uuid; begin execute statement into result; return result; end $$;
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000090'||n,true)
$$;
create function pg_temp.body(label text) returns text language sql as $$
 select '## '||label||E'\n\n'||repeat('An original fictional paragraph about planning a sketching routine. ',4)||E'\n\n- **first** point\n- second point'
$$;

insert into auth.users(id) select ('00000000-0000-4000-8000-00000000090'||g)::uuid from generate_series(1,6)g;
insert into public.profiles(user_id,display_name) values('00000000-0000-4000-8000-000000000901','Asha Fictional'),('00000000-0000-4000-8000-000000000902','Ravi Fictional');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000906');
create temp table ids(name text primary key,id uuid);
grant all on ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

-- Publishing, replay, conflict and validation.
select pg_temp.as_user(1);
insert into ids select 'draft',((public.save_community_draft(null,null,'',' Unfinished ','notes'))->>'id')::uuid;
select pg_temp.ok(jsonb_array_length(public.community_drafts()->'drafts')=1,'draft is listed');
select pg_temp.ok((public.save_community_draft((select id from ids where name='draft'),'NID','Studio','A fictional draft title','longer notes'))->>'id'=(select id::text from ids where name='draft'),'draft updates in place');
insert into ids select 'a1',((public.create_community_article(' NID ',' Studio test ','How I planned my studio test week',pg_temp.body('Plan'),'a0000000-0000-4000-8000-000000000001',(select id from ids where name='draft')))->>'id')::uuid;
select pg_temp.ok(jsonb_array_length(public.community_drafts()->'drafts')=0,'publishing removes the draft');
select pg_temp.ok(pg_temp.q($s$select (select kind='article' and exam='nid' and topic='Studio test' from dm_private.community_posts where id=(select id from ids where name='a1'))$s$),'article row is normalized');
select pg_temp.ok((public.create_community_article('nid','Studio test','How I planned my studio test week',pg_temp.body('Plan'),'a0000000-0000-4000-8000-000000000001',null))
 @> jsonb_build_object('id',(select id from ids where name='a1'),'replayed',true),'identical retry replays the receipt');
select pg_temp.ok(pg_temp.q($s$select (select count(*)=1 from dm_private.community_posts where kind='article')$s$),'retry created nothing');
select pg_temp.rejects($q$select public.create_community_article('nid','Studio test','A different fictional title',pg_temp.body('Plan'),'a0000000-0000-4000-8000-000000000001',null)$q$,'22023','community_request_conflict');
select pg_temp.rejects($q$select public.create_community_article('nid','Studio','Too short body here','short','a0000000-0000-4000-8000-000000000002',null)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.create_community_article('jee','Studio','A fictional valid title',pg_temp.body('x'),'a0000000-0000-4000-8000-000000000002',null)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.create_community_article('nid','Studio','A fictional valid title',pg_temp.body('x'),null,null)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.save_community_draft('a0000000-0000-4000-8000-00000000dead',null,'','','')$q$,'42501','community_draft_unavailable');

-- Contact guard: articles, discussions and replies, by any writer.
select pg_temp.rejects($q$select public.create_community_article('nid','Studio','A fictional valid title',pg_temp.body('x')||' Call 98765 43210.','a0000000-0000-4000-8000-000000000003',null)$q$,'22023','community_contact_details');
select pg_temp.rejects($q$select public.create_community_article('nid','Studio','Follow @asha.draws for more',pg_temp.body('x'),'a0000000-0000-4000-8000-000000000003',null)$q$,'22023','community_contact_details');
select pg_temp.rejects($q$select public.create_community_post('uceed','observation','A fictional discussion title','Write to asha@example.invalid for my notes please.','a0000000-0000-4000-8000-000000000004')$q$,'22023','community_contact_details');
select pg_temp.rejects($q$select public.add_community_comment((select id from ids where name='a1'),null,'DM me for the file','a0000000-0000-4000-8000-000000000005')$q$,'22023','community_contact_details');
select pg_temp.rejects($q$select public.add_community_comment((select id from ids where name='a1'),null,'join t.me/designprep','a0000000-0000-4000-8000-000000000005')$q$,'22023','community_contact_details');
select pg_temp.ok(pg_temp.q($s$select (select count(*)=1 from dm_private.community_posts) and (select count(*)=0 from dm_private.community_comments)$s$),'refused text wrote nothing');
insert into ids select 'd1',((public.create_community_post('uceed','observation','A fictional discussion title','I scored 142.5 in 2026 with rank 1,204 and fees near 2,50,000.','a0000000-0000-4000-8000-000000000006'))->>'id')::uuid;

-- Three articles a day.
insert into ids select 'a2',((public.create_community_article('uceed','Time','A second fictional article title',pg_temp.body('Two'),'a0000000-0000-4000-8000-000000000007',null))->>'id')::uuid;
insert into ids select 'a3',((public.create_community_article('nid','Colour','A third fictional article title',pg_temp.body('Three'),'a0000000-0000-4000-8000-000000000008',null))->>'id')::uuid;
select pg_temp.rejects($q$select public.create_community_article('nid','Colour','A fourth fictional article title',pg_temp.body('Four'),'a0000000-0000-4000-8000-000000000009',null)$q$,'P0001','community_article_limit');

-- Feeds: discussions and articles are separate.
select pg_temp.as_user(2);
select pg_temp.ok((select jsonb_agg(p->>'id')=jsonb_build_array((select id from ids where name='d1')) from jsonb_array_elements(public.community_feed(null,null,null,25)->'posts')p),'discussion feed has no articles');
select pg_temp.ok((public.community_articles(null,'latest',null,25)#>>'{articles,0,id}')=(select id::text from ids where name='a3')
 and jsonb_array_length(public.community_articles(null,'latest',null,25)->'articles')=3,'latest lists articles newest first');
select pg_temp.ok(public.community_articles('uceed','latest',null,25)#>>'{articles,0,id}'=(select id::text from ids where name='a2')
 and jsonb_array_length(public.community_articles('uceed','latest',null,25)->'articles')=1,'exam filter applies');
select pg_temp.ok((public.community_articles(null,'latest',null,25)#>'{articles,0}') @> '{"author":"Asha","liked":false,"saved":false,"isMine":false,"likes":0,"comments":0,"status":"visible"}'
 and (public.community_articles(null,'latest',null,25)#>>'{articles,0,excerpt}') like 'Three An original fictional paragraph%first point second point','card carries first name and a plain excerpt');
select pg_temp.ok((public.community_articles(null,'latest',null,2)->'nextCursor'->>'id')=(select id::text from ids where name='a2'),'first page returns a cursor');
select pg_temp.ok((select jsonb_agg(a->>'id')=jsonb_build_array((select id from ids where name='a1'))
 from jsonb_array_elements(public.community_articles(null,'latest',public.community_articles(null,'latest',null,2)->'nextCursor',2)->'articles')a),'second page continues without repeats');
select pg_temp.rejects($q$select public.community_articles(null,'top','{"createdAt":"2026-01-01T00:00:00Z","id":"a0000000-0000-4000-8000-000000000001"}',5)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.community_articles(null,'latest','{"createdAt":"never","id":"x"}',5)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.community_articles(null,'latest',null,26)$q$,'22023','community_invalid_input');

-- Likes.
select pg_temp.ok(public.set_community_like((select id from ids where name='a1'),true) @> '{"liked":true,"likes":1}','like counts once');
select pg_temp.ok(public.set_community_like((select id from ids where name='a1'),true) @> '{"liked":true,"likes":1}','like is idempotent');
select pg_temp.ok(public.community_articles(null,'top',null,25)#>>'{articles,0,id}'=(select id::text from ids where name='a1'),'top orders by recent likes');
select pg_temp.ok((public.community_thread((select id from ids where name='a1'),null,25)) @> '{"kind":"article","author":"Asha","likes":1,"liked":true,"isMine":false,"folderIds":[]}','thread header carries reading fields');
select pg_temp.ok(public.set_community_like((select id from ids where name='a1'),false) @> '{"liked":false,"likes":0}','unlike removes it');
select pg_temp.as_user(1);
select pg_temp.rejects($q$select public.set_community_like((select id from ids where name='a1'),true)$q$,'22023','community_like_own');
select pg_temp.rejects($q$select public.set_community_like('a0000000-0000-4000-8000-00000000dead',true)$q$,'42501','community_target_unavailable');

-- Folders and saves.
select pg_temp.as_user(2);
insert into ids select 'f1',((public.save_community_folder(null,'  NID   studio  '))->>'id')::uuid;
insert into ids select 'f2',((public.save_community_folder(null,'Time management'))->>'id')::uuid;
select pg_temp.ok(pg_temp.q($s$select (select name='NID studio' from dm_private.community_folders where id=(select id from ids where name='f1'))$s$),'folder name is normalized');
select pg_temp.rejects($q$select public.save_community_folder(null,'nid STUDIO')$q$,'23505','community_folder_exists');
select pg_temp.rejects($q$select public.save_community_folder(null,'   ')$q$,'22023','community_invalid_input');
select pg_temp.ok(public.set_community_saves((select id from ids where name='a1'),array[(select id from ids where name='f1'),(select id from ids where name='f2')])->'folderIds'
 @> to_jsonb(array[(select id from ids where name='f1'),(select id from ids where name='f2')]),'post saved into two folders');
select pg_temp.ok(jsonb_array_length(public.set_community_saves((select id from ids where name='a1'),array[(select id from ids where name='f1')])->'folderIds')=1,'save set is replaced exactly');
select pg_temp.ok(public.set_community_saves((select id from ids where name='d1'),array[(select id from ids where name='f1')])->>'postId'=(select id::text from ids where name='d1'),'discussions can be saved too');
select pg_temp.ok((select (f->>'count')::int=2 from jsonb_array_elements(public.community_folders()->'folders')f where f->>'name'='NID studio'),'folder count');
select pg_temp.ok(public.save_community_folder((select id from ids where name='f1'),'Studio prep')->>'name'='Studio prep','rename');
select pg_temp.ok(jsonb_array_length(public.community_saved((select id from ids where name='f1'),null,25)->'items')=2
 and (public.community_saved((select id from ids where name='f1'),null,25)#>'{items,0}') @> '{"available":true,"kind":"discussion"}','saved page lists newest save first');
select pg_temp.ok(public.community_saved((select id from ids where name='f1'),null,1)->'nextCursor' is not null
 and jsonb_array_length(public.community_saved((select id from ids where name='f1'),public.community_saved((select id from ids where name='f1'),null,1)->'nextCursor',1)->'items')=1,'saved page continues');
select pg_temp.ok(public.community_articles(null,'latest',null,25)#>'{articles,2,saved}'='true'::jsonb,'card shows saved state');
select pg_temp.ok(public.remove_community_save((select id from ids where name='d1'),(select id from ids where name='f2'))->'removed'='false'::jsonb,'a save in another folder is untouched');
select pg_temp.ok(public.remove_community_save((select id from ids where name='d1'),(select id from ids where name='f1'))->'removed'='true'::jsonb,'one save is removed');
select pg_temp.ok(jsonb_array_length(public.community_saved((select id from ids where name='f1'),null,25)->'items')=1,'the folder keeps its other save');
select public.set_community_saves((select id from ids where name='d1'),array[(select id from ids where name='f1')]);
select public.save_community_draft(null,'nid','Export','A fictional draft for export','kept text');
select pg_temp.ok((select (e->>'schemaVersion')::int>=1 and e @> '{"accountId":"00000000-0000-4000-8000-000000000902","likes":[],"blocked":[]}'
 and jsonb_array_length(e->'folders')=2 and jsonb_array_length(e->'drafts')=1 and e#>>'{drafts,0,body}'='kept text'
 and (select sum(jsonb_array_length(f->'saves'))=2 from jsonb_array_elements(e->'folders')f) from public.export_my_community_library() e),'library export holds folders, saves and drafts');
select pg_temp.as_user(3);
select pg_temp.rejects($q$select public.set_community_saves((select id from ids where name='a1'),array[(select id from ids where name='f1')])$q$,'42501','community_folder_unavailable');
select pg_temp.rejects($q$select public.community_saved((select id from ids where name='f1'),null,25)$q$,'42501','community_folder_unavailable');
select pg_temp.rejects($q$select public.delete_community_folder((select id from ids where name='f1'))$q$,'42501','community_folder_unavailable');
select pg_temp.ok(public.community_folders()->'folders'='[]'::jsonb,'folders are private to their owner');
select pg_temp.ok((select e->'folders'='[]'::jsonb and e->'drafts'='[]'::jsonb and e->>'accountId'='00000000-0000-4000-8000-000000000903' from public.export_my_community_library() e),'library export is scoped to the caller');

-- Blocking: posts leave feeds, the thread is unavailable, replies become placeholders.
select pg_temp.as_user(2);
select public.add_community_comment((select id from ids where name='d1'),null,'A fictional helpful reply from Ravi.','a0000000-0000-4000-8000-000000000010');
select pg_temp.as_user(1);
select pg_temp.rejects($q$select public.set_community_block((select id from ids where name='a1'),null)$q$,'22023','community_block_self');
select pg_temp.ok(pg_temp.q($s$select public.set_community_block(null,(select id from dm_private.community_comments limit 1))->'blocked'='true'::jsonb$s$),'block by reply');
select pg_temp.ok(public.community_thread((select id from ids where name='d1'),null,25)#>'{comments,0}' @> '{"blocked":true,"body":"","author":"Blocked author","assetCount":0}','blocked reply is a placeholder');
select pg_temp.ok(jsonb_array_length(public.community_blocked()->'blocked')=1 and public.community_blocked()#>>'{blocked,0,author}'='Ravi','block list shows a first name');
select pg_temp.ok(public.community_blocked()::text !~ '00000000-0000-4000-8000-000000000902','block list never exposes the account id');
select pg_temp.as_user(3);
select pg_temp.ok(public.set_community_block((select id from ids where name='a1'),null)->'blocked'='true'::jsonb,'block by post');
select pg_temp.ok(public.community_articles(null,'latest',null,25)->'articles'='[]'::jsonb and public.community_feed(null,null,null,25)->'posts'='[]'::jsonb,'blocked author leaves both feeds');
select pg_temp.rejects($q$select public.community_thread((select id from ids where name='a1'),null,25)$q$,'42501','community_target_unavailable');
select pg_temp.rejects($q$select public.set_community_like((select id from ids where name='a1'),true)$q$,'42501','community_target_unavailable');
select pg_temp.ok(public.remove_community_block(public.community_blocked()#>>'{blocked,0,handle}')->'removed'='true'::jsonb,'unblock by handle');
select pg_temp.ok(jsonb_array_length(public.community_articles(null,'latest',null,25)->'articles')=3,'unblocking restores the feed');
select pg_temp.ok(public.remove_community_block(repeat('a',64))->'removed'='false'::jsonb,'unknown handle removes nothing');

-- Reports: new reasons, and three independent reports hide the target.
select public.report_community_content((select id from ids where name='a2'),null,'personal_details','A fictional concern.');
select pg_temp.as_user(4);select public.report_community_content((select id from ids where name='a2'),null,'safety',null);
select pg_temp.ok(pg_temp.q($s$select (select status='visible' from dm_private.community_posts where id=(select id from ids where name='a2'))$s$),'two reports do not hide');
select pg_temp.as_user(5);select public.report_community_content((select id from ids where name='a2'),null,'spam',null);
reset role;
select pg_temp.ok((select status='hidden' from dm_private.community_posts where id=(select id from ids where name='a2')),'third report hides the post');
select pg_temp.ok((select count(*)=1 from dm_private.community_moderation_log where target_id=(select id from ids where name='a2') and action='hide' and actor_id is null),'automatic hide is logged without an actor');
set local role authenticated;
select pg_temp.as_user(2);
select pg_temp.ok(jsonb_array_length(public.community_articles(null,'latest',null,25)->'articles')=2,'hidden article leaves the feed');
select pg_temp.rejects($q$select public.set_community_saves((select id from ids where name='a2'),array[(select id from ids where name='f2')])$q$,'42501','community_target_unavailable');
-- A saved post that is later hidden stays in the folder without content.
select pg_temp.as_user(6);
select public.admin_moderate_community('post',(select id from ids where name='a1'),'hide','Fictional moderation check',public.admin_review_community_content('post',(select id from ids where name='a1'))->>'reviewVersion',gen_random_uuid());
select pg_temp.as_user(2);
select pg_temp.ok((select i @> '{"available":false}' and (select array_agg(k order by k) from jsonb_object_keys(i) k)=array['available','id','postId','savedAt','type']
 from jsonb_array_elements(public.community_saved((select id from ids where name='f1'),null,25)->'items')i where i->>'postId'=(select id::text from ids where name='a1')),'hidden saved post has no content');
select pg_temp.ok(jsonb_array_length(public.set_community_saves((select id from ids where name='a1'),'{}')->'folderIds')=0,'a hidden post can still be removed from folders');
-- After a restore, earlier reports do not hide it again.
select pg_temp.as_user(6);
select public.admin_moderate_community('post',(select id from ids where name='a2'),'restore','Fictional restore check',public.admin_review_community_content('post',(select id from ids where name='a2'))->>'reviewVersion',gen_random_uuid());
select pg_temp.as_user(2);select public.report_community_content((select id from ids where name='a2'),null,'other',null);
reset role;
select pg_temp.ok((select status='visible' from dm_private.community_posts where id=(select id from ids where name='a2')),'one report after a restore does not hide again');

-- Deleting a folder removes its saves; deleting an account removes everything of theirs.
set local role authenticated;
select pg_temp.as_user(2);
select public.set_community_like((select id from ids where name='a3'),true);
select public.delete_community_folder((select id from ids where name='f1'));
reset role;
select pg_temp.ok((select count(*)=0 from dm_private.community_saves where folder_id=(select id from ids where name='f1')),'folder delete cascades to saves');
delete from dm_private.community_report_reviews;delete from dm_private.community_reports;delete from dm_private.community_write_receipts;
delete from dm_private.community_comments where author_id='00000000-0000-4000-8000-000000000902';
delete from public.profiles where user_id='00000000-0000-4000-8000-000000000902';
delete from auth.users where id='00000000-0000-4000-8000-000000000902';
select pg_temp.ok((select count(*)=0 from dm_private.community_post_likes where user_id='00000000-0000-4000-8000-000000000902')
 and (select count(*)=0 from dm_private.community_folders where user_id='00000000-0000-4000-8000-000000000902')
 and (select count(*)=0 from dm_private.community_blocks where blocked_id='00000000-0000-4000-8000-000000000902'),'account removal cascades');

-- Privileges: nothing is callable signed out, and no table is readable.
select pg_temp.ok(not has_function_privilege('anon','public.community_articles(text,text,jsonb,integer)','execute')
 and not has_function_privilege('anon','public.set_community_like(uuid,boolean)','execute')
 and not has_function_privilege('anon','public.export_my_community_library()','execute')
 and not has_function_privilege('anon','public.create_community_article(text,text,text,text,uuid,uuid)','execute')
 and not has_function_privilege('authenticated','dm_private.community_contact_check(text)','execute'),'function privileges');
select pg_temp.ok(not has_table_privilege('authenticated','dm_private.community_post_likes','select')
 and not has_table_privilege('authenticated','dm_private.community_folders','select')
 and not has_table_privilege('authenticated','dm_private.community_saves','select')
 and not has_table_privilege('authenticated','dm_private.community_drafts','select')
 and not has_table_privilege('authenticated','dm_private.community_blocks','select'),'table privileges');
rollback;
\echo community-articles: ok
