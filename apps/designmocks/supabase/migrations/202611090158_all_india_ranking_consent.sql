begin;

-- Rotating a mode or policy, or changing an attestation even back to the same
-- value, must not silently reactivate a past publication and its consents.
alter table public.launch_settings add column ranking_revision uuid not null default gen_random_uuid();
alter table dm_private.launch_gate_attestations add column ranking_revision uuid not null default gen_random_uuid();

create function dm_private.rotate_all_india_ranking_scope()
returns trigger language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  new.ranking_revision:=gen_random_uuid();
  return new;
end $$;
create trigger rotate_all_india_ranking_settings
  before update of environment_mode,policy_version on public.launch_settings
  for each row when (old.environment_mode is distinct from new.environment_mode
    or old.policy_version is distinct from new.policy_version)
  execute function dm_private.rotate_all_india_ranking_scope();
create trigger rotate_all_india_ranking_attestation
  before update on dm_private.launch_gate_attestations
  for each row when (old.gate in ('privacy_terms','child_safety') or new.gate in ('privacy_terms','child_safety'))
  execute function dm_private.rotate_all_india_ranking_scope();

create table dm_private.all_india_ranking_publications(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references dm_private.all_india_events(id),
  released_at timestamptz not null,
  environment_mode text not null check(environment_mode in ('test','live')),
  policy_version text not null check(char_length(btrim(policy_version))>0),
  settings_revision uuid not null,
  privacy_revision uuid not null,
  child_safety_revision uuid not null,
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default clock_timestamp(),
  open_evidence text not null check(char_length(open_evidence) between 8 and 2000),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  close_evidence text check(char_length(close_evidence) between 8 and 2000),
  unique(id,event_id),
  check((closed_at is null and closed_by is null and close_evidence is null) or
    (closed_at is not null and closed_by is not null and close_evidence is not null))
);
create unique index all_india_ranking_publication_open_idx
  on dm_private.all_india_ranking_publications(event_id) where closed_at is null;
create index all_india_ranking_publication_history_idx on dm_private.all_india_ranking_publications(event_id);

create table dm_private.all_india_ranking_consents(
  publication_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,
  revision integer not null check(revision>0),
  shared boolean not null,
  changed_at timestamptz not null default clock_timestamp(),
  primary key(publication_id,user_id),
  foreign key(publication_id,event_id) references dm_private.all_india_ranking_publications(id,event_id),
  foreign key(event_id,user_id) references dm_private.all_india_results(event_id,user_id) on delete cascade
);
alter table dm_private.all_india_ranking_publications enable row level security;
alter table dm_private.all_india_ranking_consents enable row level security;
revoke all on dm_private.all_india_ranking_publications,dm_private.all_india_ranking_consents from public,anon,authenticated,service_role;

create function dm_private.active_all_india_ranking_publication(p_event_id uuid)
returns uuid language sql stable set search_path=pg_catalog,dm_private as $$
  select pub.id
  from dm_private.all_india_ranking_publications pub
  join dm_private.all_india_events e on e.id=pub.event_id and e.results_released_at=pub.released_at
  join public.launch_settings s on s.singleton and s.ranking_revision=pub.settings_revision
    and s.environment_mode=pub.environment_mode and s.policy_version=pub.policy_version
  join dm_private.launch_gate_attestations privacy on privacy.gate='privacy_terms' and privacy.approved
    and char_length(btrim(privacy.evidence))>=8 and privacy.ranking_revision=pub.privacy_revision
  join dm_private.launch_gate_attestations safety on safety.gate='child_safety' and safety.approved
    and char_length(btrim(safety.evidence))>=8 and safety.ranking_revision=pub.child_safety_revision
  where pub.event_id=p_event_id and pub.closed_at is null
$$;

