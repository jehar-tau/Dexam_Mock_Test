create table dm_private.launch_gate_attestations(
 gate text primary key check(gate in('content_rights','privacy_terms','refund_policy','child_safety','drawing_operations','provider_acceptance','backup_restore','capacity_acceptance')),
 approved boolean not null default false,evidence text,actor_id uuid references auth.users(id),updated_at timestamptz not null default now(),
 check(not approved or char_length(trim(evidence))>=8)
);
insert into dm_private.launch_gate_attestations(gate)values('content_rights'),('privacy_terms'),('refund_policy'),('child_safety'),('drawing_operations'),('provider_acceptance'),('backup_restore'),('capacity_acceptance');
alter table dm_private.launch_gate_attestations enable row level security;revoke all on dm_private.launch_gate_attestations from anon,authenticated;

create table dm_private.launch_gate_audit(id bigint generated always as identity primary key,gate text not null,approved boolean not null,evidence text,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table dm_private.launch_gate_audit enable row level security;revoke all on dm_private.launch_gate_audit from anon,authenticated;

create or replace function public.admin_launch_readiness()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare v_sales boolean;v_policy text;v_blueprint boolean;v_gates jsonb;v_all boolean;
begin if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
 select sales_enabled,policy_version into v_sales,v_policy from public.launch_settings where singleton;
 select coalesce(bool_and(approved),false),jsonb_agg(jsonb_build_object('gate',gate,'approved',approved,'evidence',evidence,'updatedAt',updated_at)order by gate)into v_all,v_gates from dm_private.launch_gate_attestations;
 select exists(select 1 from dm_private.exam_mock_blueprints b where b.enabled and dm_private.exam_blueprint_ready(b.exam,b.question_count,b.section_manifest))into v_blueprint;
 return jsonb_build_object('salesEnabled',v_sales,'policyPublished',v_policy is not null,'paperBlueprintReady',v_blueprint,'allAttestationsApproved',v_all,'readyForSales',v_policy is not null and v_blueprint and v_all,'gates',v_gates);
end$$;

create or replace function public.admin_set_launch_gate(p_gate text,p_approved boolean,p_evidence text)returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
begin if not public.is_dmocks_admin()then raise exception'Admin access required';end if;if p_approved and char_length(trim(coalesce(p_evidence,'')))<8 then raise exception'Evidence note is required';end if;
 update dm_private.launch_gate_attestations set approved=p_approved,evidence=nullif(trim(p_evidence),''),actor_id=auth.uid(),updated_at=now()where gate=p_gate;if not found then raise exception'Unknown launch gate';end if;
 insert into dm_private.launch_gate_audit(gate,approved,evidence,actor_id)values(p_gate,p_approved,nullif(trim(p_evidence),''),auth.uid());
end$$;

create or replace function dm_private.guard_sales_activation()returns trigger language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin if new.sales_enabled and not old.sales_enabled then
 if new.policy_version is null then raise exception'Cannot enable sales without a published policy version';end if;
 if exists(select 1 from dm_private.launch_gate_attestations where not approved)then raise exception'Cannot enable sales while launch gates are open';end if;
 if not exists(select 1 from dm_private.exam_mock_blueprints b where b.enabled and dm_private.exam_blueprint_ready(b.exam,b.question_count,b.section_manifest))then raise exception'Cannot enable sales without a verified paper blueprint';end if;
 end if;return new;end$$;
create trigger guard_sales_activation before update of sales_enabled on public.launch_settings for each row execute function dm_private.guard_sales_activation();

revoke all on function public.admin_launch_readiness(),public.admin_set_launch_gate(text,boolean,text)from public,anon;
grant execute on function public.admin_launch_readiness(),public.admin_set_launch_gate(text,boolean,text)to authenticated;
