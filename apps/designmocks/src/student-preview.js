import { staging_frontend_origin } from "../supabase/project.json";

// Site access is enforced by the host. The origin check prevents review routes
// from activating if this static build is copied to a different site.
export const hostedStudentPreview = __DMOCKS_STAGING_REVIEW_PREVIEW__ &&
  !import.meta.env.SSR && window.location.origin === staging_frontend_origin;
export const studentPreview = import.meta.env.DEV || hostedStudentPreview;
