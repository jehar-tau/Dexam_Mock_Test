import assert from 'node:assert/strict';

// Rehearsal archives predate free year papers. Keep their installed profile
// faithful to its migration era while deriving it from the current source.
export function withoutFreeYearPapers(profile) {
  const replaceOnce = (source, before, after) => {
    assert.equal(source.split(before).length, 2, 'Expected one historic profile change');
    return source.replace(before, after);
  };
  let result = replaceOnce(profile,
    "and((has_function_privilege('anon',p.oid,'EXECUTE') is distinct from (p.oid='public.free_year_paper_catalog()'::regprocedure))\n   or has_function_privilege('authenticated',p.oid,'EXECUTE')is distinct from exists(select 1 from dm_private.mvp_rpc_allowlist a where to_regprocedure(a.signature)=p.oid)))",
    "and(has_function_privilege('anon',p.oid,'EXECUTE')or has_function_privilege('authenticated',p.oid,'EXECUTE')is distinct from exists(select 1 from dm_private.mvp_rpc_allowlist a where to_regprocedure(a.signature)=p.oid)))");
  result = replaceOnce(result, " ('public.free_year_paper_catalog()','student'),\n", '');
  result = replaceOnce(result, " ('public.start_free_year_paper(uuid)','student'),\n", '');
  result = replaceOnce(result, " ('public.my_year_paper_attempts()','student'),\n", '');
  result = replaceOnce(result, ' grant execute on function public.free_year_paper_catalog() to anon;\n', '');
  return result;
}
