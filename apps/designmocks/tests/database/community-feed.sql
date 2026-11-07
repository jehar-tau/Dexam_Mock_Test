\set ON_ERROR_STOP on
begin;
create function pg_temp.feed_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.feed_reject(statement text,expected_state text,expected_detail text default null) returns void language plpgsql as $$
declare actual_state text; actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=expected_state and(expected_detail is null or actual_detail=expected_detail) then return;end if;
  raise exception 'FAIL: expected % / %, received % / %',expected_state,expected_detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: feed operation should be rejected';
end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000791'),('00000000-0000-4000-8000-000000000792');
insert into dm_private.community_posts(id,author_id,exam,topic,title,body,status,created_at)
 select md5('feed-post-'||g)::uuid,'00000000-0000-4000-8000-000000000791',
  case g%4 when 0 then'uceed' when 1 then'ceed' when 2 then'nid' else'nift'end,
  case when g%2=0 then'observation'else'Perspective'end,'Original fictional feed discussion '||g,
  'An original fictional discussion used only for bounded feed acceptance.',
  case when g>61 then'hidden'when g%7=0 then'locked'else'visible'end,
  '2025-01-01T00:00:00Z'::timestamptz+(g/3)*interval'1 microsecond' from generate_series(1,65)g;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000792',true);
do $$
declare page jsonb; cursor jsonb; ids text[]:='{}'; expected text[]; steps integer:=0; version text; snapshot text;
begin
 expected:=array(select md5('feed-post-'||g)::uuid::text from generate_series(1,61)g order by g/3 desc,md5('feed-post-'||g)::uuid desc);
 loop
  page:=public.community_feed(null,null,cursor,25);steps:=steps+1;
  perform pg_temp.feed_assert(jsonb_array_length(page->'posts') between 1 and 25,'each page is bounded');
  if steps=1 then version:=page->>'version';snapshot:=page->>'snapshotAt';
   perform set_config('dmocks.feed_cursor',(page->'nextCursor')::text,true);
   perform set_config('dmocks.feed_version',version,true);
  end if;
  perform pg_temp.feed_assert(page->>'version'=version and page->>'snapshotAt'=snapshot,'snapshot and revision remain fixed');
  ids:=ids||array(select item->>'id' from jsonb_array_elements(page->'posts')item);
  cursor:=nullif(page->'nextCursor','null'::jsonb);
  exit when cursor is null;
  perform pg_temp.feed_assert(steps<4,'pagination makes progress');
 end loop;
 perform pg_temp.feed_assert(steps=3 and ids=expected,'every visible/locked post appears once in timestamp/UUID order, including ties and distinct microseconds');
 perform pg_temp.feed_assert(jsonb_array_length(public.community_feed(null,null))=25,'legacy reader remains an array but is bounded');
 page:=public.community_feed(' UCEED ',' observation ',null,25);
 perform pg_temp.feed_assert(page->'filters'='{"exam":"uceed","topic":"observation"}' and jsonb_array_length(page->'posts')=15,'exact normalized exam/topic filters');
 perform pg_temp.feed_assert(exists(select 1 from jsonb_array_elements(page->'posts')p where p->>'status'='locked'),'locked content remains readable');
 perform pg_temp.feed_assert(jsonb_array_length(public.community_feed(null,'perspective',null,25)->'posts')=0,'topic case is exact');
 perform pg_temp.feed_assert(jsonb_array_length(public.community_feed('ceed',null,null,1)->'posts')=1,'explicit smaller page');
end $$;
select pg_temp.feed_reject('select public.community_feed(''invalid'',null,null,25)','22023','community_feed_invalid');
select pg_temp.feed_reject('select public.community_feed(null,repeat(''x'',101),null,25)','22023','community_feed_invalid');
select pg_temp.feed_reject('select public.community_feed(null,null,null,26)','22023','community_feed_invalid');
select pg_temp.feed_reject('select public.community_feed(null,null,null,0)','22023','community_feed_invalid');
select pg_temp.feed_reject('select public.community_feed(null,null,null,null)','22023','community_feed_invalid');
do $$
declare original jsonb:=current_setting('dmocks.feed_cursor')::jsonb; bad jsonb;
begin
 for bad in select value from jsonb_array_elements(jsonb_build_array('[]'::jsonb,'null'::jsonb,'{}'::jsonb,
  original-'id',original||'{"extra":true}',original||'{"version":1.5}',original||'{"version":0}',original||'{"version":"1"}',
  original||'{"id":"invalid"}',original||'{"snapshotAt":"infinity"}',original||'{"createdAt":"not a timestamp"}',
  original||jsonb_build_object('snapshotAt',repeat('1',3000)),original||'{"snapshotAt":"now"}',
  original||jsonb_build_object('snapshotAt',clock_timestamp()+interval'1 day'),original||jsonb_build_object('createdAt',clock_timestamp()+interval'1 day')))
 loop perform pg_temp.feed_reject(format('select public.community_feed(null,null,%L::jsonb,25)',bad::text),'22023','community_feed_invalid');end loop;
 perform pg_temp.feed_reject(format('select public.community_feed(''uceed'',null,%L::jsonb,25)',original::text),'22023','community_feed_invalid');
 perform pg_temp.feed_reject(format('select public.community_feed(null,''observation'',%L::jsonb,25)',original::text),'22023','community_feed_invalid');
