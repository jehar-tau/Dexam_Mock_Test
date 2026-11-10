// Original fictional recovery data only. Caller owns and guards the sandbox.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
export const recoveryActor=(actor,statement)=>`begin;set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub',${quote(actor)},true);${statement};commit;`;
export function recoverySeed({owner=randomUUID(),other=randomUUID(),admin=randomUUID(),insertUsers=true}={}){
 const paper=randomUUID(),order=randomUUID(),request=randomUUID(),event='evt_recovery'+randomUUID().replaceAll('-',''),providerOrder='order_recovery'+randomUUID().replaceAll('-',''),payment='pay_recovery'+randomUUID().replaceAll('-','');
 const fixture=readFileSync(new URL('mvp-objective-paper.sql',import.meta.url),'utf8');
 const source=`begin;${insertUsers?`insert into auth.users(id)values(${quote(owner)}),(${quote(other)}),(${quote(admin)});`:''}
 insert into dm_private.admins(user_id)values(${quote(admin)});
 ${fixture}
 select pg_temp.seed_mvp_paper('uceed',${quote(paper)});
 insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)values(${quote(order)},${quote(owner)},'annual',119300,'INR','test',${quote(providerOrder)});
 set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
 select public.fulfil_verified_payment(${quote(event)},${quote(providerOrder)},${quote(payment)},119300,'INR');reset role;
 set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub',${quote(admin)},true);
 select public.admin_release_mvp_paper(${quote(paper)},public.admin_mvp_paper_manifest(${quote(paper)})->'manifest'->>'sha256','Original fictional recovery fixture: explicitly authored and approved for isolated testing only.');
 reset role;
 insert into dm_private.launch_gate_audit(gate,approved,evidence,actor_id)values('backup_restore',false,'Original fictional recovery fixture; hosted recovery remains unapproved.',${quote(admin)});
 set local role authenticated;select set_config('request.jwt.claim.sub',${quote(owner)},true);
 select set_config('test.recovery.completed',public.start_attempt(${quote(paper)})::text,true);
 select public.save_answer_revision(current_setting('test.recovery.completed')::uuid,md5('mvp-original-1')::uuid,'"1"',7);
 select public.submit_attempt(current_setting('test.recovery.completed')::uuid);
 select set_config('test.recovery.active',public.start_attempt(${quote(paper)})::text,true);
 select public.save_answer_revision(current_setting('test.recovery.active')::uuid,md5('mvp-original-2')::uuid,'"1"',9);
 select set_config('test.recovery.report',public.submit_bug_report('Original fictional recovery report','An original fictional recovery report with complete reproduction details.','/account',${quote(request)},${quote(order)})::text,true);
 select set_config('request.jwt.claim.sub',${quote(admin)},true);
 select public.admin_reply_bug_report(current_setting('test.recovery.report')::uuid,0,'fixed','Original fictional restored support reply.',gen_random_uuid());reset role;
 select jsonb_build_object('owner',${quote(owner)},'other',${quote(other)},'admin',${quote(admin)},'paper',${quote(paper)},'order',${quote(order)},'event',${quote(event)},'payment',${quote(payment)},'completed',current_setting('test.recovery.completed'),'active',current_setting('test.recovery.active'),'report',current_setting('test.recovery.report'),'deadline',(select deadline from dm_private.attempts where id=current_setting('test.recovery.active')::uuid),'auditMax',(select max(id)from dm_private.launch_gate_audit));commit;`;
 return{source,owner,other,admin};
}
