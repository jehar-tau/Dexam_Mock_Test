-- Include release-bank-year.sql first. Fictional source and parallel rows only.
create function pg_temp.register_parallel_clone(
  p_source_key text,p_source_paper_id uuid,p_parallel_key text
) returns void language plpgsql as $$
declare v_source dm_private.bank_questions;v_previous_role text;
begin
  select * into v_source from dm_private.bank_questions where external_key=p_source_key;
  if v_source.external_key is null then raise exception 'Fictional source missing';end if;
  insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,
    objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
  values(p_parallel_key,md5(p_parallel_key)||md5(p_parallel_key),v_source.exam,v_source.question_type,
    v_source.topic,'owned',true,true,true,true,
    jsonb_build_object('externalKey',p_parallel_key,'holds','[]'::jsonb,'assets','[]'::jsonb,
      'provenance',jsonb_build_object('kind','parallel','generatedFrom',p_source_key)),
    v_source.runtime_payload||jsonb_build_object('prompt','Fresh fictional parallel '||p_parallel_key,
      'key',(v_source.runtime_payload->'key')||jsonb_build_object('sourceExternalKey',p_parallel_key),
      'media','[]'::jsonb,'explanation','Reviewed original parallel derivation and worked reasoning.'),
    repeat('b',40));
  v_previous_role:=coalesce(current_setting('request.jwt.claim.role',true),'');
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.register_parallel_question(p_parallel_key,md5(p_parallel_key)||md5(p_parallel_key),
    p_source_key,p_source_paper_id,'Reviewed original parallel derivation for fictional acceptance.');
  perform set_config('request.jwt.claim.role',v_previous_role,true);
end $$;

create function pg_temp.seed_released_parallel_questions(
  p_exam text,p_counts jsonb,p_label text,p_year integer default 2023
) returns uuid language plpgsql as $$
declare v_kind text;v_count integer;v_n integer;v_key text;v_parallel text;
  v_source_keys text[]:='{}';v_paper uuid;
  v_options jsonb;v_marking jsonb;v_key_json jsonb;v_points numeric;v_negative numeric;
begin
  if p_exam not in('uceed','ceed','nift','nid') or p_counts is null
    or jsonb_typeof(p_counts)<>'object' or p_label !~ '^[a-z0-9-]{4,65}$'
    or p_year between 2024 and 2026 then raise exception 'Invalid fictional parallel fixture';end if;
  for v_kind,v_count in select key,value::integer from jsonb_each_text(p_counts) loop
    if v_kind not in('mcq','msq','nat') or v_count<0 or v_count>100 then
      raise exception 'Invalid fictional parallel section';end if;
    for v_n in 1..v_count loop
      v_key:=p_label||'-source-'||v_kind||'-'||v_n;
      v_parallel:=p_label||'-parallel-'||v_kind||'-'||v_n;
      v_source_keys:=array_append(v_source_keys,v_key);
      v_options:=case when v_kind='nat' then '[]'::jsonb else
        '[{"id":"A","label":"First"},{"id":"B","label":"Second"},{"id":"C","label":"Third"},{"id":"D","label":"Fourth"}]'::jsonb end;
      v_marking:=case v_kind when 'mcq' then '{"correct":3,"wrong":-0.71}'::jsonb
        when 'msq' then '{"correct":4,"wrong":-1,"partial":true}'::jsonb
        else '{"correct":4,"wrong":0}'::jsonb end;
      v_points:=(v_marking->>'correct')::numeric;v_negative:=-(v_marking->>'wrong')::numeric;
      v_key_json:=jsonb_build_object('kind',v_kind,'sourceExternalKey',v_key)||
        case v_kind when 'nat' then '{"accepted":[{"exact":"1"}]}'::jsonb
          when 'msq' then '{"correct":["A","B"]}'::jsonb
          else '{"correct":["A"]}'::jsonb end;
      insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,
        objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
      values(v_key,md5(v_key)||md5(v_key),p_exam,upper(v_kind),p_label,'owned',true,true,true,true,
        jsonb_build_object('externalKey',v_key,'holds','[]'::jsonb,'assets','[]'::jsonb,
          'prompt','Fictional source '||v_key),
        jsonb_build_object('prompt','Fictional source '||v_key,'options',v_options,'kind',v_kind,
          'marking',v_marking,'media','[]'::jsonb,'points',v_points,'negativePoints',v_negative,
          'key',v_key_json,'explanation','Reviewed fictional source explanation.'),repeat('a',40));
    end loop;
  end loop;
  if cardinality(v_source_keys)=0 then raise exception 'Empty fictional paper';end if;
  v_paper:=pg_temp.release_bank_year(v_source_keys,p_exam,p_year,p_label||'-'||p_year);
  for v_kind,v_count in select key,value::integer from jsonb_each_text(p_counts) loop
    for v_n in 1..v_count loop
      v_key:=p_label||'-source-'||v_kind||'-'||v_n;
      v_parallel:=p_label||'-parallel-'||v_kind||'-'||v_n;
      perform pg_temp.register_parallel_clone(v_key,v_paper,v_parallel);
    end loop;
  end loop;
  return v_paper;
end $$;