-- All callers use the same deterministic slice; consent never fills empty
-- slots or promotes another candidate tied at the tenth position.
create function dm_private.all_india_ranking_top_ten(p_event_id uuid)
returns setof dm_private.all_india_results language sql stable set search_path=pg_catalog,dm_private as $$
  select r.* from dm_private.all_india_results r where r.event_id=p_event_id and r.rank<=10
  order by r.rank,r.alias,r.attempt_id limit 10
$$;

create function dm_private.require_all_india_ranking_admin()
returns void language plpgsql set search_path=pg_catalog,dm_private as $$
begin
  perform 1 from dm_private.admins where user_id=auth.uid() for key share;
  if not found then raise exception 'Admin access required' using errcode='42501'; end if;
end $$;

create function public.admin_open_all_india_ranking_publication(p_event_id uuid,p_policy_version text,p_evidence text)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  e dm_private.all_india_events;
  settings public.launch_settings;
  pub dm_private.all_india_ranking_publications;
  privacy_revision uuid;
  safety_revision uuid;
  evidence_note text:=btrim(p_evidence);
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from auth.users where id=auth.uid() for key share;
  if not found then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into e from dm_private.all_india_events where id=p_event_id for update;
  select * into settings from public.launch_settings where singleton for share;
  perform 1 from dm_private.launch_gate_attestations
    where gate in ('privacy_terms','child_safety') order by gate for share;
  select * into pub from dm_private.all_india_ranking_publications
    where event_id=p_event_id and closed_at is null for update;
  perform dm_private.require_all_india_ranking_admin();

  if e.results_released_at is null or not exists(
    select 1 from dm_private.all_india_results r where r.event_id=e.id
  ) then raise exception 'A released cohort is required'; end if;
  if settings.policy_version is null or btrim(settings.policy_version)='' or
    settings.policy_version is distinct from p_policy_version then
    raise exception 'The exact current policy version is required';
  end if;
  if evidence_note is null or char_length(evidence_note) not between 8 and 2000 then
    raise exception 'A publication approval reference is required';
  end if;

  select ranking_revision into privacy_revision from dm_private.launch_gate_attestations
    where gate='privacy_terms' and approved and char_length(btrim(evidence))>=8;
  select ranking_revision into safety_revision from dm_private.launch_gate_attestations
    where gate='child_safety' and approved and char_length(btrim(evidence))>=8;
  if privacy_revision is null or safety_revision is null then
    raise exception 'Privacy and child safety approvals are required';
  end if;

  if pub.id is not null then
    if pub.opened_by=auth.uid() and pub.open_evidence=evidence_note and
       dm_private.active_all_india_ranking_publication(p_event_id)=pub.id then
      return pub.id;
    end if;
    raise exception 'Close the existing ranking publication before requesting a new approval';
  end if;
  if exists(select 1 from dm_private.all_india_ranking_publications
    where event_id=p_event_id and open_evidence=evidence_note) then
    raise exception 'A fresh publication approval reference is required';
  end if;

  insert into dm_private.all_india_ranking_publications(
    event_id,released_at,environment_mode,policy_version,settings_revision,privacy_revision,child_safety_revision,opened_by,open_evidence
  ) values(e.id,e.results_released_at,settings.environment_mode,settings.policy_version,settings.ranking_revision,
    privacy_revision,safety_revision,auth.uid(),evidence_note)
  returning id into pub.id;
  return pub.id;
end $$;

create function public.admin_close_all_india_ranking_publication(p_event_id uuid,p_publication_id uuid,p_evidence text)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  pub dm_private.all_india_ranking_publications;
  evidence_note text:=btrim(p_evidence);
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from auth.users where id=auth.uid() for key share;
  if not found then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from dm_private.all_india_events where id=p_event_id for update;
  select * into pub from dm_private.all_india_ranking_publications
    where id=p_publication_id and event_id=p_event_id for update;
  perform dm_private.require_all_india_ranking_admin();

  if pub.id is null then raise exception 'Ranking publication unavailable'; end if;
  if evidence_note is null or char_length(evidence_note) not between 8 and 2000 then
    raise exception 'A publication closure reference is required';
  end if;
  if pub.closed_at is not null then
    if pub.closed_by=auth.uid() and pub.close_evidence=evidence_note then return; end if;
    raise exception 'Ranking publication already closed';
  end if;
  update dm_private.all_india_ranking_publications
    set closed_at=clock_timestamp(),closed_by=auth.uid(),close_evidence=evidence_note where id=pub.id;
