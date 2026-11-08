begin;

alter table dm_private.orders add column refunded_amount integer not null default 0 check(refunded_amount>=0 and refunded_amount<=amount),
 add column refunded_at timestamptz,add column payment_review_required boolean not null default false;
alter table dm_private.passes add column revoked_at timestamptz;
alter table dm_private.payment_events add column event_type text not null default 'payment.captured' check(event_type in('payment.captured','refund.processed')),
 add column payment_id text,add column refund_id text,add column request_hash text,add column outcome text not null default 'received';
update dm_private.payment_events e set payment_id=o.payment_id from dm_private.orders o where o.id=e.order_id;
create table dm_private.payment_refunds(
 refund_id text primary key check(refund_id~'^rfnd_[A-Za-z0-9]+$'and char_length(refund_id)<=200),
 order_id uuid not null references dm_private.orders(id),payment_id text not null,
 amount integer not null check(amount>0),currency text not null check(currency='INR'),processed_at timestamptz not null default clock_timestamp()
);
alter table dm_private.payment_refunds enable row level security;
revoke all on dm_private.payment_refunds from public,anon,authenticated,service_role;

-- Event identity and business identity are separate. Historical receipts retain
-- their order/payment binding; every new receipt also binds the complete context.
create function dm_private.commerce_event_once(p_event text,p_order uuid,p_payment text,p_kind text,p_refund text,p_context jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare previous dm_private.payment_events;inserted integer;fingerprint text:=encode(sha256(convert_to(p_context::text,'UTF8')),'hex');
begin
 insert into dm_private.payment_events(event_id,order_id,payment_id,event_type,refund_id,request_hash)
 values(p_event,p_order,p_payment,p_kind,p_refund,fingerprint)on conflict(event_id)do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then return true;end if;
 select *into previous from dm_private.payment_events where event_id=p_event;
 if previous.order_id is distinct from p_order or previous.payment_id is distinct from p_payment or previous.event_type is distinct from p_kind
  or previous.refund_id is distinct from p_refund or(previous.request_hash is not null and previous.request_hash<>fingerprint)then
  raise exception 'Payment event identity mismatch';
 end if;
 return false;
end$$;
revoke all on function dm_private.commerce_event_once(text,uuid,text,text,text,jsonb)from public,anon,authenticated,service_role;

create or replace function public.my_pass()returns jsonb language sql volatile security definer set search_path=pg_catalog,public,dm_private as $$
 select jsonb_build_object('active',coalesce(p.revoked_at is null and p.expires_at>clock_timestamp()and p.mode=s.environment_mode,false),
 'expiresAt',p.expires_at,'revoked',p.revoked_at is not null)
 from public.launch_settings s left join dm_private.passes p on p.user_id=auth.uid()where s.singleton
$$;

create or replace function public.prepare_order()returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare settings public.launch_settings;plan public.plans;existing dm_private.orders;
begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select *into settings from public.launch_settings where singleton;
 if not settings.sales_enabled or settings.policy_version is null then raise exception 'Paid access is not open';end if;
 if not exists(select 1 from public.profiles where user_id=auth.uid()and terms_version=settings.policy_version and accepted_at is not null)then raise exception 'Accept current terms first';end if;
 if exists(select 1 from dm_private.passes where user_id=auth.uid()and mode=settings.environment_mode and revoked_at is null and expires_at>clock_timestamp())then raise exception 'Your annual pass is already active';end if;
 if exists(select 1 from dm_private.orders where user_id=auth.uid()and mode=settings.environment_mode and payment_review_required)then raise exception 'This payment needs team review before another checkout';end if;
 select *into plan from public.plans where id='annual';
 select *into existing from dm_private.orders where user_id=auth.uid()and status='pending'and mode=settings.environment_mode order by created_at desc limit 1;
 if existing.id is null then
  insert into dm_private.orders(user_id,plan_id,amount,currency,mode)values(auth.uid(),plan.id,plan.amount,plan.currency,settings.environment_mode)returning *into existing;
 end if;
 if existing.payment_review_required then raise exception 'This payment needs team review before another checkout';end if;
 return jsonb_build_object('id',existing.id,'amount',existing.amount,'currency',existing.currency,'mode',existing.mode,'providerOrderId',existing.provider_order_id);
end$$;

create or replace function public.fulfil_verified_payment(p_event_id text,p_provider_order text,p_payment_id text,p_amount integer,p_currency text)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare purchase dm_private.orders;existing dm_private.passes;actor uuid;stamp timestamptz;mode text;effect text;
begin
 if auth.role()is distinct from 'service_role'then raise exception 'Forbidden';end if;
 if p_event_id is null or char_length(p_event_id)not between 1 and 200 or p_payment_id is null or p_payment_id!~'^pay_[A-Za-z0-9]+$'
  or char_length(p_payment_id)>200 or p_provider_order is null or p_provider_order!~'^order_[A-Za-z0-9]+$'then raise exception 'Invalid payment event';end if;
 select user_id into actor from dm_private.orders where provider_order_id=p_provider_order;
 if actor is null then raise exception 'Unknown order';end if;
 -- Match prepare/start/refund ordering before taking an order or pass row lock.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select *into purchase from dm_private.orders where provider_order_id=p_provider_order for update;
 if purchase.id is null then raise exception 'Unknown order';end if;
 select environment_mode into mode from public.launch_settings where singleton;
 if purchase.mode is distinct from mode then raise exception 'Payment mode mismatch';end if;
 if purchase.amount is distinct from p_amount or purchase.currency is distinct from p_currency then raise exception 'Payment amount or currency mismatch';end if;
 if purchase.payment_id is not null and purchase.payment_id<>p_payment_id then raise exception 'Payment identity mismatch';end if;
 if not dm_private.commerce_event_once(p_event_id,purchase.id,p_payment_id,'payment.captured',null,
  jsonb_build_array(p_provider_order,p_payment_id,p_amount,p_currency))then return;end if;
 if purchase.status='refunded'then effect:='already_refunded';
 elsif purchase.status='paid'then effect:='already_paid';
 else
  stamp:=clock_timestamp();
  select *into existing from dm_private.passes where user_id=actor for update;
  if purchase.refunded_amount>0 or(existing.user_id is not null and existing.order_id<>purchase.id and existing.mode=purchase.mode and existing.revoked_at is null and existing.expires_at>stamp)then
   update dm_private.orders set status='paid',payment_id=p_payment_id,paid_at=stamp,payment_review_required=true where id=purchase.id;
   effect:='held_for_review';
  else
   update dm_private.orders set status='paid',payment_id=p_payment_id,paid_at=stamp where id=purchase.id;
   insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at,revoked_at)
   values(actor,purchase.id,purchase.mode,stamp,stamp+interval'12 months',null)
   on conflict(user_id)do update set order_id=excluded.order_id,mode=excluded.mode,starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null;
   effect:='granted';
  end if;
 end if;
 update dm_private.payment_events set outcome=effect where event_id=p_event_id;
