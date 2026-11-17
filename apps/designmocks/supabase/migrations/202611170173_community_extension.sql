begin;

-- Community phase 4: the "Save to DMocks" browser extension. A member connects
-- a browser from the Saved page and receives a key once; only its SHA-256 is
-- stored. The extension calls the two extension_* functions below with that
-- key to list folders and save the current tab privately. It never receives a
-- session, cannot read or post anything else, and the tab title is kept only in
-- the member's private note, never in the shared link record.

create table dm_private.community_extension_tokens(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(char_length(label) between 1 and 60),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 last_used_at timestamptz,
 expires_at timestamptz not null,
 revoked_at timestamptz
);
create index community_extension_tokens_user_idx on dm_private.community_extension_tokens(user_id,created_at desc);
alter table dm_private.community_extension_tokens enable row level security;
revoke all on dm_private.community_extension_tokens from public,anon,authenticated,service_role;
create index community_link_saves_user_rate_idx on dm_private.community_link_saves(user_id,created_at desc);

-- The host of an address the browser has already normalized
-- (supabase/functions/_shared/community-link.mjs), or null when it is not a
-- public web address in that form.
create function dm_private.community_link_host(p_url text) returns text
language plpgsql immutable set search_path=pg_catalog as $$
declare m text[]; host text;
begin
 if p_url is null or char_length(p_url)>2000 then return null; end if;
 m:=regexp_match(p_url,'^https?://([a-z0-9.-]+)(/[^#\s]*)$');
 if m is null then return null; end if;
 host:=m[1];
 if host !~ '\.' or host ~ '^[0-9.]+$' or host ~ '^\.|\.\.|\.$|^-|-\.|\.-'
  or host ~ '(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|test|invalid|example|onion)$' then return null; end if;
 return host;
end $$;

create function dm_private.community_extension_actor(p_token text) returns uuid
language plpgsql set search_path=pg_catalog,dm_private as $$
declare v_user uuid;
begin
 if p_token is null or p_token !~ '^dmx_[0-9a-f]{64}$' then
  raise exception 'Connect the extension again' using errcode='42501',detail='community_extension_token';
 end if;
 update dm_private.community_extension_tokens set last_used_at=clock_timestamp()
  where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>clock_timestamp()
  returning user_id into v_user;
 if v_user is null then raise exception 'Connect the extension again' using errcode='42501',detail='community_extension_token'; end if;
 return v_user;
end $$;
revoke all on function dm_private.community_link_host(text),dm_private.community_extension_actor(text) from public,anon,authenticated,service_role;

-- Connections, managed from the Saved page.
create function public.create_community_extension_token(p_label text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_label text:=btrim(coalesce(p_label,'')); v_token text; row dm_private.community_extension_tokens;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if v_label='' then v_label:='Browser'; end if;
 if char_length(v_label)>60 then raise exception 'Invalid label' using errcode='22023',detail='community_invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-extension:'||actor::text,0));
 if(select count(*) from dm_private.community_extension_tokens where user_id=actor and revoked_at is null and expires_at>clock_timestamp())>=5 then
  raise exception 'Too many connected browsers' using errcode='P0001',detail='community_extension_limit';
 end if;
 v_token:='dmx_'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into dm_private.community_extension_tokens(user_id,label,token_hash,expires_at)
 values(actor,v_label,encode(sha256(convert_to(v_token,'UTF8')),'hex'),clock_timestamp()+interval'180 days') returning * into row;
 return jsonb_build_object('id',row.id,'label',row.label,'token',v_token,'createdAt',row.created_at,'expiresAt',row.expires_at);
end $$;

create function public.community_extension_tokens()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('tokens',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'createdAt',created_at,'lastUsedAt',last_used_at,'expiresAt',expires_at)
  order by created_at desc,id) from dm_private.community_extension_tokens where user_id=actor and revoked_at is null and expires_at>clock_timestamp()),'[]'::jsonb));
end $$;

