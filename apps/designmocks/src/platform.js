import { createClient } from "@supabase/supabase-js";
import { validatePortalConfiguration } from "./environment.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// This app must have its own provider project; no Dexam values are imported.
export const termsVersion = import.meta.env.VITE_TERMS_VERSION;
export const portalReady = validatePortalConfiguration({
  enabled: import.meta.env.VITE_PORTAL_ENABLED === "true",
  url,
  key,
  termsVersion,
});
export const platform = portalReady
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
      scopes: "email profile",
    },
  });
  if (error) throw error;
}
export async function loadDashboard() {
  if (!platform) return { attempts: [], access: null };
  const [attempts, access] = await Promise.all([
    platform.rpc("my_attempt_history"),
    platform.rpc("my_pass"),
  ]);
  if (attempts.error) throw attempts.error;
  if (access.error) throw access.error;
  return { attempts: attempts.data ?? [], access: access.data };
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
  if (!platform)
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
