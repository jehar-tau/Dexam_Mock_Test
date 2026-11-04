-- NEW DesignMocks project only. No Dexam identities, fixtures or credentials.
begin;
create schema if not exists dm_private;
revoke all on schema dm_private from public, anon, authenticated;

create table public.launch_settings (
  singleton boolean primary key default true check(singleton),
  sales_enabled boolean not null default false,
  environment_mode text not null default 'test' check(environment_mode in ('test','live')),
  policy_version text,
  updated_at timestamptz not null default now()
);
insert into public.launch_settings(singleton) values(true);
alter table public.launch_settings enable row level security;
revoke all on public.launch_settings from anon,authenticated;

create table public.plans (
  id text primary key check(id='annual'),
  title text not null,
  amount integer not null check(amount=119300),
  currency text not null default 'INR' check(currency='INR'),
  duration_months integer not null default 12 check(duration_months=12)
);
insert into public.plans values('annual','DesignMocks annual pass',119300,'INR',12);
alter table public.plans enable row level security;
create policy plan_read on public.plans for select to anon,authenticated using(true);
grant select on public.plans to anon,authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profile_self on public.profiles for select to authenticated using(user_id=auth.uid());
grant select on public.profiles to authenticated;

create table dm_private.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount integer not null,
  currency text not null,
  mode text not null check(mode in ('test','live')),
  provider_order_id text unique,
  payment_id text unique,
  status text not null default 'pending' check(status in ('pending','paid','refunded')),
  created_at timestamptz not null default now(), paid_at timestamptz
);
create table dm_private.payment_events (
  event_id text primary key,
  order_id uuid not null references dm_private.orders(id),
  processed_at timestamptz not null default now()
);
create table dm_private.passes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  order_id uuid not null unique references dm_private.orders(id),
  mode text not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>starts_at)
);

