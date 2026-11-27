"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function KhposRosterSharing({workspace}:{workspace:string}) {
  const [enabled,setEnabled]=useState<boolean>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function change(next?:boolean) {
    if(busy) return;
    setBusy(true);
    setError("");
    try {
      const {data:{session}}=await getBrowserSupabaseClient().auth.getSession();
      if(!session) throw new Error("Sign in to manage sharing.");
      const response=await fetch("/api/integrations/khpos/roster",{
        method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({action:"settings",workspace,enabled:next}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error);
      setEnabled(data.enabled);
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Could not update sharing.");}
    finally {setBusy(false);}
  }
  return <section className="mt-6 space-y-3 rounded-2xl border border-emerald-200 bg-white p-4">
    <h2 className="text-lg font-bold">Share learner roster with KHP-OS</h2>
    <p className="text-sm leading-relaxed text-zinc-700">Let the paired KHP-OS school import active learners’ names, admission numbers and classes. You can turn sharing off at any time.</p>
    {enabled!==undefined && <p role="status" className="text-sm font-semibold">{enabled?"Roster sharing is on.":"Roster sharing is off."}</p>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
      onClick={()=>void change(enabled===undefined?undefined:!enabled)}>
      {busy?"Please wait…":enabled===undefined?"Check sharing settings":enabled?"Turn off sharing":"Allow roster sharing"}
    </button>
  </section>;
}
