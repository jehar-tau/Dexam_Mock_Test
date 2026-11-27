-- Owner's go-to-market plan, 28 November 2026.
-- Runs after 202611280196_fixed_all_india_papers.sql; All India entry stays free.
-- * The annual pass is Rs 1,284 (128400 paise) for 12 months.
-- * A Duo pass (Rs 2,142, 214200 paise) gives the payer a pass on the signed
--   payment.captured event and a one-time invite, valid 30 days, that gives
--   one friend their own 12-month pass.
-- * Free accounts get a taste of every part; the server enforces the limits:
--   worked solutions for the first 5 questions of a paper, one 10-question
--   topic practice session a day, the first theory lesson of each topic.
--   Teacher drawing marking is for pass holders, 4 drawings a month.
-- Earlier migrations are unchanged. Functions are wrapped, not rewritten.
begin;

-- Plans ---------------------------------------------------------------------
alter table public.plans drop constraint if exists plans_id_check;
alter table public.plans drop constraint if exists plans_amount_check;
alter table public.plans add column seats integer not null default 1;
update public.plans set amount=128400 where id='annual';
insert into public.plans(id,title,amount,currency,duration_months,seats)
  values('duo','DMocks Duo pass',214200,'INR',12,2);
alter table public.plans add constraint plans_catalogue_check check(
  (id='annual' and amount=128400 and seats=1) or (id='duo' and amount=214200 and seats=2));

-- One pass row per student. A Duo order backs two passes: the payer's and
-- the friend's, so an order no longer maps to exactly one pass.
alter table dm_private.passes drop constraint if exists passes_order_id_key;
alter table dm_private.passes add column grant_kind text not null default 'purchase'
  check(grant_kind in('purchase','duo_invite'));
create index passes_order_idx on dm_private.passes(order_id);

create function dm_private.has_active_pass(p_user uuid) returns boolean
language sql volatile security definer set search_path=pg_catalog,public,dm_private as $$
  select p_user is not null and exists(
    select 1 from dm_private.passes p join public.launch_settings s on s.singleton and s.environment_mode=p.mode
    where p.user_id=p_user and p.revoked_at is null and p.expires_at>clock_timestamp())
$$;
revoke all on function dm_private.has_active_pass(uuid) from public,anon,authenticated,service_role;

-- The browser checks the payment mode of the pass it reads.
create or replace function public.my_pass() returns jsonb
language sql volatile security definer set search_path=pg_catalog,public,dm_private as $$
  select jsonb_build_object('active',coalesce(p.revoked_at is null and p.expires_at>clock_timestamp() and p.mode=s.environment_mode,false),
    'expiresAt',p.expires_at,'revoked',p.revoked_at is not null,'mode',s.environment_mode,'kind',p.grant_kind)
  from public.launch_settings s left join dm_private.passes p on p.user_id=auth.uid() where s.singleton
$$;

