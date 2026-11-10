import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createCandidatePhoneHandler } from "../_shared/candidate-phone.mjs";

Deno.serve(createCandidatePhoneHandler({
  createClient,
  readEnvironment: (key: string) => Deno.env.get(key),
}));
