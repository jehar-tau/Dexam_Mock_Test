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
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000098'||n,true)
$$;
insert into auth.users(id,email) select ('00000000-0000-4000-8000-00000000098'||g)::uuid,'prep-'||g||'@example.invalid' from generate_series(1,3)g;
insert into public.profiles(user_id,display_name) values('00000000-0000-4000-8000-000000000981','Asha Fictional'),('00000000-0000-4000-8000-000000000982','Ravi Fictional');
create temp table ids(name text primary key,id uuid);
create function pg_temp.id(name text) returns uuid language sql as $$ select id from ids where ids.name=$1 $$;
grant all on ids to authenticated,service_role;
grant execute on function pg_temp.id(text) to authenticated,service_role;
set local role service_role;
insert into ids select 'l1',(public.service_record_community_link('https://example.org/perspective-grids','example.org','fetched','A fictional guide to perspective grids','Fictional Studio','Two-point grids for the studio test.')->>'id')::uuid;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

-- Content to keep: Ravi writes, Asha saves, notes and writes her own.
select pg_temp.as_user(2);
insert into ids select 'p1',(public.create_community_post('uceed','time management','A fictional plan for the two hours','Spend twenty minutes on the first section, then check the clock.','e0000000-0000-4000-8000-000000000001')->>'id')::uuid;
insert into ids select 'p2',(public.create_community_post('nid','colour','A fictional colour wheel question','How do you pick a palette under time pressure in the studio test?','e0000000-0000-4000-8000-000000000002')->>'id')::uuid;
insert into ids select 'p3',(public.create_community_post('nid','perspective','Another fictional 100% sure method','Use a ruler_free method for the vanishing point, it is fictional.','e0000000-0000-4000-8000-000000000003')->>'id')::uuid;
select pg_temp.as_user(1);
insert into ids select 'f1',(public.save_community_folder(null,'Studio test')->>'id')::uuid;
select public.set_community_saves(pg_temp.id('p1'),array[pg_temp.id('f1')]);
select public.save_community_link(pg_temp.id('l1'),array[pg_temp.id('f1')],'Practise the grid twice a week');
insert into ids select 'mine',(public.create_community_post('uceed','sketching','My fictional sketching routine','Ten gesture sketches, then one timed composition every evening.','e0000000-0000-4000-8000-000000000004')->>'id')::uuid;
select public.save_community_draft(null,'nid','Portfolio','An unfinished fictional portfolio note','Notes about the portfolio review.');

-- Private notes on posts.
select pg_temp.ok(public.community_my_note(pg_temp.id('p1'))->'note'='null'::jsonb,'no note yet');
select pg_temp.ok(public.set_community_note(pg_temp.id('p1'),'  Try this split on the next mock.  ')->>'note'='Try this split on the next mock.','note saved and trimmed');
select pg_temp.ok(public.set_community_note(pg_temp.id('p2'),'Ask a teacher about palettes.')->>'note'='Ask a teacher about palettes.','a note on an unsaved post');
select pg_temp.ok(public.community_my_note(pg_temp.id('p1'))->>'note'='Try this split on the next mock.','note read back');
select pg_temp.rejects($q$select public.set_community_note(pg_temp.id('p1'),repeat('x',2001))$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.set_community_note('a0000000-0000-4000-8000-00000000dead','A note on nothing')$q$,'42501','community_target_unavailable');
select pg_temp.ok((select i->>'note'='Try this split on the next mock.' from jsonb_array_elements(public.community_saved(pg_temp.id('f1'),null,25)->'items')i where i->>'type'='post'),'Saved shows the post note');
select pg_temp.as_user(2);
select pg_temp.ok(public.community_my_note(pg_temp.id('p1'))->'note'='null'::jsonb,'notes are private');
select pg_temp.as_user(1);

-- Learn programmes.
select pg_temp.ok(public.set_learn_programme_saved('cube-nets','Cube nets',true)->'saved'='true'::jsonb,'programme saved');
select pg_temp.ok(public.set_learn_programme_saved('perspective','Perspective and viewpoint',true)->'saved'='true'::jsonb,'second programme saved');
select pg_temp.ok(public.learn_programme_saved('cube-nets')->'saved'='true'::jsonb and public.learn_programme_saved('dice')->'saved'='false'::jsonb,'saved state');
select pg_temp.rejects($q$select public.set_learn_programme_saved('../admin','x',true)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.set_learn_programme_saved('cube-nets','',true)$q$,'22023','community_invalid_input');
select pg_temp.ok(public.set_learn_programme_saved('cube-nets',null,false)->'saved'='false'::jsonb,'programme removed');
select public.set_learn_programme_saved('cube-nets','Cube nets',true);