-- Orders --------------------------------------------------------------------
create function public.prepare_plan_order(p_plan text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare settings public.launch_settings; plan public.plans; existing dm_private.orders;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_plan is null or p_plan not in('annual','duo') then raise exception 'Unknown plan'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into settings from public.launch_settings where singleton;
  if not settings.sales_enabled or settings.policy_version is null then raise exception 'Paid access is not open'; end if;
  if not exists(select 1 from public.profiles where user_id=auth.uid() and terms_version=settings.policy_version and accepted_at is not null) then
    raise exception 'Accept current terms first';
  end if;
  if dm_private.has_active_pass(auth.uid()) then raise exception 'Your annual pass is already active'; end if;
  if exists(select 1 from dm_private.orders where user_id=auth.uid() and mode=settings.environment_mode and payment_review_required) then
    raise exception 'This payment needs team review before another checkout';
  end if;
  select * into plan from public.plans where id=p_plan;
  -- A pending order is reused only for the same plan at today's price.
  select * into existing from dm_private.orders where user_id=auth.uid() and status='pending' and mode=settings.environment_mode
    and plan_id=plan.id and amount=plan.amount and currency=plan.currency order by created_at desc limit 1;
  if existing.id is null then
    insert into dm_private.orders(user_id,plan_id,amount,currency,mode)
      values(auth.uid(),plan.id,plan.amount,plan.currency,settings.environment_mode) returning * into existing;
  end if;
  return jsonb_build_object('id',existing.id,'plan',existing.plan_id,'amount',existing.amount,'currency',existing.currency,
    'mode',existing.mode,'providerOrderId',existing.provider_order_id);
end $$;
revoke all on function public.prepare_plan_order(text) from public,anon;
grant execute on function public.prepare_plan_order(text) to authenticated;

-- The original no-argument call keeps working and buys the annual pass.
create or replace function public.prepare_order() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
begin
  return public.prepare_plan_order('annual');
end $$;

-- Duo invites ---------------------------------------------------------------
create table dm_private.duo_invites(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references dm_private.orders(id),
  payer_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check(token~'^[0-9a-f]{64}$'),
  mode text not null check(mode in('test','live')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  check(expires_at>created_at),
  check(redeemed_by is null or redeemed_at is not null),
  check(redeemed_by is distinct from payer_id)
);
alter table dm_private.duo_invites enable row level security;
revoke all on dm_private.duo_invites from public,anon,authenticated,service_role;

alter function public.fulfil_verified_payment(text,text,text,integer,text) set schema dm_private;
alter function dm_private.fulfil_verified_payment(text,text,text,integer,text) rename to fulfil_verified_payment_before_duo;
revoke all on function dm_private.fulfil_verified_payment_before_duo(text,text,text,integer,text) from public,anon,authenticated,service_role;

create function public.fulfil_verified_payment(p_event_id text,p_provider_order text,p_payment_id text,p_amount integer,p_currency text)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare purchase dm_private.orders;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  perform dm_private.fulfil_verified_payment_before_duo(p_event_id,p_provider_order,p_payment_id,p_amount,p_currency);
  select * into purchase from dm_private.orders where provider_order_id=p_provider_order;
  -- Only a granted Duo payment opens an invite; a held or refunded one does not.
  if purchase.plan_id='duo' and purchase.status='paid' and not purchase.payment_review_required
    and exists(select 1 from dm_private.passes where user_id=purchase.user_id and order_id=purchase.id and revoked_at is null) then
    insert into dm_private.duo_invites(order_id,payer_id,token,mode,expires_at)
      values(purchase.id,purchase.user_id,
        replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
        purchase.mode,purchase.paid_at+interval '30 days')
      on conflict(order_id) do nothing;
  end if;
end $$;
revoke all on function public.fulfil_verified_payment(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.fulfil_verified_payment(text,text,text,integer,text) to service_role;

-- A full refund of a Duo order also ends the friend's pass and any open invite.
create function dm_private.revoke_duo_on_refund() returns trigger
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare stamp timestamptz:=clock_timestamp();
begin
  if new.status='refunded' and old.status is distinct from 'refunded' then
    update dm_private.passes set revoked_at=coalesce(revoked_at,stamp),
      expires_at=greatest(starts_at+interval '1 microsecond',least(expires_at,stamp))
      where order_id=new.id and grant_kind='duo_invite';
    update dm_private.duo_invites set revoked_at=coalesce(revoked_at,stamp) where order_id=new.id;
  end if;
  return new;
end $$;
revoke all on function dm_private.revoke_duo_on_refund() from public,anon,authenticated,service_role;
create trigger orders_duo_refund after update of status on dm_private.orders
  for each row execute function dm_private.revoke_duo_on_refund();

create function public.my_duo_invite() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,dm_private as $$
declare invite dm_private.duo_invites; current_mode text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select environment_mode into current_mode from public.launch_settings where singleton;
  select * into invite from dm_private.duo_invites where payer_id=auth.uid() and mode=current_mode order by created_at desc limit 1;
  if invite.id is null then return jsonb_build_object('status','none'); end if;
  return jsonb_build_object(
    'status',case when invite.redeemed_at is not null then 'redeemed' when invite.revoked_at is not null then 'revoked'
      when invite.expires_at<=clock_timestamp() then 'expired' else 'open' end,
    'token',case when invite.redeemed_at is null and invite.revoked_at is null and invite.expires_at>clock_timestamp() then invite.token end,
    'expiresAt',invite.expires_at,'redeemedAt',invite.redeemed_at);
end $$;
revoke all on function public.my_duo_invite() from public,anon;
grant execute on function public.my_duo_invite() to authenticated;

create function public.redeem_duo_invite(p_token text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare invite dm_private.duo_invites; purchase dm_private.orders; current_mode text; student uuid:=auth.uid(); stamp timestamptz;
begin
  if student is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if not exists(select 1 from auth.users u where u.id=student and u.raw_app_meta_data->>'provider'='google'
      and coalesce(u.is_anonymous,false)=false) then
    raise exception 'Sign in with Google to claim this pass' using errcode='42501', hint='dmocks_duo_google';
  end if;
  if p_token is null or p_token!~'^[0-9a-f]{64}$' then
    raise exception 'This invite link is not valid' using errcode='22023', hint='dmocks_duo_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(student::text,0));
  select * into invite from dm_private.duo_invites where token=p_token for update;
  if invite.id is null then raise exception 'This invite link is not valid' using errcode='22023', hint='dmocks_duo_invalid'; end if;
  select environment_mode into current_mode from public.launch_settings where singleton;
  stamp:=clock_timestamp();
  if invite.payer_id=student then
    raise exception 'This invite is for your friend. Your own pass is already active.' using errcode='42501', hint='dmocks_duo_payer';
  end if;
  if invite.redeemed_at is not null then
    raise exception 'This invite has already been used' using errcode='55000', hint='dmocks_duo_used';
  end if;
  select * into purchase from dm_private.orders where id=invite.order_id;
  if invite.revoked_at is not null or invite.mode is distinct from current_mode or purchase.status is distinct from 'paid'
    or purchase.payment_review_required then
    raise exception 'This invite is no longer available' using errcode='55000', hint='dmocks_duo_unavailable';
  end if;
  if invite.expires_at<=stamp then
    raise exception 'This invite has expired' using errcode='55000', hint='dmocks_duo_expired';
  end if;
  if dm_private.has_active_pass(student) then
    raise exception 'You already have an active pass' using errcode='55000', hint='dmocks_duo_has_pass';
  end if;
  update dm_private.duo_invites set redeemed_by=student,redeemed_at=stamp where id=invite.id;
  insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at,revoked_at,grant_kind)
    values(student,invite.order_id,invite.mode,stamp,stamp+interval '12 months',null,'duo_invite')
    on conflict(user_id) do update set order_id=excluded.order_id,mode=excluded.mode,starts_at=excluded.starts_at,
      expires_at=excluded.expires_at,revoked_at=null,grant_kind=excluded.grant_kind;
  return jsonb_build_object('active',true,'expiresAt',stamp+interval '12 months');
end $$;
revoke all on function public.redeem_duo_invite(text) from public,anon;
grant execute on function public.redeem_duo_invite(text) to authenticated;

-- Worked solutions: the first 5 questions of a paper without a pass -------------
create table dm_private.drawing_review_holds(
  attempt_id uuid not null references dm_private.attempts(id) on delete cascade,
  question_id uuid not null,
  student_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check(reason in('pass_required','monthly_limit')),
  held_at timestamptz not null default clock_timestamp(),
  primary key(attempt_id,question_id)
);
alter table dm_private.drawing_review_holds enable row level security;
revoke all on dm_private.drawing_review_holds from public,anon,authenticated,service_role;

alter function public.read_attempt(uuid) set schema dm_private;
alter function dm_private.read_attempt(uuid) rename to read_attempt_before_pass_split;
revoke all on function dm_private.read_attempt_before_pass_split(uuid) from public,anon,authenticated,service_role;

create function public.read_attempt(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare result jsonb; questions jsonb; locked integer; paid boolean;
begin
  result:=dm_private.read_attempt_before_pass_split(p_id);
  paid:=dm_private.has_active_pass(auth.uid());
  if result->>'status' is distinct from 'submitted' or jsonb_typeof(result->'questions') is distinct from 'array' then
    return result||jsonb_build_object('lockedSolutions',0,'passActive',paid);
  end if;
  select coalesce(jsonb_agg(
      case when not paid and n>5 and q->>'kind' is distinct from 'drawing' and jsonb_typeof(q->'explanation')='string'
        then q||jsonb_build_object('explanation',null,'solutionLocked',true) else q end
      ||case when q->'drawingReview'->>'status'='not_submitted' and h.reason is not null
        then jsonb_build_object('drawingReview',jsonb_build_object('status',h.reason)) else '{}'::jsonb end
      order by n),'[]'::jsonb),
    count(*) filter(where not paid and n>5 and q->>'kind' is distinct from 'drawing' and jsonb_typeof(q->'explanation')='string')
    into questions,locked
  from jsonb_array_elements(result->'questions') with ordinality items(q,n)
  left join dm_private.drawing_review_holds h on h.attempt_id=p_id and h.question_id::text=q->>'id';
  return result||jsonb_build_object('questions',questions,'lockedSolutions',locked,'passActive',paid);
end $$;
revoke all on function public.read_attempt(uuid) from public,anon;
grant execute on function public.read_attempt(uuid) to authenticated;

-- Topic practice: one 10-question session a day without a pass ----------------
alter function public.start_topic_practice(text,text,integer,integer) set schema dm_private;
alter function dm_private.start_topic_practice(text,text,integer,integer) rename to start_topic_practice_before_pass_split;
revoke all on function dm_private.start_topic_practice_before_pass_split(text,text,integer,integer) from public,anon,authenticated,service_role;

create function public.start_topic_practice(p_topic text,p_exam text,p_count integer,p_duration_seconds integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare student uuid:=auth.uid(); today date; created uuid;
begin
  if student is null then raise exception 'Sign in required'; end if;
  -- The same lock as the practice start, so two tabs cannot both take today's session.
  perform pg_advisory_xact_lock(hashtextextended(student::text,1));
  -- The original start keeps its own checks and messages first. A free-limit
  -- error below rolls back the session it has just prepared.
  created:=dm_private.start_topic_practice_before_pass_split(p_topic,p_exam,p_count,p_duration_seconds);
  if not dm_private.has_active_pass(student) then
    if p_count is distinct from 10 then
      raise exception 'Free topic practice sessions have 10 questions' using errcode='P0001', hint='dmocks_free_practice_length';
    end if;
    today:=(clock_timestamp() at time zone 'Asia/Kolkata')::date;
    if exists(select 1 from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
        where a.user_id=student and a.id<>created and p.source_kind='topic' and p.owner_user_id=student
          and a.started_at>=(today::timestamp at time zone 'Asia/Kolkata')) then
      raise exception 'Free accounts include one topic practice session a day' using errcode='P0001', hint='dmocks_free_daily_practice';
    end if;
  end if;
  return created;
end $$;
revoke all on function public.start_topic_practice(text,text,integer,integer) from public,anon;
grant execute on function public.start_topic_practice(text,text,integer,integer) to authenticated;

-- Teacher drawing marking: pass holders, 4 drawings a month ---------------------
-- All India drawings are part of the national ranking and are always marked.
alter table dm_private.drawing_reviews add column queued_at timestamptz;
alter table dm_private.drawing_reviews alter column queued_at set default clock_timestamp();

create function dm_private.gate_drawing_review() returns trigger
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare student uuid; month_start timestamptz; used integer; reason text;
begin
  select user_id into student from dm_private.attempts where id=new.attempt_id;
  if student is null or exists(select 1 from dm_private.all_india_attempts where attempt_id=new.attempt_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-drawing-marking:'||student::text,0));
  if not dm_private.has_active_pass(student) then
    reason:='pass_required';
  else
    month_start:=date_trunc('month',clock_timestamp() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
    select count(*) into used from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
      where a.user_id=student and r.queued_at>=month_start
        and not exists(select 1 from dm_private.all_india_attempts ai where ai.attempt_id=r.attempt_id);
    if used>=4 then reason:='monthly_limit'; end if;
  end if;
  if reason is null then
    delete from dm_private.drawing_review_holds where attempt_id=new.attempt_id and question_id=new.question_id;
    return new;
  end if;
  insert into dm_private.drawing_review_holds(attempt_id,question_id,student_id,reason)
    values(new.attempt_id,new.question_id,student,reason)
    on conflict(attempt_id,question_id) do update set reason=excluded.reason,held_at=excluded.held_at;
  return null;
end $$;
revoke all on function dm_private.gate_drawing_review() from public,anon,authenticated,service_role;
create trigger drawing_reviews_pass_gate before insert on dm_private.drawing_reviews
  for each row execute function dm_private.gate_drawing_review();

create function public.my_drawing_marking_allowance() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,dm_private as $$
declare student uuid:=auth.uid(); month_start timestamptz; used integer:=0; paid boolean;
begin
  if student is null then raise exception 'Sign in required'; end if;
  paid:=dm_private.has_active_pass(student);
  month_start:=date_trunc('month',clock_timestamp() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  if paid then
    select count(*) into used from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
      where a.user_id=student and r.queued_at>=month_start
        and not exists(select 1 from dm_private.all_india_attempts ai where ai.attempt_id=r.attempt_id);
  end if;
  return jsonb_build_object('passActive',paid,'monthlyLimit',4,'used',used,'remaining',case when paid then greatest(4-used,0) else 0 end);
end $$;
revoke all on function public.my_drawing_marking_allowance() from public,anon;
grant execute on function public.my_drawing_marking_allowance() to authenticated;

-- Theory lessons: the first lesson of each topic is free -----------------------
create function dm_private.learning_lesson_locked(p_user uuid,p_lesson dm_private.learning_lessons) returns boolean
language sql volatile security definer set search_path=pg_catalog,dm_private as $$
  select not dm_private.has_active_pass(p_user) and exists(
    select 1 from dm_private.learning_lessons o
    where o.exam=p_lesson.exam and o.topic=p_lesson.topic and o.published and o.rights_confirmed and o.ordinal<p_lesson.ordinal)
$$;
revoke all on function dm_private.learning_lesson_locked(uuid,dm_private.learning_lessons) from public,anon,authenticated,service_role;

create or replace function public.learning_catalog() returns jsonb
language sql volatile security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'slug',l.slug,'exam',l.exam,'topic',l.topic,'title',l.title,'summary',l.summary,
    'completed',p.lesson_id is not null,'locked',dm_private.learning_lesson_locked(auth.uid(),l)) order by l.exam,l.topic,l.ordinal),'[]')
  from dm_private.learning_lessons l left join dm_private.learning_progress p on p.lesson_id=l.id and p.user_id=auth.uid()
  where auth.uid() is not null and l.published and l.rights_confirmed
$$;

create or replace function public.read_learning_lesson(p_slug text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,dm_private as $$
declare lesson dm_private.learning_lessons; v jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into lesson from dm_private.learning_lessons l where l.slug=p_slug and l.published and l.rights_confirmed;
  if lesson.id is null then raise exception 'Lesson not found'; end if;
  if dm_private.learning_lesson_locked(auth.uid(),lesson) then
    raise exception 'This lesson comes with the pass' using errcode='42501', hint='dmocks_pass_required';
  end if;
  select jsonb_build_object('id',lesson.id,'slug',lesson.slug,'exam',lesson.exam,'topic',lesson.topic,'title',lesson.title,
    'summary',lesson.summary,'body',lesson.body,'completed',exists(select 1 from dm_private.learning_progress p
      where p.lesson_id=lesson.id and p.user_id=auth.uid())) into v;
  return v;
end $$;
revoke all on function public.learning_catalog(),public.read_learning_lesson(text) from public,anon;
grant execute on function public.learning_catalog(),public.read_learning_lesson(text) to authenticated;
commit;