end $$;
select pg_temp.feed_reject('select * from dm_private.community_feed_state','42501');
select pg_temp.feed_reject('select dm_private.invalidate_community_feed()','42501');
-- Unrelated thread activity and attachment counts do not invalidate feed pages.
reset role;
insert into dm_private.community_comments(id,post_id,author_id,body)
 values('20000000-0000-4000-8000-000000000791',md5('feed-post-3')::uuid,'00000000-0000-4000-8000-000000000791','An original fictional comment after the feed snapshot.');
insert into dm_private.community_assets(uploader_id,post_id,storage_path,ordinal,mime_type,byte_size)
 values('00000000-0000-4000-8000-000000000791',md5('feed-post-3')::uuid,'fictional-feed-image.png',1,'image/png',10);
update dm_private.community_posts set updated_at=clock_timestamp(),thread_revision=thread_revision+1 where id=md5('feed-post-3')::uuid;
set local role authenticated;
select public.mark_community_helpful('20000000-0000-4000-8000-000000000791');
select pg_temp.feed_assert(public.community_feed(null,null,current_setting('dmocks.feed_cursor')::jsonb,25)->>'version'=current_setting('dmocks.feed_version'),'comments/helpful/images preserve the revision');
-- Both creator signatures get actual post-fence clocks and preserve replay.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000791',true);
do $$
declare legacy uuid; saved jsonb; replay jsonb; page jsonb;
begin
 legacy:=public.create_community_post(' UCEED ',' fictional ','Original fictional legacy post','An original fictional post inserted after the reading snapshot.');
 saved:=public.create_community_post('ceed','fictional','Original fictional replay post','An original fictional receipt post after the reading snapshot.','30000000-0000-4000-8000-000000000791');
 replay:=public.create_community_post('ceed','fictional','Original fictional replay post','An original fictional receipt post after the reading snapshot.','30000000-0000-4000-8000-000000000791');
 perform pg_temp.feed_assert(saved->>'id'=replay->>'id' and(replay->>'replayed')::boolean,'post receipts remain idempotent');
 page:=public.community_feed(null,null,current_setting('dmocks.feed_cursor')::jsonb,25);
 perform pg_temp.feed_assert(page->>'version'=current_setting('dmocks.feed_version') and not exists(select 1 from jsonb_array_elements(page->'posts')p where p->>'id' in(legacy::text,saved->>'id')),'new posts do not change the revision or join an older snapshot');
end $$;
reset role;
-- Displayed content, membership and ordering changes invalidate older pages.
do $$
declare statement text; before_revision bigint;
begin
 foreach statement in array array[
  'update dm_private.community_posts set status=''hidden'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set status=''visible'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set status=''locked'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set status=''visible'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set title=''Changed original fictional title'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set body=''Changed original fictional discussion body.'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set exam=''uceed'',topic=''Changed topic'' where id=md5(''feed-post-3'')::uuid',
  'update dm_private.community_posts set created_at=created_at-interval''1 second'' where id=md5(''feed-post-3'')::uuid',
  'delete from dm_private.community_posts where id=md5(''feed-post-3'')::uuid']
 loop
  select revision into before_revision from dm_private.community_feed_state where singleton;
  execute statement;
  perform pg_temp.feed_assert((select revision=before_revision+1 from dm_private.community_feed_state where singleton),'display/membership/order change increments revision once');
 end loop;
end $$;
set local role authenticated;
select pg_temp.feed_reject('select public.community_feed(null,null,current_setting(''dmocks.feed_cursor'')::jsonb,25)','40001','community_feed_changed');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.feed_reject('select public.community_feed(null,null,null,25)','42501');
select pg_temp.feed_reject('select public.community_feed()','42501');
reset role;
set local role service_role;
select pg_temp.feed_reject('select * from dm_private.community_feed_state','42501');
reset role;
set local role anon;
select pg_temp.feed_reject('select public.community_feed(null,null,null,25)','42501');
select pg_temp.feed_reject('select public.community_feed()','42501');
reset role;
rollback;
\echo 'PASS: bounded/filter-bound feed snapshots, tied microsecond order, legacy compatibility, insertion/replay clocks, revision fences and private/anonymous boundaries.'
