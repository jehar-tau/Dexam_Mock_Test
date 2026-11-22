import test from 'node:test';
import assert from 'node:assert/strict';
import {loadReleasedYearPapers,releasedYearPaperMap} from '../src/free-year-papers.mjs';

const source = [{id:'uceed:uceed-2026',exam:'uceed',paperId:'uceed-2026',year:2026,objectiveCount:57}];
const release = {paperId:'10000000-0000-4000-8000-000000003001',exam:'uceed',sourcePaperId:'uceed-2026',
  year:2026,partLabel:'Part A',questionCount:57,durationSeconds:7200};

test('free release maps only to the matching year and source', () => {
  assert.deepEqual(releasedYearPaperMap([release],source).get(source[0].id), [{paperId:release.paperId,
    partLabel:'Part A',questionCount:57,durationSeconds:7200}]);
  assert.equal(releasedYearPaperMap([],source).size,0);
});

test('invalid, duplicate, or oversized release responses fail closed', () => {
  for (const bad of [null,{},[{}],[{...release,year:2025}],[{...release,questionCount:58}],
    [{...release,paperId:'wrong'}],[release,release],[{...release,sourcePaperId:'uceed-2025'}]]) {
    assert.throws(() => releasedYearPaperMap(bad,source),/Invalid|Duplicate/);
  }
});

test('a stalled public catalogue request reaches its deadline', async () => {
  let observedSignal;
  const client={rpc(name){assert.equal(name,'free_year_paper_catalog');return{abortSignal(signal){observedSignal=signal;return new Promise(()=>{});}};}};
  await assert.rejects(loadReleasedYearPapers(client,source,new AbortController().signal,15));
  assert.equal(observedSignal.aborted,true);
});

test('public catalogue load validates provider data before showing a release', async () => {
  const client=data=>({rpc(){return{abortSignal:async()=>({data,error:null})};}});
  assert.deepEqual(await loadReleasedYearPapers(client([release]),source,new AbortController().signal),[release]);
  await assert.rejects(loadReleasedYearPapers(client([{...release,questionCount:58}]),source,new AbortController().signal),/Invalid/);
});
