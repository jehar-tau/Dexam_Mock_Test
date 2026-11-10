import test from"node:test";
import assert from"node:assert/strict";
import{contentSha256,reconcileBankState}from"../scripts/reconcile-bank-state.mjs";
const q=(externalKey,holds=[])=>({externalKey,prompt:`Fixture ${externalKey}`,type:"MCQ",holds,provenance:{exam:"uceed"}});
const canonical={schemaVersion:1,questions:[q("one"),q("two"),q("held",["review"])]};

test("bank reconciliation passes classified deployed state and a matching manual manifest",()=>{
  const snapshot={schemaVersion:1,records:[{externalKey:"one",contentSha256:contentSha256(canonical.questions[0]),state:"ready"},{externalKey:"two",contentSha256:contentSha256(canonical.questions[1]),state:"quarantined"},{externalKey:"old",contentSha256:"a".repeat(64),state:"retired"}]};
  const cloudboard={schemaVersion:1,records:[{sourceId:"manual-1",externalKey:"one",contentSha256:contentSha256(canonical.questions[0])}]};
  const result=reconcileBankState(canonical,snapshot,cloudboard);
  assert.equal(result.passed,true);assert.deepEqual(result.issueCounts,{missing:0,changed:0,unsafeReady:0,unexpected:0,cloudboardMissing:0,cloudboardChanged:0});
});

test("bank reconciliation exposes stable keys only for every unexplained difference",()=>{
  const snapshot={schemaVersion:1,records:[{externalKey:"one",contentSha256:"b".repeat(64),state:"ready"},{externalKey:"held",contentSha256:contentSha256(canonical.questions[2]),state:"ready"},{externalKey:"foreign",contentSha256:"c".repeat(64),state:"review"}]};
  const cloudboard={schemaVersion:1,records:[{sourceId:"push-7",externalKey:"missing-manual",contentSha256:"d".repeat(64)}]};
  const result=reconcileBankState(canonical,snapshot,cloudboard);
  assert.equal(result.passed,false);assert.deepEqual(result.issues,{missing:["two"],changed:["one"],unsafeReady:["held"],unexpected:["foreign"],cloudboardMissing:["push-7"],cloudboardChanged:[]});
  assert.equal(JSON.stringify(result).includes("Fixture"),false);
});

test("bank reconciliation rejects malformed holds, duplicate keys and unverifiable hashes",()=>{
  assert.throws(()=>reconcileBankState({schemaVersion:1,questions:[{externalKey:"bad"}]},{schemaVersion:1,records:[]}),/Malformed canonical holds/);
  assert.throws(()=>reconcileBankState({schemaVersion:1,questions:[q("one"),q("one")]},{schemaVersion:1,records:[]}),/unique/);
  assert.throws(()=>reconcileBankState(canonical,{schemaVersion:1,records:[{externalKey:"one",contentSha256:"no",state:"ready"}]}),/Invalid deployed record/);
});

test("bank reconciliation distinguishes an eligible retired row from held history",()=>{
  const snapshot={schemaVersion:1,records:[
    {externalKey:"one",contentSha256:contentSha256(canonical.questions[0]),state:"retired"},
    {externalKey:"two",contentSha256:contentSha256(canonical.questions[1]),state:"review"},
    {externalKey:"held",contentSha256:"a".repeat(64),state:"retired"},
  ]};
  const result=reconcileBankState(canonical,snapshot);
  assert.equal(result.passed,false);
  assert.deepEqual(result.issues.missing,["one"]);
  assert.deepEqual(result.issues.changed,[]);
});
