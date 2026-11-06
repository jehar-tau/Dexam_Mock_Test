import {createHash}from"node:crypto";
import {readFile}from"node:fs/promises";
import {pathToFileURL}from"node:url";

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const contentSha256=value=>createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const keyMap=(records,label)=>{const map=new Map;for(const record of records){if(!record.externalKey||map.has(record.externalKey))throw new Error(`${label} external keys must be present and unique`);map.set(record.externalKey,record)}return map};
const validHash=value=>/^[0-9a-f]{64}$/.test(value??"");

export function reconcileBankState(canonical,snapshot,cloudboard=null){
  if(canonical?.schemaVersion!==1||!Array.isArray(canonical.questions))throw new Error("Unsupported canonical export");
  if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.records))throw new Error("Unsupported deployed-state snapshot");
  const canonicalMap=keyMap(canonical.questions,"Canonical"),snapshotMap=keyMap(snapshot.records,"Snapshot"),allowedStates=new Set(["ready","review","quarantined","retired"]);
  for(const record of snapshot.records)if(!validHash(record.contentSha256)||!allowedStates.has(record.state))throw new Error(`Invalid deployed record: ${record.externalKey}`);
  const issues={missing:[],changed:[],unsafeReady:[],unexpected:[],cloudboardMissing:[],cloudboardChanged:[]};
  const stateCounts={ready:0,review:0,quarantined:0,retired:0};
  for(const record of snapshot.records)stateCounts[record.state]+=1;
  for(const question of canonical.questions){
    if(!Array.isArray(question.holds))throw new Error(`Malformed canonical holds: ${question.externalKey}`);
    const deployed=snapshotMap.get(question.externalKey),hash=contentSha256(question),eligible=question.holds.length===0;
    if(eligible&&!deployed)issues.missing.push(question.externalKey);
    if(deployed&&deployed.contentSha256!==hash)issues.changed.push(question.externalKey);
    if(!eligible&&deployed?.state==="ready")issues.unsafeReady.push(question.externalKey);
  }
  for(const record of snapshot.records)if(!canonicalMap.has(record.externalKey)&&record.state!=="retired")issues.unexpected.push(record.externalKey);
  if(cloudboard){
    if(cloudboard.schemaVersion!==1||!Array.isArray(cloudboard.records))throw new Error("Unsupported Cloudboard manifest");
    const sourceIds=new Set;
    for(const record of cloudboard.records){if(!record.sourceId||sourceIds.has(record.sourceId)||!record.externalKey||!validHash(record.contentSha256))throw new Error("Cloudboard records require unique sourceId, externalKey and SHA-256");sourceIds.add(record.sourceId);const question=canonicalMap.get(record.externalKey);if(!question)issues.cloudboardMissing.push(record.sourceId);else if(contentSha256(question)!==record.contentSha256)issues.cloudboardChanged.push(record.sourceId)}
  }
  for(const values of Object.values(issues))values.sort();
  const issueCounts=Object.fromEntries(Object.entries(issues).map(([key,value])=>[key,value.length])),passed=Object.values(issueCounts).every(value=>value===0);
  return{schemaVersion:1,canonicalTotal:canonical.questions.length,canonicalEligible:canonical.questions.filter(question=>question.holds.length===0).length,deployedTotal:snapshot.records.length,stateCounts,cloudboardTotal:cloudboard?.records.length??null,issueCounts,issues,passed};
}

async function main(){const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]},canonicalPath=value("--canonical"),snapshotPath=value("--snapshot"),cloudboardPath=value("--cloudboard");if(!canonicalPath||!snapshotPath)throw new Error("Usage: node scripts/reconcile-bank-state.mjs --canonical BANK.json --snapshot DEPLOYED.json [--cloudboard MANIFEST.json]");const canonical=JSON.parse(await readFile(canonicalPath,"utf8")),snapshot=JSON.parse(await readFile(snapshotPath,"utf8")),cloudboard=cloudboardPath?JSON.parse(await readFile(cloudboardPath,"utf8")):null,result=reconcileBankState(canonical,snapshot,cloudboard);process.stdout.write(`${JSON.stringify(result,null,2)}\n`);if(!result.passed)process.exitCode=2}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1});
