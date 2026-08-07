"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey } = getSupabasePublicEnv();

  browserClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}
