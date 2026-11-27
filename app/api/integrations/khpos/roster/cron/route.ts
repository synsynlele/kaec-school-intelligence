import { fetchRosterPage, rosterServiceClient, runRosterSchedules } from "@/lib/integrations/roster-schedule";

export const maxDuration=60;
export const dynamic="force-dynamic";

export async function GET(request:Request) {
  return runRosterSchedules(request,async job=>{
    const response=await fetchRosterPage({workspace:job.workspace_id,classId:job.source_class_id,after:job.after_id
      ,school:job.school_id,campus:job.campus_id,term:job.term_id
    });
    if(!response.ok) throw new Error("Sharing unavailable.");
    const {rows}=await response.json();
    if(!Array.isArray(rows?.learners) || rows.learners.length>50 || typeof rows.session!=="string") {
      throw new Error("Invalid roster page.");
    }
    const {data,error}=await rosterServiceClient().rpc("run_khpos_roster_sync_page",{
      p_job:job.id,p_revision:job.revision,p_session:rows.session,p_rows:rows.learners,
    });
    if(error || !Array.isArray(data)) throw new Error("Could not import roster.");
    return {results:data,after:rows.learners.length===50?rows.learners[49].id:null};
  });
}
