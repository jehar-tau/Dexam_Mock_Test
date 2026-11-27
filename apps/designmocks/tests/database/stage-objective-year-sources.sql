begin;
create temporary table year_fixture(p jsonb,r jsonb);
insert into year_fixture
select jsonb_build_object('format','dmocks-free-year-paper-v1','sourcePaperId','nift-test','year',2020,'exam','nift',
  'questions',jsonb_build_array(jsonb_build_object('externalKey','yt-q1','contentSha256',repeat('a',64)))),
  jsonb_build_array(jsonb_build_object('externalKey','yt-q1','contentSha256',repeat('a',64),'exam','nift',
  'type','MCQ','topic','test','licence','owner-provided','objectiveReady',true,
  'payload',jsonb_build_object('type','MCQ','holds','[]'::jsonb,'externalKey','yt-q1',
  'provenance',jsonb_build_object('exam','NIFT','paperId','nift-test','year',2020))));
grant select on year_fixture to service_role;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('yt-unrelated',repeat('e',64),'ceed','MCQ','fixture','owner-provided','{"holds":[]}',repeat('2',40));
do $$ declare signature text:='public.stage_objective_year_sources(jsonb,text,jsonb)';begin
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
     or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Wrong year source grants';end if;
end $$;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare f year_fixture;begin
  select * into f from year_fixture;
  if public.stage_objective_year_sources(f.p,repeat('b',40),f.r)<>1
    or public.stage_objective_year_sources(f.p,repeat('b',40),f.r)<>1 then raise exception 'Stage or retry count failed'; end if;
  begin perform public.stage_objective_year_sources(f.p,repeat('b',40),jsonb_set(f.r,'{0,payload,holds}','["held"]'));
    raise exception 'Held record accepted' using errcode='XX001';
  exception when raise_exception then null; end;
  begin perform public.stage_objective_year_sources(f.p,repeat('b',40),jsonb_set(f.r,'{0,payload,prompt}','"different"'));
    raise exception 'Active content changed' using errcode='XX001';
  exception when raise_exception then null; end;
end$$;
reset role;
do $$begin
  if (select count(*) from dm_private.bank_questions where external_key in ('yt-q1','yt-unrelated') and active)<>2
    or not exists(select 1 from dm_private.bank_questions where external_key='yt-q1' and not owner_approved and not rights_confirmed)
    then raise exception 'Scope or review status changed'; end if;
end$$;
rollback;
