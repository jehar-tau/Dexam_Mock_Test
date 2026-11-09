begin;

create index orders_owner_mode_purchase_page_idx
  on dm_private.orders(user_id,mode,created_at desc,id desc);

create function public.my_purchase_page(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare
  actor uuid:=auth.uid();
  active_mode text;
begin
  if actor is null then
    raise exception 'Sign in required' using errcode='42501';
  end if;

  select s.environment_mode into active_mode from public.launch_settings s where s.singleton;
  if active_mode is null then
    raise exception 'Purchase history unavailable';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null)
    or (p_before_id is not null and not exists (
      select 1 from dm_private.orders o
      where o.id=p_before_id and o.created_at=p_before_created_at
        and o.user_id=actor and o.mode=active_mode
    )) then
    raise exception 'Invalid purchase history cursor' using errcode='22023';
  end if;

  return (
    with candidates as (
      (select o.* from dm_private.orders o
        where o.user_id=actor and o.mode=active_mode and p_before_id is null
        order by o.created_at desc,o.id desc limit 11)
      union all
      (select o.* from dm_private.orders o
        where o.user_id=actor and o.mode=active_mode and p_before_id is not null
          and (o.created_at,o.id)<(p_before_created_at,p_before_id)
        order by o.created_at desc,o.id desc limit 11)
    ), numbered as (
      select c.*,row_number() over (order by c.created_at desc,c.id desc) as position
      from candidates c
    )
    select jsonb_build_object(
      'mode',active_mode,
      'items',coalesce(jsonb_agg(jsonb_build_object(
        'reference',n.id,
        'amountMinor',n.amount,
        'currency',n.currency,
        'status',n.status,
        'refundedMinor',n.refunded_amount,
        'reviewRequired',n.payment_review_required,
        'createdAt',n.created_at,
        'paidAt',n.paid_at,
        'refundedAt',n.refunded_at
      ) order by n.position) filter (where n.position<=10),'[]'::jsonb),
      'nextCursor',case when count(*)>10 then (
        select jsonb_build_object('createdAt',last.created_at,'reference',last.id)
        from numbered last where last.position=10
      ) end
    ) from numbered n
  );
end $$;

revoke all on function public.my_purchase_page(timestamptz,uuid) from public,anon,authenticated,service_role;
do $$begin
  if to_regclass('dm_private.mvp_rpc_allowlist') is null then
    grant execute on function public.my_purchase_page(timestamptz,uuid) to authenticated;
  end if;
end $$;

commit;
