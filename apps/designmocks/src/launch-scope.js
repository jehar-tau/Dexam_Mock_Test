import{environment}from'./environment.js';
import{allowPostLaunchPreview,releasedStudentModules}from'./launch-scope.mjs';
export const postLaunchPreview=allowPostLaunchPreview(environment.deployment,import.meta.env.VITE_POST_LAUNCH_PREVIEW==='true');
const released=new Set(releasedStudentModules(import.meta.env.VITE_RELEASED_STUDENT_MODULES));
export const studentModuleReleased=module=>postLaunchPreview||released.has(module);
export const releasedStudentModuleNames=Object.freeze([...released]);