end$$;

create function public.record_verified_refund(p_event_id text,p_provider_order text,p_payment_id text,p_refund_id text,
 p_payment_amount integer,p_refund_amount integer,p_total_refunded integer,p_currency text)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare purchase dm_private.orders;previous dm_private.payment_refunds;actor uuid;mode text;known_total bigint;total integer;stamp timestamptz;
begin
 if auth.role()is distinct from 'service_role'then raise exception 'Forbidden';end if;
 if p_event_id is null or char_length(p_event_id)not between 1 and 200 or p_payment_id is null or p_payment_id!~'^pay_[A-Za-z0-9]+$'or char_length(p_payment_id)>200
  or p_provider_order is null or p_provider_order!~'^order_[A-Za-z0-9]+$'or p_refund_id is null or p_refund_id!~'^rfnd_[A-Za-z0-9]+$'or char_length(p_refund_id)>200
  or p_payment_amount is null or p_refund_amount is null or p_total_refunded is null or p_refund_amount<=0 or p_refund_amount>p_payment_amount
  or p_total_refunded<p_refund_amount or p_total_refunded>p_payment_amount or p_currency is distinct from 'INR'then raise exception 'Invalid refund event';end if;
 select user_id into actor from dm_private.orders where provider_order_id=p_provider_order;
 if actor is null then raise exception 'Unknown order';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select *into purchase from dm_private.orders where provider_order_id=p_provider_order for update;
 select environment_mode into mode from public.launch_settings where singleton;
 if purchase.id is null then raise exception 'Unknown order';end if;
 if purchase.mode is distinct from mode then raise exception 'Payment mode mismatch';end if;
 if purchase.amount is distinct from p_payment_amount or purchase.currency is distinct from p_currency then raise exception 'Payment amount or currency mismatch';end if;
 if purchase.payment_id is not null and purchase.payment_id<>p_payment_id then raise exception 'Payment identity mismatch';end if;
 if not dm_private.commerce_event_once(p_event_id,purchase.id,p_payment_id,'refund.processed',p_refund_id,
  jsonb_build_array(p_provider_order,p_payment_id,p_refund_id,p_payment_amount,p_refund_amount,p_total_refunded,p_currency))then return;end if;
 insert into dm_private.payment_refunds(refund_id,order_id,payment_id,amount,currency)values(p_refund_id,purchase.id,p_payment_id,p_refund_amount,p_currency)
 on conflict(refund_id)do nothing;
 select *into previous from dm_private.payment_refunds where refund_id=p_refund_id;
 if previous.order_id<>purchase.id or previous.payment_id<>p_payment_id or previous.amount<>p_refund_amount or previous.currency<>p_currency then raise exception 'Refund identity mismatch';end if;
 select coalesce(sum(amount),0)into known_total from dm_private.payment_refunds where order_id=purchase.id;
 if known_total>purchase.amount then raise exception 'Refund total exceeds payment';end if;
 total:=greatest(purchase.refunded_amount,p_total_refunded,known_total::integer);stamp:=clock_timestamp();
 update dm_private.orders set payment_id=p_payment_id,refunded_amount=total,refunded_at=stamp,
  status=case when total=amount then 'refunded'else status end,payment_review_required=total<amount where id=purchase.id;
 if total=purchase.amount then
  update dm_private.passes set revoked_at=coalesce(revoked_at,stamp),expires_at=greatest(starts_at+interval'1 microsecond',least(expires_at,stamp))
   where user_id=actor and order_id=purchase.id;
 end if;
 update dm_private.payment_events set outcome=case when total=purchase.amount then 'refund_revoked'else 'refund_review_required'end where event_id=p_event_id;
