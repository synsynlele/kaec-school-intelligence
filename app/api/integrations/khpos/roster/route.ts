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

  if (input.action==="khposClasses" || input.action==="importKhpos") {
    if (!token.startsWith("Bearer ")) return json({error:"Sign in to import learners."},401);
    const db=createClient(url,publishableKey,{auth,global:{headers:{Authorization:token}}});
    const {error:roleError}=await db.rpc("manage_khpos_roster_share",{p_workspace:input.workspace,p_enabled:null});
    if (roleError) return json({error:"Only a school Owner or Admin can import learners."},403);
    const importing=input.action==="importKhpos";
    const required=importing?[input.school,input.campus,input.sourceClass,input.term,input.classId]:[input.school];
    if(required.some(value=>typeof value!=="string" || !uuid.test(value)) ||
      (input.after!=null && (typeof input.after!=="string" || !uuid.test(input.after)))) {
      return json({error:"Check the school ID and select a class and term."},400);
    }
    const key=process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
    if(!key || key.length<32) return json({error:"The KHP-OS roster connection is unavailable."},503);
    try {
      const endpoint=new URL("/api/khpos/ops/learner-roster/"+input.school,
        process.env.KHPOS_ROSTER_ORIGIN || "https://schools.intelps.cloud");
      if(endpoint.protocol!=="https:") throw new Error("HTTPS required");
      const response=await fetch(endpoint,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),
        headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
        body:JSON.stringify({action:"export",workspace:input.workspace,
          ...(importing?{campus:input.campus,classId:input.sourceClass,term:input.term,after:input.after}:{}),
        }),
      });
      if(!response.ok) return json({error:response.status===403
        ?"Check the school ID and enable campus sharing in KHP-OS."
        :"Could not load the KHP-OS roster."},response.status===403?403:503);
      const {rows}=await response.json();
      if(!importing) return json({classes:rows});
      if(!Array.isArray(rows?.learners) || rows.learners.length>50) throw new Error("Invalid roster");
      const {data,error}=await db.rpc("import_khpos_roster",{p_workspace:input.workspace,p_school:input.school,
        p_class:input.classId,p_session:rows.session,p_rows:rows.learners});
      if(error) return json({error:error.code==="22023" ? error.message : "Could not import the selected roster."},400);
      return json({results:data,after:rows.learners.length===50?rows.learners[49].id:null});
    } catch {
      return json({error:"Could not connect to KHP-OS. Try again."},503);
    }
  }

  if (input.action!=="settings" || (input.enabled!==undefined && typeof input.enabled!=="boolean")) return json({error:"Choose a valid roster action."},400);
  if (!token.startsWith("Bearer ")) return json({error:"Sign in to update roster sharing."},401);
  const db = createClient(url,publishableKey,{auth,global:{headers:{Authorization:token}}});
  const {data,error} = await db.rpc("manage_khpos_roster_share",{p_workspace:input.workspace,p_enabled:input.enabled??null});
  if (error) return json({error:"Only a school Owner or Admin can manage roster sharing."},403);
  return json({enabled:data});
}
