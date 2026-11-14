import {pathToFileURL} from "node:url";
import {openOperationsProvider, operationsConfiguration, readOperationsHealth} from "./operations-sweep.mjs";
import project from "../supabase/project.json" with {type: "json"};

export async function recoverStagingQuestionJobs(config, {fetchImpl = fetch} = {}) {
  if (config.environment !== "staging" || config.url !== `https://${project.project_ref}.supabase.co`) {
    throw new Error("Use the designated private DMocks staging project");
  }
  const {rpc, expectedPaymentMode} = openOperationsProvider(config, {fetchImpl});
  const health = await readOperationsHealth(rpc, {requireMonitor: true});
  if (health.paymentMode !== expectedPaymentMode) throw new Error("Staging must be in Test mode");

  const limit = 100;
  const result = await rpc("recover_expired_question_jobs", {p_limit: limit});
  const counts = [result?.intake, result?.aiDrafts];
  if (counts.some(count => !Number.isInteger(count) || count < 0 || count > limit)) {
    throw new Error("Could not verify the question job recovery counts");
  }
  return {scope: "staging-question-job-recovery", intake: counts[0], aiDrafts: counts[1], limitReached: counts.includes(limit)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await recoverStagingQuestionJobs(operationsConfiguration(process.env))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
