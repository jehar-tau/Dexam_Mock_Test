import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createPaymentWebhookHandler } from "../_shared/payment-webhook.mjs";

Deno.serve(createPaymentWebhookHandler({
  createClient,
  readEnvironment: (key: string) => Deno.env.get(key),
}));
