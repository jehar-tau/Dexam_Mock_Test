import test from 'node:test';
import assert from 'node:assert/strict';
import {loadReleasedYearPapers,releasedYearPaperMap,releasedYearPaperGroups} from '../src/free-year-papers.mjs';

const release = {paperId:'10000000-0000-4000-8000-000000003001',exam:'uceed',sourcePaperId:'uceed-2026',
  year:2026,partLabel:'Part A',questionCount:57,durationSeconds:7200};

test('released papers are grouped from the live release, independent of the old export', () => {
  assert.deepEqual(releasedYearPaperMap([release]).get('uceed:uceed-2026'), [{paperId:release.paperId,
    partLabel:'Part A',questionCount:57,durationSeconds:7200,year:2026}]);
  assert.deepEqual(releasedYearPaperGroups([release]), [{id:'uceed:uceed-2026',exam:'uceed',
    paperId:'uceed-2026',year:2026,questionCount:57}]);
  assert.equal(releasedYearPaperMap([]).size,0);
});

test('invalid, duplicate, or oversized release responses fail closed', () => {
  for (const bad of [null,{},[{}],[{...release,year:1999}],[{...release,questionCount:201}],
    [{...release,paperId:'wrong'}],[release,release],[{...release,sourcePaperId:'bad id'}],
    [release,{...release,paperId:'10000000-0000-4000-8000-000000003002',year:2025}]]) {
    assert.throws(() => releasedYearPaperMap(bad),/Invalid|Duplicate|Conflicting/);
  }
});

test('a stalled public catalogue request reaches its deadline', async () => {
  let observedSignal;
  const client={rpc(name){assert.equal(name,'free_year_paper_catalog');return{abortSignal(signal){observedSignal=signal;return new Promise(()=>{});}};}};
  await assert.rejects(loadReleasedYearPapers(client,new AbortController().signal,15));
  assert.equal(observedSignal.aborted,true);
});

test('public catalogue load validates provider data before showing a release', async () => {
  const client=data=>({rpc(){return{abortSignal:async()=>({data,error:null})};}});
  assert.deepEqual(await loadReleasedYearPapers(client([release]),new AbortController().signal),[release]);
  await assert.rejects(loadReleasedYearPapers(client([{...release,questionCount:201}]),new AbortController().signal),/Invalid/);
});
