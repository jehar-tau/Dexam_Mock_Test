import {createHash, randomUUID} from 'node:crypto';
import {quote} from './recovery-state.mjs';

// Historical inventory model. The earlier AI migration is intentionally absent.
export const preUpgradeVersions = Object.freeze([
  '202611040001', '202611040002', '202611040003', '202611040004', '202611050005',
  '202611050006', '202611050007', '202611050008', '202611050009', '202611050010',
  '202611050011', '202611050012', '202611050013', '202611050014', '202611050015',
  '202611050016', '202611050017', '202611050018', '202611060001', '202611060002',
  '202611060003', '202611060004', '202611060005', '202611060101', '202611060102',
]);

export const preUpgradePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64',
);
const assetSha = createHash('sha256').update(preUpgradePng).digest('hex');
export const preUpgradeMediaPath = `papers/canonical/${assetSha}.png`;

export function seedPreUpgradeRecovery({owner = randomUUID(), other = randomUUID(), admin = randomUUID(), insertUsers = true} = {}) {
  const paper = randomUUID(), question = randomUUID(), order = randomUUID();
  const suffix = randomUUID().replaceAll('-', '');
  const providerOrder = `order_legacy${suffix}`, payment = `pay_legacy${suffix}`, event = `evt_legacy${suffix}`;
  const source = `begin;
    ${insertUsers ? `insert into auth.users(id) values (${quote(owner)}), (${quote(other)}), (${quote(admin)});` : ''}
    insert into public.profiles(user_id,display_name,city,exams)
    values (${quote(owner)},'Original recovery student','Pune',array['uceed']);
    insert into dm_private.admins(user_id) values (${quote(admin)});
    insert into dm_private.papers(id,title,exam,duration_seconds,published,reviewed,rights_confirmed)
    values (${quote(paper)},'Original fictional pre-upgrade paper','uceed',7200,true,true,true);
    insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic,reviewed)
    values (${quote(question)},${quote(paper)},1,'What is the number of dots?','[]','nat','{"correct":4,"wrong":0}',4,'fictional',true);
    insert into dm_private.answer_keys(question_id,key,explanation)
    values (${quote(question)},'{"kind":"nat","accepted":[{"exact":"1"}]}','There is one dot.');
    insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)
    values (${quote(order)},${quote(owner)},'annual',119300,'INR','test',${quote(providerOrder)});
    set local role service_role;
    select set_config('request.jwt.claim.role','service_role',true);
    select public.fulfil_verified_payment(${quote(event)},${quote(providerOrder)},${quote(payment)},119300,'INR');
    reset role;
    set local role authenticated;
    select set_config('request.jwt.claim.role','authenticated',true);
    select set_config('request.jwt.claim.sub',${quote(owner)},true);
    select set_config('test.recovery.completed',public.start_attempt(${quote(paper)})::text,true);
    select public.save_answer_revision(current_setting('test.recovery.completed')::uuid,${quote(question)},'"1"',7);
    select public.submit_attempt(current_setting('test.recovery.completed')::uuid);
    select set_config('test.recovery.active',public.start_attempt(${quote(paper)})::text,true);
    select public.save_answer_revision(current_setting('test.recovery.active')::uuid,${quote(question)},'"1"',9);
    select set_config('test.recovery.report',public.submit_bug_report('Original fictional recovery report',
      'An original fictional recovery report with complete reproduction details.','/account')::text,true);
    select set_config('request.jwt.claim.sub',${quote(admin)},true);
    select public.admin_reply_bug_report(current_setting('test.recovery.report')::uuid,'fixed','Original fictional restored support reply.');
    reset role;
    select jsonb_build_object('owner',${quote(owner)},'other',${quote(other)},'admin',${quote(admin)},
      'paper',${quote(paper)},'question',${quote(question)},'order',${quote(order)},'event',${quote(event)},'payment',${quote(payment)},
      'completed',current_setting('test.recovery.completed'),'active',current_setting('test.recovery.active'),
      'report',current_setting('test.recovery.report'),
      'deadline',(select deadline from dm_private.attempts where id=current_setting('test.recovery.active')::uuid));
    commit;`;
  return source;
}

export const registerPreUpgradeMedia = `begin;
  insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
  values ('pre-upgrade-original',repeat('a',64),'uceed','NAT','fictional','dexam-original',
    jsonb_build_object('externalKey','pre-upgrade-original','prompt','How many dots are visible?','holds','[]'::jsonb,
      'assets',jsonb_build_array(jsonb_build_object('sha256',${quote(assetSha)},'width',1,'height',1,'path','original/dot.png')),
      'visualDependency',true),repeat('a',40));
  set local role service_role;
  select set_config('request.jwt.claim.role','service_role',true);
  select public.register_bank_media_assets(jsonb_build_array(jsonb_build_object('sha256',${quote(assetSha)},
    'storagePath',${quote(preUpgradeMediaPath)},'width',1,'height',1,'byteSize',${preUpgradePng.length})));
  commit;`;

// Compare values that must survive the upgrade, including legacy payment identities.
export function preUpgradeProtectedState({owner, order, event, active, completed, report}) {
  return `select jsonb_build_object(
    'account',(select jsonb_build_array(id,email,email_confirmed_at) from auth.users where id=${quote(owner)}),
    'profile',(select jsonb_build_array(user_id,display_name,city,exams,created_at) from public.profiles where user_id=${quote(owner)}),
    'attempts',(select jsonb_agg(jsonb_build_array(id,user_id,paper_id,status,started_at,deadline,submitted_at,score,total) order by id)
      from dm_private.attempts where id in (${quote(active)},${quote(completed)})),
    'items',(select jsonb_agg(jsonb_build_array(attempt_id,question_id,prompt,key,answer,answer_revision,answered_at) order by attempt_id)
      from dm_private.attempt_items where attempt_id in (${quote(active)},${quote(completed)})),
    'order',(select jsonb_build_array(id,user_id,mode,amount,currency,provider_order_id,payment_id,status,paid_at)
      from dm_private.orders where id=${quote(order)}),
    'event',(select jsonb_build_array(event_id,order_id,processed_at) from dm_private.payment_events where event_id=${quote(event)}),
    'pass',(select jsonb_build_array(user_id,order_id,mode,starts_at,expires_at) from dm_private.passes where user_id=${quote(owner)}),
    'support',(select jsonb_build_array(id,reporter_id,status,admin_reply) from dm_private.bug_reports where id=${quote(report)}),
    'bank',(select jsonb_build_array(external_key,payload,content_sha256,source_commit,owner_approved)
      from dm_private.bank_questions where external_key='pre-upgrade-original'),
    'asset',(select jsonb_build_array(sha256,storage_path,width,height,byte_size) from dm_private.bank_media_assets where sha256=${quote(assetSha)}),
    'sale',(select sales_enabled from public.launch_settings),
    'registration',(select mode from dm_private.registration_policy));`;
}
