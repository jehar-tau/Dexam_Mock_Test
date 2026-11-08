import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createOrderHandler } from "../_shared/create-order.mjs";

Deno.serve(createOrderHandler({
  createClient,
  readEnvironment: (key: string) => Deno.env.get(key),
}));
