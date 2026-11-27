import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const key = process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + key);
  if (!key || key.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json(null, { status: 403, headers });
  }
  const raw = await request.text();
  if (raw.length > 1024) return Response.json(null, { status: 413, headers });
  const input = await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null);
  if (typeof input?.workspace !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.workspace) ||
      typeof input.code !== "string" || !/^[js][123]$/.test(input.code) ||
      !Number.isSafeInteger(input.minimum) || input.minimum < 0 || input.minimum > 999999999999) {
    return Response.json(null, { status: 400, headers });
  }
  const adminKey = process.env.KSI_SUPABASE_ADMIN_KEY?.trim();
  if (!adminKey) return Response.json(null, { status: 503, headers });
  const db = createClient(getSupabasePublicEnv().url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("reserve_school_admission_number", {
    p_workspace: input.workspace, p_class_code: input.code, p_minimum: input.minimum,
  });
  return Response.json(error ? null : { number: data }, { status: error ? 503 : 200, headers });
}