end $$;

create function public.set_all_india_result_sharing(p_event_id uuid,p_publication_id uuid,p_expected_revision integer,p_shared boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  actor uuid:=auth.uid();
  result dm_private.all_india_results;
  consent dm_private.all_india_ranking_consents;
  current_revision integer;
begin
  if actor is null then raise exception 'Confirmed account required' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_shared is null then
    raise exception 'A sharing choice and current revision are required';
  end if;
  perform 1 from auth.users where id=actor and email_confirmed_at is not null and not is_anonymous for share;
  if not found then raise exception 'Confirmed account required' using errcode='42501'; end if;
  -- Match the operator lock order. The owned result serializes even the first
  -- consent write, when there is no consent row to lock.
  perform 1 from dm_private.all_india_events where id=p_event_id and results_released_at is not null for share;
  if not found then raise exception 'Ranking sharing unavailable'; end if;
  perform 1 from public.launch_settings where singleton for share;
  perform 1 from dm_private.launch_gate_attestations
    where gate in ('privacy_terms','child_safety') order by gate for share;
  select r.* into result from dm_private.all_india_results r
  join dm_private.all_india_attempts ai on ai.event_id=r.event_id and ai.user_id=r.user_id and ai.attempt_id=r.attempt_id
  where r.event_id=p_event_id and r.user_id=actor for update of r;
  if not found or not exists(select 1 from dm_private.all_india_ranking_top_ten(p_event_id) t where t.attempt_id=result.attempt_id) then
    raise exception 'Ranking sharing unavailable' using errcode='42501';
  end if;
  if p_publication_id is null or
    dm_private.active_all_india_ranking_publication(p_event_id) is distinct from p_publication_id then
    raise exception 'Ranking sharing unavailable';
  end if;
  select * into consent from dm_private.all_india_ranking_consents
    where publication_id=p_publication_id and user_id=actor for update;

  current_revision:=coalesce(consent.revision,0);
  if current_revision<>p_expected_revision then
    raise exception 'Sharing choice changed; reload and try again' using errcode='40001';
  end if;
  if coalesce(consent.shared,false) is distinct from p_shared then
    insert into dm_private.all_india_ranking_consents(publication_id,event_id,user_id,revision,shared)
      values(p_publication_id,p_event_id,actor,current_revision+1,p_shared)
    on conflict(publication_id,user_id) do update
      set revision=excluded.revision,shared=excluded.shared,changed_at=excluded.changed_at
    returning revision into current_revision;
  end if;
  return jsonb_build_object('publicationId',p_publication_id,'revision',current_revision,'shared',p_shared,'alias',result.alias);
end $$;

create or replace function public.public_all_india_top_ten()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sharingVersion',1,'eventId',visible.id,'exam',visible.exam,'title',visible.title,'releasedAt',visible.results_released_at,'topTen',visible.top_ten
  ) order by visible.results_released_at desc,visible.id),'[]')
  from (
    select e.id,e.exam,e.title,e.results_released_at,ranking.top_ten
    from dm_private.all_india_ranking_publications pub
    join dm_private.all_india_events e on e.id=pub.event_id
    cross join lateral (
      select jsonb_agg(jsonb_build_object('rank',r.rank,'alias',r.alias,'score',r.score,'total',r.total)
        order by r.rank,r.alias,r.attempt_id) as top_ten
      from dm_private.all_india_ranking_top_ten(e.id) r
      join dm_private.all_india_ranking_consents c on c.publication_id=pub.id and c.user_id=r.user_id and c.shared
    ) ranking
    where pub.closed_at is null and pub.id=dm_private.active_all_india_ranking_publication(e.id)
      and ranking.top_ten is not null
    order by e.results_released_at desc,e.id limit 8
  ) visible
