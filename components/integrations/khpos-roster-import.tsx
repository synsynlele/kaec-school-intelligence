"use client";

import { useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Choice = { id: string; campus: string; name: string; term: string; session: string; termName: string };
type Result = { result: "synced" | "review"; name?: string; admission?: string; message?: string };
type Destination = { id: string; name: string; academic_session: string | null; active: boolean };

export function KhposRosterImport({workspace,classes,refresh}: {
  workspace: string; classes: Destination[]; refresh: () => Promise<void>;
}) {
  const [school,setSchool]=useState("");
  const [choices,setChoices]=useState<Choice[]>();
  const [source,setSource]=useState("");
  const [operation,setOperation]=useState("manual");
  const [destination,setDestination]=useState("");
  const [busy,setBusy]=useState(false);
  const [scheduleMessage,setScheduleMessage]=useState("");
  const [error,setError]=useState("");
  const [count,setCount]=useState<number>();
  const [review,setReview]=useState<Result[]>([]);
  const control="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900";
  const button="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50";

  async function request(input:object) {
    const {data:{session}}=await getBrowserSupabaseClient().auth.getSession();
    if(!session) throw new Error("Sign in to import learners.");
    const response=await fetch("/api/integrations/khpos/roster",{
      method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
      body:JSON.stringify({workspace,school:school.trim(),...input}),
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error);
    return data;
  }

  async function load() {
    setBusy(true);setError("");setCount(undefined);setReview([]);setSource("");
    try {setChoices((await request({action:"khposClasses"})).classes);}
    catch(cause) {setError(cause instanceof Error?cause.message:"Could not load classes.");}
    finally {setBusy(false);}
  }

  async function importClass(event:FormEvent) {
    event.preventDefault();
    const choice=choices?.find(item=>item.id+"/"+item.term===source);
    if(busy || !choice || !destination) return;
    setBusy(true);setError("");setCount(undefined);setReview([]);setScheduleMessage("");
    if(operation!=="manual") {
      try {
        const {schedule}=await request({action:"scheduleKhpos",campus:choice.campus,term:choice.term,
          sourceClass:choice.id,classId:destination,enabled:operation==="check"?undefined:operation==="enable"});
        setScheduleMessage(schedule ? [schedule.enabled?"Daily sync is on.":"Daily sync is paused.",schedule.last_status,
              schedule.last_run?"Last run "+new Date(schedule.last_run).toLocaleString():null,
              schedule.review_count?schedule.review_count+" to review. Run a manual import for details.":null].filter(Boolean).join(" ")
              : "Daily sync has yet to be set up for this class.");
      } catch(cause) {
        setError(cause instanceof Error?cause.message:"Could not manage daily sync.");
      } finally {setBusy(false);}
      return;
    }
    let synced=0;
    let after:string|null=null;
    const conflicts:Result[]=[];
    try {
      do {
        const page=await request({action:"importKhpos",campus:choice.campus,term:choice.term,
          sourceClass:choice.id,classId:destination,after}) as {results:Result[];after:string|null};
        synced+=page.results.filter(item=>item.result==="synced").length;
        conflicts.push(...page.results.filter(item=>item.result==="review"));
        after=page.after;
      } while(after);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Import stopped. Retry to continue.");
    } finally {
      setCount(synced);setReview(conflicts);setBusy(false);
      if(synced) await refresh();
    }
  }

  return <section className="mt-6 space-y-3 rounded-2xl border border-emerald-200 bg-white p-4">
    <h2 className="text-lg font-bold">Import learners from KHP-OS</h2>
    <p className="text-sm text-zinc-700">Enable campus sharing under Learners in KHP-OS, then copy the school ID shown there. Import one class and term at a time.</p>
    <label className="block space-y-1 text-sm font-semibold">KHP-OS school ID
      <input className={control} value={school} disabled={busy} onChange={event=>{
        setSchool(event.target.value);setChoices(undefined);setCount(undefined);setReview([]);setError("");
      }} />
    </label>
    <button className={button} type="button" disabled={busy || !school.trim()} onClick={()=>void load()}>
      {busy?"Please wait…":"Load shared classes"}
    </button>
    {choices?.length===0 && <p className="text-sm">No shared classes with an available term were found.</p>}
    {!!choices?.length && <form className="space-y-3" onSubmit={importClass}>
      <label className="block space-y-1 text-sm font-semibold">KHP-OS class and term
        <select className={control} required value={source} disabled={busy} onChange={event=>setSource(event.target.value)}>
          <option value="">Choose class and term</option>
          {choices.map(item=><option key={item.id+"/"+item.term} value={item.id+"/"+item.term}>
            {[item.name,item.termName,item.session,"Campus "+item.campus.slice(0,8)].join(" · ")}
          </option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-semibold">KSI class
        <select className={control} required value={destination} disabled={busy} onChange={event=>setDestination(event.target.value)}>
          <option value="">Choose KSI class</option>
          {classes.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>
            {[item.name,item.academic_session].filter(Boolean).join(" · ")}
          </option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-semibold">What would you like to do?
        <select className={control} value={operation} disabled={busy} onChange={event=>setOperation(event.target.value)}>
          <option value="manual">Import now</option>
          <option value="check">Check daily sync status</option>
          <option value="enable">Enable daily sync</option>
          <option value="pause">Pause daily sync</option>
        </select>
      </label>
      <button className={button} disabled={busy || !source || !destination}>{busy?"Working…":"Continue"}</button>
    </form>}
      {scheduleMessage && <p role="status" className="text-sm font-semibold">{scheduleMessage}</p>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    {count!==undefined && <p role="status" className="text-sm font-semibold">{count} imported or matched · {review.length} to review</p>}
    {!!review.length && <ul className="max-h-64 space-y-2 overflow-auto">
      {review.map((item,index)=><li key={index} className="break-words rounded-lg border p-2 text-sm">
        <strong>{[item.name,item.admission].filter(Boolean).join(" · ") || "Learner record"}</strong> {item.message}
      </li>)}
    </ul>}
  </section>;
}