create or replace function public.accept_current_terms(p_version text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare active_version text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select policy_version into active_version from public.launch_settings where singleton;
  if active_version is null or p_version is distinct from active_version then raise exception 'Published terms are not ready'; end if;
  insert into public.profiles(user_id,terms_version,accepted_at) values(auth.uid(),p_version,now())
  on conflict(user_id) do update set terms_version=excluded.terms_version,accepted_at=excluded.accepted_at;
end $$;

create or replace function public.my_pass() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('active',coalesce(p.expires_at>now() and p.mode=s.environment_mode,false),'expiresAt',p.expires_at)
from public.launch_settings s left join dm_private.passes p on p.user_id=auth.uid() where s.singleton;
$$;

create or replace function public.prepare_order() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare settings public.launch_settings; plan public.plans; existing dm_private.orders;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into settings from public.launch_settings where singleton;
  if not settings.sales_enabled or settings.policy_version is null then raise exception 'Paid access is not open'; end if;
  if not exists(select 1 from public.profiles where user_id=auth.uid() and terms_version=settings.policy_version and accepted_at is not null) then raise exception 'Accept current terms first'; end if;
  if exists(select 1 from dm_private.passes where user_id=auth.uid() and mode=settings.environment_mode and expires_at>now()) then raise exception 'Your annual pass is already active'; end if;
  select * into plan from public.plans where id='annual';
  select * into existing from dm_private.orders where user_id=auth.uid() and status='pending' and mode=settings.environment_mode order by created_at desc limit 1;
  if existing.id is null then
    insert into dm_private.orders(user_id,plan_id,amount,currency,mode) values(auth.uid(),plan.id,plan.amount,plan.currency,settings.environment_mode) returning * into existing;
  end if;
  return jsonb_build_object('id',existing.id,'amount',existing.amount,'currency',existing.currency,'mode',existing.mode,'providerOrderId',existing.provider_order_id);
end $$;

create or replace function public.attach_provider_order(p_id uuid,p_provider_id text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare saved text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_provider_id is null or p_provider_id !~ '^order_[A-Za-z0-9]+$' then raise exception 'Invalid provider order'; end if;
  update dm_private.orders set provider_order_id=p_provider_id where id=p_id and status='pending' and provider_order_id is null;
  select provider_order_id into saved from dm_private.orders where id=p_id;
  if saved is null then raise exception 'Order unavailable'; end if;
  return saved;
end $$;

create or replace function public.fulfil_verified_payment(p_event_id text,p_provider_order text,p_payment_id text,p_amount integer,p_currency text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare purchase dm_private.orders; stamp timestamptz:=now();
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_event_id is null or length(p_event_id) not between 1 and 200 or p_payment_id is null or p_payment_id !~ '^pay_[A-Za-z0-9]+$' then raise exception 'Invalid payment event'; end if;
  select * into purchase from dm_private.orders where provider_order_id=p_provider_order for update;
  if purchase.id is null then raise exception 'Unknown order'; end if;
  if purchase.amount is distinct from p_amount or purchase.currency is distinct from p_currency then raise exception 'Payment amount or currency mismatch'; end if;
  if purchase.status='refunded' then raise exception 'Order refunded'; end if;
  if exists(select 1 from dm_private.payment_events where event_id=p_event_id) then return; end if;
  insert into dm_private.payment_events(event_id,order_id) values(p_event_id,purchase.id);
  if purchase.status='paid' then return; end if;
  update dm_private.orders set status='paid',payment_id=p_payment_id,paid_at=stamp where id=purchase.id;
  insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
  values(purchase.user_id,purchase.id,purchase.mode,stamp,stamp+interval '12 months')
  on conflict(user_id) do update set order_id=excluded.order_id,mode=excluded.mode,starts_at=excluded.starts_at,expires_at=excluded.expires_at;
end $$;

-- Reviewed bank and answer keys never go in the browser bundle.
-- Deterministic grading adapted from the owner-controlled Dexam F044 engine.
create function dm_private.score_response(
  p_type text,
  p_key jsonb,
  p_response jsonb,
  p_marking jsonb
)
returns table (outcome text, marks numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_correct numeric := (p_marking ->> 'correct')::numeric;
  v_wrong numeric := (p_marking ->> 'wrong')::numeric;
  v_partial boolean := coalesce((p_marking ->> 'partial')::boolean, false);
  v_kind text := p_key ->> 'kind';
  v_chosen text[];
  v_set text[];
  v_best_marks numeric;
  v_best_outcome text;
  v_value numeric;
  v_accepted jsonb;
begin
  if p_type = 'drawing' then
    return query select 'self_review'::text, 0::numeric;
    return;
  end if;
  if p_key is null or v_kind = 'dropped' then
    return query select 'dropped'::text, 0::numeric;
    return;
  end if;
  if v_kind = 'full_marks' then
    return query select 'full_marks'::text, v_correct;
    return;
  end if;
  if p_response is null
    or p_response = 'null'::jsonb
    or (jsonb_typeof(p_response) = 'string' and btrim(p_response #>> '{}') = '')
    or (jsonb_typeof(p_response) = 'array' and jsonb_array_length(p_response) = 0) then
    return query select 'unanswered'::text, 0::numeric;
    return;
  end if;

  if p_type = 'mcq' then
    if jsonb_typeof(p_response) = 'string' and (p_key -> 'correct') ? (p_response #>> '{}') then
      return query select 'correct'::text, v_correct;
    else
      return query select 'wrong'::text, v_wrong;
    end if;
    return;
  end if;

  if p_type = 'msq' then
    if jsonb_typeof(p_response) <> 'array' then
      return query select 'wrong'::text, v_wrong;
      return;
    end if;
    select coalesce(array_agg(distinct value order by value), '{}')
      into v_chosen
      from jsonb_array_elements_text(p_response) as value;
    v_best_marks := v_wrong;
    v_best_outcome := 'wrong';
    for v_set in
      select array(select jsonb_array_elements_text(candidate) order by 1)
      from jsonb_array_elements(
        case when p_key ? 'correct' then jsonb_build_array(p_key -> 'correct') else p_key -> 'alternatives' end
      ) as candidate
    loop
      if v_chosen = v_set then
        v_best_marks := v_correct;
        v_best_outcome := 'correct';
        exit;
      elsif v_partial and v_chosen <@ v_set and cardinality(v_chosen) < cardinality(v_set)
        and cardinality(v_chosen) > v_best_marks then
        v_best_marks := cardinality(v_chosen);
        v_best_outcome := 'partial';
      end if;
    end loop;
    return query select v_best_outcome, v_best_marks;
    return;
  end if;

  -- NAT
  if jsonb_typeof(p_response) <> 'string' or (p_response #>> '{}') !~ '^\s*-?\d+(\.\d+)?\s*$' then
    return query select 'wrong'::text, v_wrong;
    return;
  end if;
  v_value := btrim(p_response #>> '{}')::numeric;
  for v_accepted in select * from jsonb_array_elements(p_key -> 'accepted') loop
    if (v_accepted ? 'exact' and v_value = (v_accepted ->> 'exact')::numeric)
      or (v_accepted ? 'range'
        and v_value between (v_accepted -> 'range' ->> 0)::numeric and (v_accepted -> 'range' ->> 1)::numeric) then
      return query select 'correct'::text, v_correct;
      return;
    end if;
  end loop;
  return query select 'wrong'::text, v_wrong;
end;
$$;

create table dm_private.papers (
  id uuid primary key default gen_random_uuid(),
  title text not null, exam text not null check(exam in ('uceed','nid','nift','ceed')),
  duration_seconds integer not null check(duration_seconds between 60 and 21600),
  published boolean not null default false,
  reviewed boolean not null default false,
  rights_confirmed boolean not null default false
);
create table dm_private.questions (
  id uuid primary key default gen_random_uuid(),paper_id uuid not null references dm_private.papers(id),
  ordinal integer not null,prompt text not null,options jsonb not null,
  kind text not null default 'mcq' check(kind in ('mcq','msq','nat','drawing')),
  marking jsonb not null default '{"correct":1,"wrong":0}',
  media jsonb not null default '[]',
  points numeric not null check(points>0),negative_points numeric not null default 0 check(negative_points>=0),
  topic text not null,reviewed boolean not null default false,
  unique(paper_id,ordinal)
);
create table dm_private.answer_keys (
  question_id uuid primary key references dm_private.questions(id),key jsonb not null check(jsonb_typeof(key)='object'),explanation text not null
);
create table dm_private.attempts (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
  paper_id uuid not null references dm_private.papers(id),status text not null default 'active' check(status in ('active','submitted')),
  started_at timestamptz not null default now(),deadline timestamptz not null,submitted_at timestamptz,score numeric,total numeric
);
create table dm_private.attempt_items (
  attempt_id uuid not null references dm_private.attempts(id),question_id uuid not null references dm_private.questions(id),
  ordinal integer not null,prompt text not null,options jsonb not null,
  kind text not null default 'mcq' check(kind in ('mcq','msq','nat','drawing')),
  marking jsonb not null default '{"correct":1,"wrong":0}',
  media jsonb not null default '[]',points numeric not null,negative_points numeric not null,topic text not null,
  key jsonb not null,explanation text not null,answer jsonb,
  primary key(attempt_id,question_id)
);
create or replace function public.available_papers() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'exam',exam,'durationSeconds',duration_seconds)),'[]')
from dm_private.papers where published and reviewed and rights_confirmed and auth.uid() is not null;
$$;
create or replace function public.start_attempt(p_paper_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p dm_private.papers; attempt_id uuid; settings_mode text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select environment_mode into settings_mode from public.launch_settings where singleton;
  if not exists(select 1 from dm_private.passes where user_id=auth.uid() and mode=settings_mode and expires_at>now()) then raise exception 'An active pass is required'; end if;
  select * into p from dm_private.papers where id=p_paper_id and published and reviewed and rights_confirmed;
  if p.id is null then raise exception 'Paper is not released'; end if;
  if not exists(select 1 from dm_private.questions where paper_id=p.id) or exists(select 1 from dm_private.questions q left join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id and (not q.reviewed or k.question_id is null or (q.kind in ('mcq','msq') and jsonb_array_length(q.options)<2))) then raise exception 'Paper review is incomplete'; end if;
  select id into attempt_id from dm_private.attempts where user_id=auth.uid() and paper_id=p.id and status='active' and deadline>now() order by started_at desc limit 1;
  if attempt_id is not null then return attempt_id; end if;
  insert into dm_private.attempts(user_id,paper_id,deadline) values(auth.uid(),p.id,now()+make_interval(secs=>p.duration_seconds)) returning id into attempt_id;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
  select attempt_id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id;
  return attempt_id;
end $$;
create or replace function public.read_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a dm_private.attempts; items jsonb;
begin
  select * into a from dm_private.attempts where id=p_id and user_id=auth.uid();
  if a.id is null then raise exception 'Attempt not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',question_id,'ordinal',ordinal,'prompt',prompt,'options',options,'topic',topic,'answer',answer,'points',points,'negativePoints',negative_points,'marking',marking,'kind',kind,'media',media)
    || case when a.status='submitted' then jsonb_build_object('correctKey',key,'explanation',explanation,'outcome',(select outcome from dm_private.score_response(kind,key,answer,marking))) else '{}'::jsonb end order by ordinal),'[]') into items from dm_private.attempt_items where attempt_id=a.id;
  return jsonb_build_object('title',(select title from dm_private.papers where id=a.paper_id),'id',a.id,'status',a.status,'deadline',a.deadline,'serverNow',now(),'score',a.score,'total',a.total,'questions',items);
end $$;
create or replace function public.save_answer(p_attempt_id uuid,p_question_id uuid,p_answer jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a dm_private.attempts; item dm_private.attempt_items; selected text;
begin
  select * into a from dm_private.attempts where id=p_attempt_id and user_id=auth.uid() for update;
  if a.id is null or a.status<>'active' or a.deadline<=now() then raise exception 'Answer window closed'; end if;
  select * into item from dm_private.attempt_items where attempt_id=a.id and question_id=p_question_id;
  if item.question_id is null then raise exception 'Question not in attempt'; end if;
  if p_answer is not null and p_answer<>'null'::jsonb then
    if item.kind='mcq' then
      if jsonb_typeof(p_answer)<>'string' or not exists(select 1 from jsonb_array_elements(item.options) o where o->>'id'=p_answer#>>'{}') then raise exception 'Invalid option'; end if;
    elsif item.kind='msq' then
      if jsonb_typeof(p_answer)<>'array' or jsonb_array_length(p_answer)>10 then raise exception 'Invalid options'; end if;
      for selected in select jsonb_array_elements_text(p_answer) loop
        if not exists(select 1 from jsonb_array_elements(item.options) o where o->>'id'=selected) then raise exception 'Invalid option'; end if;
      end loop;
    elsif item.kind='nat' then
      if jsonb_typeof(p_answer)<>'string' or length(p_answer#>>'{}')>64 or (p_answer#>>'{}') !~ '^\s*-?\d+(\.\d+)?\s*$' then raise exception 'Invalid numeric answer'; end if;
    elsif item.kind='drawing' then
      if jsonb_typeof(p_answer)<>'string' or length(p_answer#>>'{}')>4000 then raise exception 'Invalid self-review note'; end if;
    end if;
  end if;
  update dm_private.attempt_items set answer=p_answer where attempt_id=a.id and question_id=p_question_id;
  if not found then raise exception 'Question not in attempt'; end if;
end $$;
create or replace function public.submit_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a dm_private.attempts;
begin
  select * into a from dm_private.attempts where id=p_id and user_id=auth.uid() for update;
  if a.id is null then raise exception 'Attempt not found'; end if;
  if a.status='active' then
    update dm_private.attempts set status='submitted',submitted_at=now(),
    score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=a.id),
    total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else (marking->>'correct')::numeric end),0) from dm_private.attempt_items where attempt_id=a.id) where id=a.id;
  end if;
  return public.read_attempt(a.id);
end $$;
create or replace function public.my_attempt_history() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',p.title,'status',a.status,'score',a.score,'total',a.total,'startedAt',a.started_at) order by a.started_at desc),'[]')
from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=auth.uid();
$$;

revoke all on all functions in schema dm_private from public,anon,authenticated;
revoke all on all tables in schema dm_private from public,anon,authenticated;
revoke all on function public.attach_provider_order(uuid,text),public.fulfil_verified_payment(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.attach_provider_order(uuid,text),public.fulfil_verified_payment(text,text,text,integer,text) to service_role;
revoke all on function public.accept_current_terms(text),public.my_pass(),public.prepare_order(),public.available_papers(),public.start_attempt(uuid),public.read_attempt(uuid),public.save_answer(uuid,uuid,jsonb),public.submit_attempt(uuid),public.my_attempt_history() from public,anon;
grant execute on function public.accept_current_terms(text),public.my_pass(),public.prepare_order(),public.available_papers(),public.start_attempt(uuid),public.read_attempt(uuid),public.save_answer(uuid,uuid,jsonb),public.submit_attempt(uuid),public.my_attempt_history() to authenticated;
commit;
