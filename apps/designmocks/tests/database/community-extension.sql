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
 select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000097'||n,true)
$$;
insert into auth.users(id,email) select ('00000000-0000-4000-8000-00000000097'||g)::uuid,'extension-'||g||'@example.invalid' from generate_series(1,2)g;
create temp table keys(name text primary key,value text);
create function pg_temp.key(name text) returns text language sql as $$ select value from keys where keys.name=$1 $$;
grant all on keys to authenticated,anon;
grant execute on function pg_temp.key(text) to authenticated,anon;

-- Connecting a browser: the key is returned once and only its hash is kept.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.as_user(1);
insert into keys select 'k1',public.create_community_extension_token('  Chrome on my laptop  ')->>'token';
insert into keys select 'f1',public.save_community_folder(null,'Inspiration')->>'id';
select pg_temp.ok(pg_temp.key('k1') ~ '^dmx_[0-9a-f]{64}$','key format');
select pg_temp.ok(pg_temp.q($s$select token_hash=encode(sha256(convert_to(pg_temp.key('k1'),'UTF8')),'hex') and label='Chrome on my laptop' and expires_at>now()+interval'179 days'
 from dm_private.community_extension_tokens$s$) and not pg_temp.q($s$select exists(select 1 from dm_private.community_extension_tokens where token_hash like '%'||substr(pg_temp.key('k1'),5,20)||'%')$s$),'only the hash is stored');
