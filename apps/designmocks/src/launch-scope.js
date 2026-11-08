import{environment}from'./environment.js';
import{allowPostLaunchPreview}from'./launch-scope.mjs';
export const postLaunchPreview=allowPostLaunchPreview(environment.deployment,import.meta.env.VITE_POST_LAUNCH_PREVIEW==='true');
