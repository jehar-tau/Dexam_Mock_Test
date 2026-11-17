import{environment}from'./environment.js';
import{allowLearnSpokenFeedback,allowPostLaunchPreview}from'./launch-scope.mjs';
export const postLaunchPreview=allowPostLaunchPreview(environment.deployment,import.meta.env.VITE_POST_LAUNCH_PREVIEW==='true');
export const learnSpokenFeedback=allowLearnSpokenFeedback(postLaunchPreview);
