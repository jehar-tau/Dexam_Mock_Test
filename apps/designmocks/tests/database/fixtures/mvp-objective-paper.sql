-- Original fictional canonical Part A data; disposable database tests only.
create function pg_temp.seed_mvp_paper(candidate_exam text,candidate_id uuid)returns void language plpgsql as $$declare count_questions integer;count_nat integer;count_msq integer;n integer;kind text;external text;question uuid;options jsonb;answer jsonb;marking jsonb;runtime jsonb;prompt text;penalty numeric;begin
 count_questions:=case when candidate_exam='uceed'then 57 else 44 end;count_nat:=case when candidate_exam='uceed'then 14 else 8 end;count_msq:=case when candidate_exam='uceed'then 15 else 10 end;
 insert into dm_private.papers(id,title,exam,duration_seconds)values(candidate_id,upper(candidate_exam)||' Part A original fictional profile paper',candidate_exam,case when candidate_exam='uceed'then 7200 else 3600 end);
 for n in 1..count_questions loop
  kind:=case when n<=count_nat then'nat'when n<=count_nat+count_msq then'msq'else'mcq'end;external:=(case when candidate_exam='uceed'then'mvp-original-'else'mvp-ceed-'end)||n;question:=md5(external)::uuid;prompt:='Original fictional profile question '||n;
  options:=case when kind='nat'then'[]'::jsonb else'[{"id":"A","label":"Original one"},{"id":"B","label":"Original two"},{"id":"C","label":"Original three"},{"id":"D","label":"Original four"}]'::jsonb end;
  penalty:=case when kind='nat'then 0 when kind='msq'then 1 when candidate_exam='uceed'then 0.71 else 0.5 end;
  answer:=jsonb_build_object('kind',kind,'sourceExternalKey',external)||case when kind='nat'then'{"accepted":[{"exact":"1"}]}'::jsonb else'{"correct":["A"]}'::jsonb end;
  marking:=jsonb_build_object('correct',case when kind='mcq'then 3 else 4 end,'wrong',-penalty)||case when kind='msq'then'{"partial":true}'::jsonb else'{}'::jsonb end;
  runtime:=jsonb_build_object('context',jsonb_build_object('version','iitb-2027-v1','exam',candidate_exam,'cycle',2027),'kind',kind,'prompt',prompt,'options',options,'key',answer,'marking',marking,'points',case when kind='mcq'then 3 else 4 end,'negativePoints',penalty,'media','[]'::jsonb,'topic','fixture','explanation','Original fictional explanation');
  insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,runtime_payload,source_commit,active,objective_ready,owner_approved,rights_confirmed)
  values(external,md5(external)||md5(external),candidate_exam,upper(kind),'fixture','owner-provided',jsonb_build_object('externalKey',external,'prompt',prompt,'holds','[]'::jsonb,'assets','[]'::jsonb,'visualDependency',false,'type',upper(kind),'options',(select coalesce(jsonb_agg(jsonb_build_object('key',o->>'id','text',o->>'label')),'[]')from jsonb_array_elements(options)o),'answer',jsonb_build_object('status','reviewed','raw',case when kind='nat'then'1'else'A'end)),runtime,repeat('a',40),true,true,true,true);
  insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  values(question,candidate_id,n,prompt,options,kind,marking,'[]',case when kind='mcq'then 3 else 4 end,penalty,'fixture',true);
  insert into dm_private.answer_keys(question_id,key,explanation)values(question,answer,'Original fictional explanation');
 end loop;
end$$;
