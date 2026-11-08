import { createClient } from "@supabase/supabase-js";
import { environment } from "./environment.js";
import { resolveAuthConfiguration } from "./authConfiguration.mjs";
import { project_ref, staging_frontend_origin } from "../supabase/project.json";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// This app must have its own provider project; no Dexam values are imported.
export const termsVersion = import.meta.env.VITE_TERMS_VERSION;
export const { authReady, portalReady, testLoginMode, stagingPortalMode, checkoutReady } = resolveAuthConfiguration({
  mode: environment.mode,
  deployment: environment.deployment,
  origin: window.location.origin,
  stagingTarget: { url: `https://${project_ref}.supabase.co`, origin: staging_frontend_origin },
  portalEnabled: import.meta.env.VITE_PORTAL_ENABLED === "true",
  testLoginEnabled: import.meta.env.VITE_TEST_LOGIN_ENABLED === "true",
  stagingPortalEnabled: import.meta.env.VITE_STAGING_PORTAL_ENABLED === "true",
  url,
  key,
  termsVersion,
});
export const platform = authReady
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
export async function googleLogin() {
  if (!platform)
    throw new Error(
      "Student sign-in is not active in this preview. The sample is open to explore.",
    );
  const { error } = await platform.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/account/callback",
      scopes: "openid email profile",
    },
  });
  if (error) throw error;
}
let checkoutScript;
async function razorpay() {
  if (window.Razorpay) return window.Razorpay;
  checkoutScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () =>
      window.Razorpay
        ? resolve(window.Razorpay)
        : reject(new Error("Payment window did not load."));
    script.onerror = () => {
      checkoutScript = null;
      reject(new Error("Could not load Razorpay. Please try again."));
    };
    document.head.append(script);
  });
  return checkoutScript;
}
export async function beginCheckout(onState) {
  if (!platform || !checkoutReady)
    throw new Error(
      "Payments are not active in this preview. No charge has been made.",
    );
  const { data, error } = await platform.functions.invoke("create-order", {
    body: { plan: "annual" },
  });
  if (error || !data?.orderId)
    throw new Error(
      data?.error || "Checkout is not available yet. No charge has been made.",
    );
  const Razorpay = await razorpay();
  new Razorpay({
    key: data.keyId,
    order_id: data.orderId,
    amount: data.amount,
    currency: data.currency,
    name: "DMocks",
    description: "One year of mock-test access",
    theme: { color: "#244735" },
    handler: () => onState("verifying"),
    modal: { ondismiss: () => onState("dismissed") },
  }).open();
  // A client checkout callback never grants access. Read the server entitlement.
}