-- Overview.
select pg_temp.ok(public.community_prep()->'counts'='{"folders":1,"savedPosts":1,"savedLinks":1,"notes":3,"posts":1,"drafts":1,"learn":2}'::jsonb,'counts');
select pg_temp.ok(public.community_prep()#>'{posts,0}' @> jsonb_build_object('id',pg_temp.id('mine'),'kind','discussion','comments',0,'likes',0)
 and jsonb_array_length(public.community_prep()->'learn')=2 and public.community_prep()#>>'{drafts,0,title}'='An unfinished fictional portfolio note','overview lists own posts, Learn and drafts');
select pg_temp.ok((select count(*)=3 from jsonb_array_elements(public.community_prep()->'notes'))
 and (select n @> '{"type":"link","url":"https://example.org/perspective-grids"}' from jsonb_array_elements(public.community_prep()->'notes')n where n->>'type'='link'),'notes on posts and links');

-- Search.
create function pg_temp.found(query text) returns text[] language sql as $$
 select coalesce(array_agg(r->>'type'||':'||coalesce(r->>'title','')),'{}') from jsonb_array_elements(public.community_prep_search(query)->'results')r
$$;
grant execute on function pg_temp.found(text) to authenticated;
select pg_temp.ok(pg_temp.found('two hours')=array['saved-post:A fictional plan for the two hours'],'saved post by title');
select pg_temp.ok(pg_temp.found('next mock')=array['saved-post:A fictional plan for the two hours'],'saved post by its note');
select pg_temp.ok(pg_temp.found('GRID twice')=array['link:A fictional guide to perspective grids'],'link by note, any case');
select pg_temp.ok(pg_temp.found('studio test')=array['link:A fictional guide to perspective grids'],'link by description');
select pg_temp.ok(pg_temp.found('gesture')=array['my-post:My fictional sketching routine'],'own post');
select pg_temp.ok(pg_temp.found('palettes')=array['note:A fictional colour wheel question'],'note on an unsaved post');
select pg_temp.ok(pg_temp.found('portfolio review')=array['draft:An unfinished fictional portfolio note'],'draft');
select pg_temp.ok(pg_temp.found('cube nets')=array['learn:Cube nets'],'Learn programme');
select pg_temp.ok(pg_temp.found('fictional') @> array['saved-post:A fictional plan for the two hours','link:A fictional guide to perspective grids','my-post:My fictional sketching routine']
 and not(pg_temp.found('fictional') @> array['saved-post:A fictional colour wheel question']),'only the member''s own items');
select pg_temp.ok(pg_temp.found('two palettes')='{}','every term must match');
select pg_temp.ok(pg_temp.found('100%')='{}','unsaved posts are not searched');
select public.set_community_saves(pg_temp.id('p3'),array[pg_temp.id('f1')]);
select pg_temp.ok(pg_temp.found('100%')=array['saved-post:Another fictional 100% sure method'] and pg_temp.found('ruler_free')=array['saved-post:Another fictional 100% sure method'],'literal % and _ match');
select pg_temp.ok(pg_temp.found('%%')='{}' and pg_temp.found('__')='{}' and pg_temp.found('\%')='{}','wildcards are not wildcards');
select public.set_community_saves(pg_temp.id('p3'),'{}');
select pg_temp.ok(public.community_prep_search('  two   hours  ')->>'query'='two hours','query normalized');
select pg_temp.rejects($q$select public.community_prep_search('x')$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.community_prep_search(repeat('x',101))$q$,'22023','community_invalid_input');

-- Blocking and hiding remove posts from search and notes.
select public.set_community_block(pg_temp.id('p1'),null);
select pg_temp.ok(pg_temp.found('two hours')='{}' and pg_temp.found('palettes')='{}','blocked author leaves search');
select pg_temp.ok((select count(*)=1 from jsonb_array_elements(public.community_prep()->'notes')),'blocked author''s notes leave the overview');
select pg_temp.as_user(3);
select pg_temp.ok(public.community_prep()->'counts'='{"folders":0,"savedPosts":0,"savedLinks":0,"notes":0,"posts":0,"drafts":0,"learn":0}'::jsonb
 and public.community_prep_search('fictional')->'results'='[]'::jsonb,'another member sees nothing');
select pg_temp.as_user(1);
select pg_temp.ok((select e->'learn' @> '[{"programme":"cube-nets"}]' and (e->>'schemaVersion')::int>=4 from public.export_my_community_library() e),'export includes Learn saves');

reset role;
select pg_temp.ok(not has_function_privilege('anon','public.community_prep()','execute')
 and not has_function_privilege('anon','public.community_prep_search(text)','execute')
 and not has_function_privilege('anon','public.set_community_note(uuid,text)','execute')
 and not has_table_privilege('authenticated','dm_private.community_learn_saves','select'),'privileges');
rollback;
\echo community-prep: ok
