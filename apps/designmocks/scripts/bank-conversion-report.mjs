// Read-only operator diagnostics. Never import into the public application.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadFromGit,sha256,stableJson,SOURCE_PATH} from './question-bank-import.mjs';
import {inspectRuntimeQuestion,RULES_2027} from './question-runtime.mjs';
import {compileRuntimeManifest} from './materialize-bank-runtime.mjs';
import {planCanonicalMedia} from './private-bank-media.mjs';

export const DIAGNOSTICS_VERSION='verified-conversion-diagnostics-v1';
export const CORRECTION_ACTIONS=Object.freeze({
 'invalid-record':'Restore a valid canonical question record.',
 'context-unverified':'Verify the exam blueprint, clock, marking and rubric before defining its delivery context.',
 'holds-unresolved':'Resolve the canonical holds through source review before importing this version.',
 'prompt-missing':'Restore the complete question wording in the canonical source.',
 'assets-invalid':'Correct the canonical figure references.',
 'visual-assets-missing':'Attach the complete required question figure in the canonical source.',
 'media-unverified':'Verify and register the exact private figure digest, dimensions and bytes.',
 'drawing-figure-missing':'Restore the drawing task figure before conversion.',
 'section-unmodelled':'Verify and model this exam section and its marking or human-review rubric.',
 'answer-pending':'Review the answer key; do not generate or infer a live key.',
 'answer-missing':'Save a reviewed answer key in the canonical source.',
 'answer-notation':'Review and encode the full answer in supported exact notation without inventing a tolerance.',
 'option-count':'Restore exactly four options in the canonical source.',
 'choice-options-missing':'Restore at least two complete labelled choices before reviewing the exam-specific option structure.',
 'option-labels':'Correct missing or duplicate option labels without guessing their answer mapping.',
 'option-asset-unmapped':'Resolve individual option images into verified delivery media.',
 'option-text-invalid':'Correct the option text schema.',
 'option-text-missing':'Restore option wording or the complete labelled question figure.',
});

export function compileConversionReport(manifest,mediaCatalog){
 assert.equal(manifest?.sourcePath,SOURCE_PATH,'Only the canonical export is supported');
 assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/i);
 assert.match(manifest.sourceSha256,/^[a-f0-9]{64}$/);
 assert.equal(manifest.records.length,manifest.eligibleTotal);
 assert.equal(new Set(manifest.records.map(r=>r.externalKey)).size,manifest.records.length,'Duplicate canonical key');
 for(const r of manifest.records){
  assert.deepEqual(r.payload.holds,[],'Only explicit empty-holds records may enter this report');
  assert.equal(r.contentSha256,sha256(stableJson(r.payload)),'Source version changed');
  assert.equal(r.externalKey,r.payload.externalKey);
  assert.equal(r.exam,String(r.payload.provenance?.exam).toLowerCase());
 }
 const plan=compileRuntimeManifest(manifest,mediaCatalog),counts={mvpObjective:0,otherSupported:0,blocked:0},byExam={},byIssue={};
 const records=manifest.records.map(r=>{
  const result=inspectRuntimeQuestion(r.payload,{rule:RULES_2027[r.exam],mediaCatalog});
  const classification=!result.runtime?'blocked':['uceed','ceed'].includes(r.exam)&&result.runtime.kind!=='drawing'?'mvpObjective':'otherSupported';
  counts[classification]++;
  const exam=byExam[r.exam]??={total:0,mvpObjective:0,otherSupported:0,blocked:0};exam.total++;exam[classification]++;
  const issues=result.issues.map(issue=>{assert.ok(CORRECTION_ACTIONS[issue.code],'Unknown compiler diagnostic');byIssue[issue.code]=(byIssue[issue.code]??0)+1;return{...issue,action:CORRECTION_ACTIONS[issue.code]};});
  return{externalKey:r.externalKey,contentSha256:r.contentSha256,exam:r.exam,type:r.type,classification,kind:result.runtime?.kind??null,contextVersion:result.runtime?.context.version??null,issues};
 });
 const report={schemaVersion:1,diagnosticsVersion:DIAGNOSTICS_VERSION,sourcePath:manifest.sourcePath,sourceCommit:manifest.sourceCommit,sourceSha256:manifest.sourceSha256,rulesSha256:sha256(stableJson(RULES_2027)),mediaCatalogueSha256:sha256(stableJson([...mediaCatalog].sort((a,b)=>a.sha256.localeCompare(b.sha256)))),runtimePlanSha256:plan.planSha256,total:records.length,counts,byExam,byIssue,hostedReadinessVerified:false,publicationOrApprovalChanges:false,records,correctionQueue:records.filter(r=>r.classification==='blocked')};
 return{...report,reportSha256:sha256(stableJson(report))};
}

export async function writePrivateReport(output,report,{repositoryRoot}={}){
 const app=await realpath(fileURLToPath(new URL('..',import.meta.url)));
 const parent=await realpath(path.dirname(path.resolve(output))),target=path.join(parent,path.basename(output));
 for(const directory of['public','src','dist','.git'])assert.ok(target!==path.join(app,directory)&&!target.startsWith(path.join(app,directory)+path.sep),'Report cannot enter public/application output');
 const root=await realpath(repositoryRoot??execFileSync('git',['rev-parse','--show-toplevel'],{cwd:app,encoding:'utf8'}).trim());
 assert.ok(target!==path.join(root,'.git')&&!target.startsWith(path.join(root,'.git')+path.sep),'Report cannot enter Git internals');
 if(target.startsWith(root+path.sep))assert.equal(spawnSync('git',['check-ignore','--quiet','--',target],{cwd:root}).status,0,'A repository report must be untracked and ignored');
 await writeFile(target,JSON.stringify(report,null,2)+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});
}

async function main(args){
 const options={};
 for(let n=0;n<args.length;n+=2){assert.ok(['--ref','--media-root','--output'].includes(args[n])&&args[n+1]&&!args[n+1].startsWith('--')&&!Object.hasOwn(options,args[n]),'Use --ref, --media-root and optional --output once each');options[args[n]]=args[n+1];}
 assert.ok(options['--media-root'],'A read-only canonical --media-root is required');
 const manifest=loadFromGit(options['--ref']??'origin/main'),media=await planCanonicalMedia(manifest,options['--media-root']);
 const report=compileConversionReport(manifest,media.assets.map(a=>({sha256:a.sha256,path:a.storagePath,width:a.width,height:a.height,byteSize:a.byteSize})));
 if(options['--output'])await writePrivateReport(options['--output'],report);
 const{records,correctionQueue,...summary}=report;
 console.log(JSON.stringify({mode:'read-only-local-conversion-diagnostics',...summary,verifiedLocalImages:media.assets.length,verifiedLocalImageBytes:media.totalBytes,privateReportWritten:Boolean(options['--output'])},null,2));
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main(process.argv.slice(2)).catch(()=>{console.error(JSON.stringify({code:'BANK_CONVERSION_DIAGNOSTICS_FAILED',providerWritesOrApprovalsPerformed:false}));process.exitCode=1;});
