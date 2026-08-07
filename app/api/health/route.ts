import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/env";

const EXPECTED_KSI_HOST = "zaoxfjbiizargeclnzmo.supabase.co";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: false,
        dedicatedKsiTarget: false,
        backendReachable: false,
      },
      { status: 503 },
    );
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const dedicatedKsiTarget = new URL(url).hostname === EXPECTED_KSI_HOST;

  if (!dedicatedKsiTarget) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: true,
        dedicatedKsiTarget: false,
        backendReachable: false,
      },
      { status: 503 },
    );
  }

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);

  const backendReachable = !error;

  return NextResponse.json(
    {
      ok: dedicatedKsiTarget && backendReachable,
      supabaseConfigured: true,
      dedicatedKsiTarget,
      backendReachable,
    },
    { status: backendReachable ? 200 : 503 },
  );
}
