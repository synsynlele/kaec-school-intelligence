import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const auth = { persistSession: false, autoRefreshToken: false };

function json(data: unknown, status = 200) {
  return Response.json(data,{ status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length>4096) return json({error:"This roster request is too large."},413);
  const input = await Promise.resolve().then(()=>JSON.parse(raw)).catch(()=>null);
  if (typeof input?.workspace!=="string" || !uuid.test(input.workspace)) return json({error:"Choose a school workspace."},400);
  const token = request.headers.get("authorization") ?? "";
  const { url,publishableKey } = getSupabasePublicEnv();
  if (input.action==="export") {
    const key = process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
    const adminKey = process.env.KSI_SUPABASE_ADMIN_KEY?.trim();
    const expected = Buffer.from("Bearer "+key);
    const supplied = Buffer.from(token);
    if (!key || key.length<32 || !adminKey || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) {
      return json({error:"Roster connection unavailable."},403);
    }
    if ([input.classId,input.after].some(value=>value!=null && (typeof value!=="string" || !uuid.test(value)))) {
      return json({error:"Choose a valid class."},400);
    }
    const db = createClient(url,adminKey,{auth});
    const {data,error} = await db.rpc("export_khpos_roster",{p_workspace:input.workspace,p_class:input.classId??null,p_after:input.after??null});
    if (error) return json({error:error.code==="42501" ? "Ask your KSI school owner to enable roster sharing." : "Could not load the KSI roster."},error.code==="42501"?403:503);
    return json({rows:data});
  }

  if (input.action!=="settings" || (input.enabled!==undefined && typeof input.enabled!=="boolean")) return json({error:"Choose a valid roster action."},400);
  if (!token.startsWith("Bearer ")) return json({error:"Sign in to update roster sharing."},401);
  const db = createClient(url,publishableKey,{auth,global:{headers:{Authorization:token}}});
  const {data,error} = await db.rpc("manage_khpos_roster_share",{p_workspace:input.workspace,p_enabled:input.enabled??null});
  if (error) return json({error:"Only a school Owner or Admin can manage roster sharing."},403);
  return json({enabled:data});
}
