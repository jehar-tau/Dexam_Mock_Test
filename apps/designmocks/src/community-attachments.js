import {checkCommunityFiles} from "./community-media.js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const failed=message=>{throw new Error(message);};
export function communityAttachmentFiles(files) {
  if(!Array.isArray(files)||!files.length)return "Choose at least one image to add.";
  return checkCommunityFiles(files);
}
export function communityAttachmentPlan(scope,target,files) {
  const invalid=communityAttachmentFiles(files);if(invalid)return failed(invalid);
  if(!scope||!target||!["post","comment"].includes(target.targetType)||
   typeof target.targetId!=="string"||!uuid.test(target.targetId)||typeof target.postId!=="string"||!uuid.test(target.postId)||
   scope.targetType!==target.targetType||scope.targetId!==target.targetId||scope.postId!==target.postId||scope.maximum!==3||
   !Array.isArray(scope.occupiedOrdinals)||scope.occupiedOrdinals.length>3||new Set(scope.occupiedOrdinals).size!==scope.occupiedOrdinals.length||
   scope.occupiedOrdinals.some(ordinal=>!Number.isInteger(ordinal)||ordinal<1||ordinal>3))return failed("Refresh the discussion before adding images.");
  const free=[1,2,3].filter(ordinal=>!scope.occupiedOrdinals.includes(ordinal));
  if(files.length>free.length)return failed(free.length?`Only ${free.length} more ${free.length===1?"image can":"images can"} be added. Refresh the discussion to check them.`:"This item already has three images. Refresh the discussion to view them.");
  return {targetType:target.targetType,targetId:target.targetId,postId:target.postId,files:Object.freeze(files.slice()),ordinals:Object.freeze(free.slice(0,files.length)),next:0,followUp:true};
}