end$$;

-- The initial paid catalogue already serializes starts by actor. Recheck the
-- revocation flag and real clock after that wait; keep its frozen-paper rules.
create or replace function public.start_attempt(p_paper_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare p dm_private.papers;attempt_id uuid;settings_mode text;stamp timestamptz;
begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select environment_mode into settings_mode from public.launch_settings where singleton;
 if not exists(select 1 from dm_private.passes where user_id=auth.uid()and mode=settings_mode and revoked_at is null and expires_at>clock_timestamp())then raise exception 'An active pass is required';end if;
 select *into p from dm_private.papers where id=p_paper_id and published and reviewed and rights_confirmed;
 if p.id is null then raise exception 'Paper is not released';end if;
 if not exists(select 1 from dm_private.questions where paper_id=p.id)or exists(select 1 from dm_private.questions q left join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id and(not q.reviewed or k.question_id is null or(q.kind in('mcq','msq')and jsonb_array_length(q.options)<2)))then raise exception 'Paper review is incomplete';end if;
 select id into attempt_id from dm_private.attempts where user_id=auth.uid()and paper_id=p.id and status='active'and deadline>clock_timestamp()order by started_at desc limit 1;
 if attempt_id is not null then return attempt_id;end if;
 stamp:=clock_timestamp();
 insert into dm_private.attempts(user_id,paper_id,started_at,deadline)values(auth.uid(),p.id,stamp,stamp+make_interval(secs=>p.duration_seconds))returning id into attempt_id;
 insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
 select attempt_id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
 from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id;
 return attempt_id;
end$$;

revoke all on function public.record_verified_refund(text,text,text,text,integer,integer,integer,text)from public,anon,authenticated;
grant execute on function public.record_verified_refund(text,text,text,text,integer,integer,integer,text)to service_role;
revoke all on function public.fulfil_verified_payment(text,text,text,integer,text)from public,anon,authenticated;
grant execute on function public.fulfil_verified_payment(text,text,text,integer,text)to service_role;
commit;
