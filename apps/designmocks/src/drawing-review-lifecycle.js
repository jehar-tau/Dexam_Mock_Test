import {isAdminAccessFailure} from "./admin-access.js";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function drawingReviewPage(data) {
  const {items, nextCursor} = data ?? {};
  if (!Array.isArray(items) || items.length > 20 || items.some(item =>
    typeof item?.reviewId !== "string" || !uuid.test(item.reviewId) ||
    !Number.isInteger(item.version) || item.version < 0) ||
    new Set(items.map(item => item.reviewId)).size !== items.length ||
    (nextCursor !== null && (typeof nextCursor !== "string" || nextCursor !== items.at(-1)?.reviewId))) {
    throw new Error("Unconfirmed drawing review page.");
  }
  return {items, nextCursor};
}

const ended=()=>Object.assign(new Error("This drawing review page is no longer current."),{name:"AbortError"});
const unavailableMessages=new Set(["Review unavailable","Review assignment changed. Refresh the queue.","Review changed. Refresh the queue.",
  "Only an administrator can revise a released grade","Claim this review before grading","Claim the review before opening student work","Review is assigned to another teacher"]);
export const isDrawingReviewUnavailable=error=>isAdminAccessFailure(error)||error?.code==="P0001"&&unavailableMessages.has(error?.message);

// Every outcome retains its exact read generation, including rejected reads.
// A denied submission invalidates queued pages while leaving other work usable.
export function createDrawingReviewRequests(isParentCurrent){
  const lifetime=new AbortController();let generation=0,request=null;
  const current=()=>!lifetime.signal.aborted&&isParentCurrent();
  function assertCurrent(){if(!current())throw ended();}
  function invalidateReads(){generation++;request?.abort();request=null;}
  async function read(operation){
    assertCurrent();invalidateReads();const token=generation,controller=new AbortController();request=controller;
    const signal=AbortSignal.any([lifetime.signal,controller.signal]);
    const active=()=>current()&&!signal.aborted&&token===generation&&request===controller;
    try{return {data:await operation(signal),error:null,current:active};}
    catch(error){return{data:null,error,current:active};}
  }
  function dispose(){invalidateReads();lifetime.abort();}
  return Object.freeze({read,invalidateReads,assertCurrent,isCurrent:current,dispose,signal:lifetime.signal});
}