$$;

create or replace function public.all_india_event_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'lastStartAt',timing.last_start,
    'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'uploadGraceSeconds',p.upload_grace_seconds,
    'qualityHeld',dm_private.paper_quality_held(p.id),
    'state',case when e.results_released_at is not null then 'released' when now()<e.starts_at then 'scheduled'
      when now()<timing.last_start and dm_private.paper_quality_held(p.id) then 'paused'
      when now()<timing.last_start then 'open' when now()<e.ends_at then 'closing' else 'review' end,
    'attemptId',ai.attempt_id,
    'result',case when r.attempt_id is not null and e.results_released_at is not null then
      jsonb_build_object('score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias,
        'cohortSize',(select count(*) from dm_private.all_india_results s where s.event_id=e.id),
        'sharing',case when sharing.publication_id is not null and exists(
          select 1 from dm_private.all_india_ranking_top_ten(e.id) t where t.attempt_id=r.attempt_id
        ) then jsonb_build_object('publicationId',sharing.publication_id,'revision',coalesce(c.revision,0),
          'shared',coalesce(c.shared,false),'alias',r.alias) end) end
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e join dm_private.papers p on p.id=e.paper_id
  cross join lateral(select e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds) as last_start) timing
  left join dm_private.all_india_attempts ai on ai.event_id=e.id and ai.user_id=auth.uid()
  left join dm_private.all_india_results r on r.event_id=e.id and r.user_id=ai.user_id and r.attempt_id=ai.attempt_id
  left join lateral (
    select dm_private.active_all_india_ranking_publication(e.id) as publication_id
    where r.attempt_id is not null and e.results_released_at is not null and exists(
      select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous
    )
  ) sharing on true
  left join dm_private.all_india_ranking_consents c on c.publication_id=sharing.publication_id and c.user_id=r.user_id
  where e.starts_at>now()-interval '90 days');
end $$;

comment on function public.admin_open_all_india_ranking_publication(uuid,text,text) is
  'Open consent for one released cohort with an audited approval reference and the exact current mode, policy and gate revisions. Exact active retries return the same publication ID. Close stale publications before reopening with a fresh approval reference.';
comment on function public.admin_close_all_india_ranking_publication(uuid,uuid,text) is
  'Close only the named publication for the event; exact retries by its closing operator are safe even after another publication opens.';
comment on function public.set_all_india_result_sharing(uuid,uuid,integer,boolean) is
  'Set explicit, revocable sharing on an owned eligible result in the named active publication. Use the revision from all_india_event_catalog; new publications start unshared at revision zero.';

revoke all on function dm_private.rotate_all_india_ranking_scope(),dm_private.active_all_india_ranking_publication(uuid),
  dm_private.all_india_ranking_top_ten(uuid),dm_private.require_all_india_ranking_admin() from public,anon,authenticated,service_role;
revoke all on function public.admin_open_all_india_ranking_publication(uuid,text,text),
  public.admin_close_all_india_ranking_publication(uuid,uuid,text),
  public.set_all_india_result_sharing(uuid,uuid,integer,boolean) from public,anon,authenticated,service_role;
-- On an existing paid MVP installation, a migration alone must neither
-- expose a deferred endpoint nor invalidate the installed allowlist.
do $$begin
  if to_regclass('dm_private.mvp_rpc_allowlist') is null then
    grant execute on function public.admin_open_all_india_ranking_publication(uuid,text,text),
      public.admin_close_all_india_ranking_publication(uuid,uuid,text),
      public.set_all_india_result_sharing(uuid,uuid,integer,boolean) to authenticated;
  end if;
end $$;

commit;