select pg_temp.ok(public.community_extension_tokens()#>'{tokens,0}' @> '{"label":"Chrome on my laptop","lastUsedAt":null}' and public.community_extension_tokens()::text !~ 'dmx_','list never shows the key');
select public.create_community_extension_token('') from generate_series(1,4);
select pg_temp.rejects($q$select public.create_community_extension_token('Sixth')$q$,'P0001','community_extension_limit');
select pg_temp.ok(public.community_extension_tokens()#>>'{tokens,0,label}'='Browser','an empty label becomes Browser');

-- The extension uses the public key and its connection key only.
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.ok(public.extension_community_folders(pg_temp.key('k1'))#>>'{folders,0,name}'='Inspiration','folders by key');
select pg_temp.rejects($q$select public.extension_community_folders('dmx_'||repeat('0',64))$q$,'42501','community_extension_token');
select pg_temp.rejects($q$select public.extension_community_folders('not a key')$q$,'42501','community_extension_token');
select pg_temp.rejects($q$select public.save_community_link(gen_random_uuid(),'{}',null)$q$,'42501');
select pg_temp.rejects($q$select public.create_community_extension_token('x')$q$,'42501');
select pg_temp.ok(public.extension_save_community_link(pg_temp.key('k1'),'https://example.org/sketching-routine',array[pg_temp.key('f1')::uuid],'','  A fictional page title  ')->'folderIds'
 =jsonb_build_array(pg_temp.key('f1')::uuid),'save into a folder');
select pg_temp.ok(pg_temp.q($s$select status='unavailable' and title is null and fetched_at='1970-01-01T00:00:00Z' and host='example.org' from dm_private.community_links where url='https://example.org/sketching-routine'$s$),'saved without a preview and marked stale');
select pg_temp.ok(pg_temp.q($s$select body='A fictional page title' from dm_private.community_notes where link_id=(select id from dm_private.community_links where url='https://example.org/sketching-routine')$s$),'the tab title is a private note');
select pg_temp.ok(jsonb_array_length(public.extension_save_community_link(pg_temp.key('k1'),'https://www.instagram.com/p/fictional/','{}','From Instagram',null)->'folderIds')=1,'save into a new folder');
select pg_temp.ok(pg_temp.q($s$select status='skipped' from dm_private.community_links where url='https://www.instagram.com/p/fictional/'$s$)
 and pg_temp.q($s$select count(*)=2 from dm_private.community_folders where user_id='00000000-0000-4000-8000-000000000971'$s$),'social pages are skipped, the folder is created');
select pg_temp.ok(jsonb_array_length(public.extension_save_community_link(pg_temp.key('k1'),'https://www.instagram.com/p/fictional/','{}',' from instagram ',null)->'folderIds')=1
 and pg_temp.q($s$select count(*)=2 from dm_private.community_folders where user_id='00000000-0000-4000-8000-000000000971'$s$),'an existing folder name is reused');
select pg_temp.rejects($q$select public.extension_save_community_link(pg_temp.key('k1'),'https://example.org/x','{}','',null)$q$,'22023','community_invalid_input');
select pg_temp.rejects($q$select public.extension_save_community_link(pg_temp.key('k1'),'https://example.org/x',array[gen_random_uuid()],'',null)$q$,'42501','community_folder_unavailable');
select pg_temp.rejects(format($q$select public.extension_save_community_link(pg_temp.key('k1'),%L,'{}','New',null)$q$,url),'22023','community_link_invalid')
 from unnest(array['http://127.0.0.1/','http://localhost/','https://db.internal/x','javascript:alert(1)','https://Example.org/','https://example.org/#top','https://example.org:8443/',
  'https://user@example.org/','https://example.org','ftp://example.org/','https://10.0.0.1/','https://site.test/']) url;

-- Saved links appear on the Saved page and a fresh preview replaces the stale record.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.as_user(1);
select pg_temp.ok((select i->'link' @> '{"status":"unavailable","fetchedAt":"1970-01-01T00:00:00+00:00"}' and i->>'note'='A fictional page title'
 from jsonb_array_elements(public.community_saved(pg_temp.key('f1')::uuid,null,25)->'items')i),'Saved shows the extension save');
select pg_temp.ok(public.community_link_lookup('https://example.org/sketching-routine') is null,'a stale record is fetched again');
reset role;
set local role service_role;
select pg_temp.ok(public.service_record_community_link('https://example.org/sketching-routine','example.org','fetched','A fictional sketching routine',null,null)->>'status'='fetched','preview recorded on the same row');
reset role;
set local role authenticated;
select pg_temp.as_user(1);

-- Another member's key cannot reach these folders, and revoking stops the key.
select pg_temp.as_user(2);
insert into keys select 'k2',public.create_community_extension_token('Other')->>'token';
reset role;
set local role anon;
select pg_temp.ok(public.extension_community_folders(pg_temp.key('k2'))->'folders'='[]'::jsonb,'each key sees only its member''s folders');
select pg_temp.rejects($q$select public.extension_save_community_link(pg_temp.key('k2'),'https://example.org/y',array[pg_temp.key('f1')::uuid],'',null)$q$,'42501','community_folder_unavailable');
reset role;
create temp table firstkey(id uuid); grant all on firstkey to authenticated;
insert into firstkey select id from dm_private.community_extension_tokens where token_hash=encode(sha256(convert_to(pg_temp.key('k1'),'UTF8')),'hex');
set local role authenticated;
select pg_temp.as_user(2);
select pg_temp.ok(public.revoke_community_extension_token((select id from firstkey))->'revoked'='false'::jsonb,'another member cannot revoke');
select pg_temp.as_user(1);
select pg_temp.ok(public.revoke_community_extension_token((select id from firstkey))->'revoked'='true'::jsonb,'revoke');
reset role;
set local role anon;
select pg_temp.rejects($q$select public.extension_community_folders(pg_temp.key('k1'))$q$,'42501','community_extension_token');
reset role;
update dm_private.community_extension_tokens set expires_at=now()-interval'1 second' where token_hash=encode(sha256(convert_to(pg_temp.key('k2'),'UTF8')),'hex');
set local role anon;
select pg_temp.rejects($q$select public.extension_community_folders(pg_temp.key('k2'))$q$,'42501','community_extension_token');

reset role;
select pg_temp.ok(has_function_privilege('anon','public.extension_save_community_link(text,text,uuid[],text,text)','execute')
 and not has_function_privilege('anon','public.create_community_extension_token(text)','execute')
 and not has_function_privilege('anon','public.community_extension_tokens()','execute')
 and not has_table_privilege('anon','dm_private.community_extension_tokens','select')
 and not has_table_privilege('authenticated','dm_private.community_extension_tokens','select'),'privileges');
rollback;
\echo community-extension: ok
