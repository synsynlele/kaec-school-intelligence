import { randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

type Mapping = {
  workspace_id: string;
  school_id: string;
  campus_id: string;
  source_class_id: string;
  destination_class_id: string;
  term_id: string;
};
type Job = Mapping & {
  id: string; actor_id: string; revision: string; next_run: string;
  after_id: string | null; review_count: number;
};
type Page = { results: {result: string}[]; after: string | null };

export function rosterServiceClient() {
  const url=getSupabasePublicEnv().url;
  const key=process.env.KSI_SUPABASE_ADMIN_KEY;
  if(!url || !key) throw new Error("Roster database is unavailable.");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function rosterSchedule(mapping:Mapping, actor:string, enabled?:boolean) {
  const db=rosterServiceClient();
  const table=db.from("learner_roster_sync_jobs");
  const scope={workspace_id:mapping.workspace_id,destination_class_id:mapping.destination_class_id};
  if(enabled===true) {
    const fields={...mapping,actor_id:actor,enabled,next_run:new Date().toISOString(),revision:randomUUID(),
      after_id:null,review_count:0,last_status:"Scheduled"};
    const {error}=await table.upsert(fields,{onConflict:Object.keys(scope).join(",")});
    if(error) throw error;
  }
  if(enabled===false) {
    const {error}=await table.update({enabled:false,revision:randomUUID(),last_status:"Paused"}).match(scope);
    if(error) throw error;
  }
  const {data,error}=await table.select("enabled,last_run,last_status,review_count").match(scope).maybeSingle();
  if(error) throw error;
  return data;
}

export async function runRosterSchedules(request:Request, importPage:(job:Job)=>Promise<Page>) {
  const secret=process.env.CRON_SECRET?.trim();
  const expected=Buffer.from("Bearer "+secret);
  const supplied=Buffer.from(request.headers.get("authorization")??"");
  if(!secret || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) {
    return Response.json({error:"Unauthorized"}, {status:401});
  }

  const db=rosterServiceClient();
  const deadline=Date.now()+42_000;
  const cutoff=new Date().toISOString();
  let attempted=0;
  let failed=0;
  while(Date.now()<deadline) {
    const {data,error}=await db.from("learner_roster_sync_jobs").select("*").eq("enabled",true)
      .lte("next_run",cutoff).order("next_run").order("id").limit(8);
    if(error) return Response.json({error:"Could not load due roster schedules."},{status:503});
    const jobs=data as Job[];
    if(!jobs.length) break;
    const handled=await Promise.all(jobs.map(async job=>{
      const lease=new Date(Date.now()+120_000).toISOString();
      const {data:claimed,error:claimError}=await db.from("learner_roster_sync_jobs").update({next_run:lease})
        .eq("id",job.id).eq("revision",job.revision).eq("next_run",job.next_run).select("id").maybeSingle();
      if(claimError) return false;
      if(!claimed) return true;
      attempted++;
      let after=job.after_id;
      let review=after?job.review_count:0;
      let status="Completed";
      try {
        do {
          const page=await importPage({...job,after_id:after});
          review+=page.results.filter(row=>row.result==="review").length;
          after=page.after;
        } while(after && Date.now()<deadline);
        if(after) status="More learners queued";
      } catch {
        failed++;
        status="Sync failed. Check sharing, class and term.";
      }
      const nextRun=new Date(Date.now()+60*60*1000).toISOString();
      const {error:updateError}=await db.from("learner_roster_sync_jobs")
        .update({next_run:nextRun,after_id:after,last_run:new Date().toISOString(),last_status:status,review_count:review})
        .eq("id",job.id).eq("revision",job.revision).eq("next_run",lease);
      return !updateError;
    }));
    if(handled.includes(false)) return Response.json({error:"Could not record a roster run."},{status:503});
  }
  return Response.json({attempted,failed},{headers:{"Cache-Control":"no-store"}});
}

type SourceSelection = {workspace:string; school?:string; campus?:string; classId?:string; term?:string; after?:string|null};

export async function fetchRosterPage({school,...selection}:SourceSelection) {
  const key=process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
  if(!key || key.length<32) throw new Error("Roster bridge unavailable.");
  const endpoint=new URL("/api/khpos/ops/learner-roster/"+school,process.env.KHPOS_ROSTER_ORIGIN || "https://schools.intelps.cloud");
  if(endpoint.protocol!=="https:") throw new Error("HTTPS required.");
  return fetch(endpoint,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),
    headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({action:"export",...selection}),
  });
}
