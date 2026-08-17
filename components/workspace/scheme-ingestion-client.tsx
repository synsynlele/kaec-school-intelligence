"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SchemeDocument = { id:string; filename:string; subject:string; education_level:string; class_scope:string[]; extraction_status:string; entries:number; pending:number; approved:number };
type Summary = { documents:number; junior_documents:number; senior_documents:number; entries:number; pending_review:number; approved_entries:number };
type ReviewEntry = { id:string; filename:string; class_level:string; term:string; week_label:string; subject:string; topic:string; learning_objectives:string[]; learning_activities:string[]; embedded_core_skills:string[]; learning_resources:string[]; source_page:number|null; review_status:"pending"|"approved"; promoted_at:string|null };
type Context = { workspaceName:string; role:string; scheme:{documents:SchemeDocument[];summary:Summary}; queue:{can_review:boolean;entries:ReviewEntry[]} };

async function loadContext(supabase: SupabaseClient): Promise<Context | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase.from("profiles").select("default_workspace_id").eq("id", session.user.id).single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) throw new Error("Choose a school workspace before opening Scheme Ingestion.");
  const workspaceId = profile.default_workspace_id as string;

  const [workspaceResult, membershipResult, schemeResult, queueResult] = await Promise.all([
    supabase.from("workspaces").select("name,workspace_type").eq("id", workspaceId).single(),
    supabase.from("workspace_members").select("role,status").eq("workspace_id", workspaceId).eq("user_id", session.user.id).single(),
    supabase.rpc("get_scheme_ingestion_intelligence", { target_workspace_id: workspaceId }),
    supabase.rpc("get_scheme_review_queue", { target_workspace_id: workspaceId }),
  ]);
  const firstError = workspaceResult.error ?? membershipResult.error ?? schemeResult.error ?? queueResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data || workspaceResult.data.workspace_type !== "school") throw new Error("Scheme Ingestion is available only in a school workspace.");
  if (!membershipResult.data || membershipResult.data.status !== "active") throw new Error("Active school membership is required.");

  return {
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role,
    scheme: schemeResult.data as Context["scheme"],
    queue: queueResult.data as Context["queue"],
  };
}

export function SchemeIngestionClient() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await loadContext(getBrowserSupabaseClient());
    if (!next) { router.replace("/sign-in"); return; }
    setContext(next);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void loadContext(getBrowserSupabaseClient())
      .then((next) => { if (!cancelled) { if (!next) router.replace("/sign-in"); else setContext(next); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Scheme Ingestion could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router]);

  async function review(entryId:string, status:"approved"|"rejected") {
    setBusyId(entryId); setError(null);
    try {
      const { error: actionError } = await getBrowserSupabaseClient().rpc("review_scheme_entry", { target_entry_id:entryId, target_status:status, target_review_note:null });
      if (actionError) throw actionError;
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Review action failed."); }
    finally { setBusyId(null); }
  }

  async function promote(entryId:string) {
    setBusyId(entryId); setError(null);
    try {
      const { error: actionError } = await getBrowserSupabaseClient().rpc("promote_scheme_entry", { target_entry_id:entryId });
      if (actionError) throw actionError;
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Promotion failed."); }
    finally { setBusyId(null); }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Scheme Ingestion…</p></main>;
  if (!context) return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Scheme Ingestion unavailable."}</div></main>;

  const { summary } = context.scheme;
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <div className="flex flex-wrap gap-4 text-sm font-semibold text-emerald-900"><Link href="/setup/curriculum">← Curriculum Intelligence</Link><Link href="/dashboard">Dashboard</Link></div>
    <section className="mt-5 rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Stage 12 · Lagos sequencing layer</p>
      <h1 className="mt-2 text-3xl font-bold">Scheme Ingestion</h1>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-emerald-50/90">Extract weekly scheme rows, verify them against the supplied source, then deliberately promote approved rows into the versioned Lagos sequence. Approval never turns a scheme row into an official NERDC curriculum objective.</p>
    </section>
    {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div> : null}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Metric label="Scheme PDFs" value={summary.documents}/><Metric label="Junior" value={summary.junior_documents}/><Metric label="Senior" value={summary.senior_documents}/><Metric label="Staged rows" value={summary.entries}/><Metric label="Pending review" value={summary.pending_review}/><Metric label="Approved" value={summary.approved_entries}/>
    </section>
    <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Source registry</p><h2 className="mt-2 text-xl font-bold text-zinc-950">Supplied scheme documents</h2></div><span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600">Role: {context.role}</span></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{context.scheme.documents.map((document) => <article key={document.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"><div className="flex flex-wrap gap-2"><Badge>{document.education_level}</Badge><Badge>{document.extraction_status}</Badge></div><h3 className="mt-3 font-bold text-zinc-950">{document.subject}</h3><p className="mt-1 break-words text-xs leading-5 text-zinc-500">{document.filename}</p><p className="mt-3 text-xs font-semibold text-zinc-600">{document.class_scope.join(" · ")}</p><p className="mt-2 text-xs text-zinc-500">{document.entries} staged · {document.pending} pending · {document.approved} approved</p></article>)}</div>
    </section>
    <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Human verification gate</p><h2 className="mt-2 text-xl font-bold text-zinc-950">Scheme review queue</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">Approval means the extracted row matches the supplied PDF. Promotion is a separate action that writes it into the Lagos sequencing graph.</p>
      <div className="mt-6 space-y-5">{context.queue.entries.length === 0 ? <div className="rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-600">No scheme rows are waiting for review.</div> : null}{context.queue.entries.map((entry) => <article key={entry.id} className="rounded-2xl border border-zinc-200 p-5"><div className="flex flex-wrap items-center gap-2"><Badge>{entry.class_level}</Badge><Badge>{entry.term}</Badge><Badge>{entry.week_label}</Badge><Badge>{entry.review_status}</Badge>{entry.promoted_at ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">promoted</span> : null}</div><h3 className="mt-4 text-lg font-bold text-zinc-950">{entry.subject}: {entry.topic}</h3><p className="mt-1 text-xs text-zinc-500">{entry.filename}{entry.source_page ? ` · page ${entry.source_page}` : ""}</p><div className="mt-4 grid gap-5 lg:grid-cols-2"><TextList title="Learning objectives" items={entry.learning_objectives}/><TextList title="Learning activities" items={entry.learning_activities}/><TextList title="Embedded core skills" items={entry.embedded_core_skills}/><TextList title="Learning resources" items={entry.learning_resources}/></div>{context.queue.can_review ? <div className="mt-5 flex flex-wrap gap-2">{entry.review_status === "pending" ? <><button disabled={busyId===entry.id} onClick={() => void review(entry.id,"approved")} className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve extraction</button><button disabled={busyId===entry.id} onClick={() => void review(entry.id,"rejected")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50">Reject</button></> : null}{entry.review_status === "approved" && !entry.promoted_at ? <button disabled={busyId===entry.id} onClick={() => void promote(entry.id)} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50">Promote to Lagos sequence</button> : null}</div> : <p className="mt-5 text-xs font-semibold text-zinc-500">Read-only. Platform curriculum review permission is required.</p>}</article>)}</div>
    </section>
  </main>;
}

function Metric({label,value}:{label:string;value:number}) { return <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p></article>; }
function Badge({children}:{children:string}) { return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">{children}</span>; }
function TextList({title,items}:{title:string;items:string[]}) { return <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">{title}</p>{items.length ? <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">{items.map((item,index)=><li key={`${title}-${index}`}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-400">Not extracted.</p>}</div>; }
