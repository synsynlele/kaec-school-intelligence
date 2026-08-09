"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deriveInterventionDraft,
  type FinalDiagnosisSource,
} from "@/lib/intervention/plan";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type Workspace = { id: string; name: string };
type Student = { id: string; display_name: string; class_id: string | null };
type SchoolClass = { id: string; name: string };
type Diagnosis = FinalDiagnosisSource & {
  id: string;
  workspace_id: string;
  student_id: string;
  status: string;
  academic_session: string;
  term: string;
  finalised_at: string | null;
};
type Handoff = {
  id: string;
  diagnosis_id: string;
  student_id: string;
  status: "draft" | "confirmed" | "archived";
  priority_growth_target: string;
  next_lesson_id: string | null;
  updated_at: string;
};
type State = { workspace: Workspace; students: Student[]; classes: SchoolClass[]; diagnoses: Diagnosis[]; handoffs: Handoff[] };

async function loadState(): Promise<State | null> {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("default_workspace_id").eq("id", user.id).single();
  if (profileError) throw profileError;
  if (!profile.default_workspace_id) throw new Error("Choose an active workspace before using interventions.");
  const workspaceId = profile.default_workspace_id;

  const [workspaceResult, studentsResult, classesResult, diagnosesResult, handoffsResult] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
    supabase.from("students").select("id,display_name,class_id").eq("workspace_id", workspaceId).order("display_name"),
    supabase.from("classes").select("id,name").eq("workspace_id", workspaceId).order("name"),
    supabase
      .from("diagnoses")
      .select("id,workspace_id,student_id,status,academic_session,term,finalised_at,concise_diagnosis,academic_strengths,academic_challenges,character_strengths,character_challenges,school_academic_actions,parent_academic_actions,school_character_actions,parent_character_actions,builder_growth_direction")
      .eq("workspace_id", workspaceId)
      .eq("status", "final")
      .order("finalised_at", { ascending: false }),
    supabase
      .from("intervention_handoffs")
      .select("id,diagnosis_id,student_id,status,priority_growth_target,next_lesson_id,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
  ]);
  const firstError = workspaceResult.error ?? studentsResult.error ?? classesResult.error ?? diagnosesResult.error ?? handoffsResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data) throw new Error("The active workspace could not be loaded.");
  return {
    workspace: workspaceResult.data as Workspace,
    students: (studentsResult.data ?? []) as Student[],
    classes: (classesResult.data ?? []) as SchoolClass[],
    diagnoses: (diagnosesResult.data ?? []) as Diagnosis[],
    handoffs: (handoffsResult.data ?? []) as Handoff[],
  };
}

export function InterventionWorkspaceClient() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadState()
      .then((next) => {
        if (!active) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setState(next);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Intervention workspace could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handoffByDiagnosis = useMemo(() => new Map(state?.handoffs.map((item) => [item.diagnosis_id, item]) ?? []), [state?.handoffs]);
  function studentName(id: string) { return state?.students.find((item) => item.id === id)?.display_name ?? "Student"; }
  function className(id: string) { const student = state?.students.find((item) => item.id === id); return student?.class_id ? state?.classes.find((item) => item.id === student.class_id)?.name ?? "Class not linked" : "Class not linked"; }

  async function createHandoff(diagnosis: Diagnosis) {
    if (!state) return;
    setBusy(diagnosis.id);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Sign in again.");
      const draft = deriveInterventionDraft(diagnosis);
      const { data, error } = await supabase
        .from("intervention_handoffs")
        .insert({
          workspace_id: diagnosis.workspace_id,
          diagnosis_id: diagnosis.id,
          student_id: diagnosis.student_id,
          created_by: user.id,
          status: "draft",
          priority_growth_target: draft.priorityGrowthTarget,
          evidence_basis: draft.evidenceBasis,
          school_intervention: draft.schoolIntervention as unknown as Json,
          parent_intervention: draft.parentIntervention as unknown as Json,
          timeframe: draft.timeframe,
          success_indicator: draft.successIndicator,
          review_date: draft.reviewDate,
          next_learning_adjustment: draft.nextLearningAdjustment,
        })
        .select("id")
        .single();
      if (error) throw error;
      router.push(`/interventions/result?intervention=${encodeURIComponent(data.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The intervention draft could not be created.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center px-5 text-sm text-zinc-500">Loading interventions…</div>;
  if (!state) return <main className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Intervention workspace unavailable."}</div></main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Governed improvement handoff</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Create intervention from a final diagnosis</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Choose an approved diagnosis. KSI creates one deterministic intervention draft, then opens it on its own result page for human review and confirmation.</p>
          <div className="mt-6 grid gap-3">
            {state.diagnoses.length ? state.diagnoses.map((diagnosis) => {
              const handoff = handoffByDiagnosis.get(diagnosis.id);
              return (
                <article key={diagnosis.id} className="rounded-2xl border border-zinc-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-semibold text-zinc-950">{studentName(diagnosis.student_id)}</p><p className="mt-1 text-xs text-zinc-500">{className(diagnosis.student_id)} · {diagnosis.academic_session || "Session not set"} · {diagnosis.term || "Term not set"}</p><p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">{diagnosis.concise_diagnosis}</p></div>
                    {handoff ? (
                      <Link href={`/interventions/result?intervention=${encodeURIComponent(handoff.id)}`} className="shrink-0 rounded-xl border border-emerald-900/20 px-3 py-2 text-center text-xs font-semibold text-emerald-950">Open {handoff.status === "confirmed" ? "Confirmed Plan" : handoff.status === "archived" ? "Archived Plan" : "Draft"}</Link>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => void createHandoff(diagnosis)} className="shrink-0 rounded-xl bg-emerald-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === diagnosis.id ? "Creating…" : "Create Intervention"}</button>
                    )}
                  </div>
                </article>
              );
            }) : <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">No final diagnosis is available. Review and approve a diagnosis first.</p>}
          </div>
        </section>

        <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-800">Saved work</p><h2 className="mt-1 text-xl font-semibold text-zinc-950">Interventions</h2></div><span className="text-xs text-zinc-400">{state.handoffs.length}</span></div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Draft, confirmed and archived plans each open on a dedicated result page.</p>
          <div className="mt-4 grid gap-2">{state.handoffs.length ? state.handoffs.map((handoff) => <Link key={handoff.id} href={`/interventions/result?intervention=${encodeURIComponent(handoff.id)}`} className="rounded-2xl border border-zinc-200 p-3 transition hover:bg-stone-50"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-zinc-900">{studentName(handoff.student_id)}</span><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600">{handoff.status}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{handoff.priority_growth_target}</p>{handoff.next_lesson_id ? <p className="mt-2 text-[11px] font-semibold text-emerald-800">Next HQLS linked</p> : null}</Link>) : <p className="text-sm text-zinc-500">No intervention plans yet.</p>}</div>
        </aside>
      </div>
    </main>
  );
}
