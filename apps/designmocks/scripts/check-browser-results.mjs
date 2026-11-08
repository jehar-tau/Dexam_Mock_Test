import{readFileSync}from'node:fs';
import{resolve}from'node:path';
import{fileURLToPath}from'node:url';

export function requireCompleteBrowserPass(report){
 const reject=()=>{throw new Error('Browser checks require a complete pass with no failures, skipped cases or retries.');};
 if(!report||!report.stats||!Array.isArray(report.suites)||!Array.isArray(report.errors)||report.errors.length)reject();
 const stats=report.stats;
 if(!Number.isSafeInteger(stats.expected)||stats.expected<1||!['unexpected','flaky','skipped'].every(key=>stats[key]===0))reject();
 const tests=[];
 function collect(suites){for(const suite of suites){const nested=suite?.suites===undefined?[]:suite.suites;if(!suite||!Array.isArray(suite.specs)||!Array.isArray(nested))reject();for(const spec of suite.specs){if(!Array.isArray(spec.tests))reject();tests.push(...spec.tests);}collect(nested);}}
 collect(report.suites);
 if(tests.length!==stats.expected||tests.some(item=>!item||item.expectedStatus!=='passed'||item.status!=='expected'||!Array.isArray(item.results)||item.results.length!==1||item.results[0].status!=='passed'||item.results[0].retry!==0))reject();
 return tests.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const report=JSON.parse(readFileSync(new URL('../test-results/browser-results.json',import.meta.url),'utf8')),count=requireCompleteBrowserPass(report);console.log(`PASS: ${count} browser journeys; no failures, skips or retries.`);}
 catch{console.error('Browser checks require a complete JSON result with no failures, skipped cases or retries.');process.exitCode=1;}
}