create function public.revoke_community_extension_token(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 update dm_private.community_extension_tokens set revoked_at=clock_timestamp() where id=p_id and user_id=actor and revoked_at is null;
 return jsonb_build_object('revoked',found);
end $$;

-- Called by the extension with its key. No session is involved.
create function public.extension_community_folders(p_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=dm_private.community_extension_actor(p_token);
begin
 return jsonb_build_object('folders',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name) order by lower(f.name),f.id)
  from dm_private.community_folders f where f.user_id=actor),'[]'::jsonb));
end $$;

create function public.extension_save_community_link(p_token text,p_url text,p_folder_ids uuid[],p_new_folder text,p_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=dm_private.community_extension_actor(p_token); v_host text:=dm_private.community_link_host(p_url);
 v_ids uuid[]; v_new text:=btrim(regexp_replace(coalesce(p_new_folder,''),'\s+',' ','g')); v_folder uuid; v_link uuid; v_note text:=btrim(coalesce(p_note,''));
begin
 if v_host is null then raise exception 'That page cannot be saved' using errcode='22023',detail='community_link_invalid'; end if;
 if p_folder_ids is null or cardinality(p_folder_ids)>50 or array_position(p_folder_ids,null) is not null or char_length(v_new)>60 or char_length(v_note)>2000 then
  raise exception 'Invalid link save' using errcode='22023',detail='community_invalid_input';
 end if;
 select coalesce(array_agg(distinct x),'{}') into v_ids from unnest(p_folder_ids) x;
 perform pg_advisory_xact_lock(hashtextextended('community-folder:'||actor::text,0));
 if(select count(*) from dm_private.community_link_saves where user_id=actor and created_at>clock_timestamp()-interval'1 hour')>=120 then
  raise exception 'Too many saves this hour' using errcode='P0001',detail='community_save_rate';
 end if;
 if(select count(*) from dm_private.community_folders where user_id=actor and id=any(v_ids))<>cardinality(v_ids) then
  raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable';
 end if;
 if v_new<>'' then
  select id into v_folder from dm_private.community_folders where user_id=actor and lower(name)=lower(v_new);
  if v_folder is null then
   if(select count(*) from dm_private.community_folders where user_id=actor)>=50 then
    raise exception 'Too many folders' using errcode='P0001',detail='community_folder_limit';
   end if;
   insert into dm_private.community_folders(user_id,name) values(actor,v_new) returning id into v_folder;
  end if;
  v_ids:=array_append(v_ids,v_folder);
 end if;
 if cardinality(v_ids)=0 then raise exception 'Choose a folder' using errcode='22023',detail='community_invalid_input'; end if;
 -- A new address is recorded without a preview; the member fetches one from Saved.
 insert into dm_private.community_links(url,host,status,fetched_at)
 values(p_url,v_host,case when dm_private.community_social_host(v_host) then 'skipped' else 'unavailable' end,'1970-01-01T00:00:00Z')
 on conflict(url) do nothing;
 select id into v_link from dm_private.community_links where url=p_url;
 insert into dm_private.community_link_saves(user_id,link_id,folder_id) select actor,v_link,x from unnest(v_ids) x on conflict do nothing;
 if(select count(distinct link_id) from dm_private.community_link_saves where user_id=actor)>1000 then
  raise exception 'Too many saved links' using errcode='P0001',detail='community_save_limit';
 end if;
 if v_note<>'' then
  insert into dm_private.community_notes(user_id,link_id,body) values(actor,v_link,v_note)
  on conflict(user_id,link_id) where link_id is not null do update set body=excluded.body,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('linkId',v_link,'folderIds',(select jsonb_agg(x order by x) from unnest(array(select distinct unnest(v_ids))) x));
end $$;

revoke all on function public.create_community_extension_token(text),public.community_extension_tokens(),public.revoke_community_extension_token(uuid),
 public.extension_community_folders(text),public.extension_save_community_link(text,text,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.create_community_extension_token(text),public.community_extension_tokens(),public.revoke_community_extension_token(uuid) to authenticated;
-- The extension calls these with the public key and its own connection key.
grant execute on function public.extension_community_folders(text),public.extension_save_community_link(text,text,uuid[],text,text) to anon,authenticated;

commit;
