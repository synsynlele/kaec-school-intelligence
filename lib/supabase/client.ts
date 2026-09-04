"use client";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database, KsiSupabaseClient } from "@/lib/supabase/database";
import { createResilientSupabaseFetch } from "@/lib/supabase/resilient-fetch";

let browserClient: KsiSupabaseClient | undefined;

export function getBrowserSupabaseClient(): KsiSupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey } = getSupabasePublicEnv();

  browserClient = createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    global: {
      fetch: createResilientSupabaseFetch(),
    },
  });

  return browserClient;
}
