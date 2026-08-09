"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { InterventionAction } from "@/lib/intervention/plan";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type Handoff = {
  id: string;
  workspace_id: string;
  diagnosis_id: string;
  student_id: string;
  status: "draft" | "confirmed" | "archived";
  priority_growth_target: string;
  evidence_basis: string;
  school_intervention: unknown;
  parent_intervention: unknown;
  timeframe: string;
  success_indicator: string;
  review_date: string | null;
  next_learning_adjustment: string;
  confirmed_at: string | null;
  next_lesson_id: string | null;
  updated_at: string;
};

type Editor = {
  priorityGrowthTarget: string;
  evidenceBasis: string;
  schoolIntervention: InterventionAction[];
  parentIntervention: InterventionAction[];
  timeframe: string;
  successIndicator: string;
  reviewDate: string;
  nextLearningAdjustment: string;
};

type State = {
  workspaceName: string;
  canManage: boolean;
  studentName: string;
  className: string;
  diagnosisSummary: string;
  handoff: Handoff;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseActions(value: unknown): InterventionAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = record(item);
      if (!row || typeof row.action !== "string" || !row.action.trim()) return null;
      return {
        domain: row.domain === "skill" || row.domain === "character" ? row.domain : "academic",
        action: row.action.trim(),
        timeframe: typeof row.timeframe === "string" ? row.timeframe : "",
        evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds.filter((id): id is string => typeof id === "string") : [],
      } satisfies InterventionAction;
    })
    .filter((item): item is InterventionAction => Boolean(item));
}

function editorFromHandoff(handoff: Handoff): Editor {
  return {
    priorityGrowthTarget: handoff.priority_growth_target,
    evidenceBasis: handoff.evidence_basis,
    schoolIntervention: parseActions(handoff.school_intervention),
    parentIntervention: parseActions(handoff.parent_intervention),
    timeframe: handoff.timeframe,
    successIndicator: handoff.success_indicator,
    reviewDate: handoff.review_date ?? "",
    nextLearningAdjustment: handoff.next_learning_adjustment,
  };
}

function dateLabel(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function InterventionResultClient({ interventionId }: { interventionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const authenticatedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const supabase = getBrowserSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");
    return fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` } });
  }, []);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("default_workspace_id").eq("id", user.id).single();
    if (profileError) throw profileError;
    if (!profile.default_workspace_id) throw new Error("Choose an active workspace before opening this intervention.");
    const workspaceId = profile.default_workspace_id;

    const [workspaceResult, membershipResult, handoffResult] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
      supabase.from("workspace_members").select("role,status").eq("workspace_id", workspaceId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
      supabase.from("intervention_handoffs").select("*").eq("workspace_id", workspaceId).eq("id", interventionId).single(),
    ]);
    const firstError = workspaceResult.error ?? membershipResult.error ?? handoffResult.error;
    if (firstError) throw firstError;
    if (!workspaceResult.data || !handoffResult.data) throw new Error("This intervention is unavailable in the active workspace.");
    const handoff = handoffResult.data as Handoff;

    const [studentResult, diagnosisResult] = await Promise.all([
      supabase.from("students").select("display_name,class_id").eq("workspace_id", workspaceId).eq("id", handoff.student_id).maybeSingle(),
      supabase.from("diagnoses").select("concise_diagnosis").eq("workspace_id", workspaceId).eq("id", handoff.diagnosis_id).maybeSingle(),
    ]);
    if (studentResult.error) throw studentResult.error;
    if (diagnosisResult.error) throw diagnosisResult.error;
    let className = "Class not linked";
    if (studentResult.data?.class_id) {
      const { data } = await supabase.from("classes").select("name").eq("workspace_id", workspaceId).eq("id", studentResult.data.class_id).maybeSingle();
      if (data?.name) className = data.name;
    }

    const nextState: State = {
      workspaceName: workspaceResult.data.name,
      canManage: Boolean(membershipResult.data && ["owner", "admin"].includes(membershipResult.data.role)),
      studentName: studentResult.data?.display_name || "Student",
      className,
      diagnosisSummary: diagnosisResult.data?.concise_diagnosis || "Approved diagnosis source",
      handoff,
    };
    setState(nextState);
    setEditor(editorFromHandoff(handoff));
  }, [interventionId, router]);

  useEffect(() => {
    let active = true;
    void load()
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "The intervention could not be opened.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function save(confirm = false) {
    if (!state || !editor || state.handoff.status !== "draft") return;
    setBusy(confirm ? "confirm" : "save");
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase
        .from("intervention_handoffs")
        .update({
          priority_growth_target: editor.priorityGrowthTarget.trim(),
          evidence_basis: editor.evidenceBasis.trim(),
          school_intervention: editor.schoolIntervention as unknown as Json,
          parent_intervention: editor.parentIntervention as unknown as Json,
          timeframe: editor.timeframe.trim(),
          success_indicator: editor.successIndicator.trim(),
          review_date: editor.reviewDate || null,
          next_learning_adjustment: editor.nextLearningAdjustment.trim(),
          ...(confirm ? { status: "confirmed" } : {}),
        })
        .eq("id", state.handoff.id)
        .eq("workspace_id", state.handoff.workspace_id);
      if (error) throw error;
      await load();
      setNotice(confirm ? "Intervention confirmed and locked. It is ready to guide the next HQLS lesson." : "Intervention changes saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The intervention could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function manage(action: "archive" | "delete") {
    if (!state) return;
    if (action === "archive") {
      const confirmed = window.confirm("Archive this intervention? It will leave active work but remain available as history.");
      if (!confirmed) return;
    }
    let confirmation: string | undefined;
    if (action === "delete") {
      confirmation = window.prompt("Permanent deletion cannot be undone. Type DELETE to continue.") ?? undefined;
      if (confirmation !== "DELETE") return;
    }
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api/interventions/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId: state.handoff.id, action, confirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The intervention management action could not be completed.");
      if (action === "delete") {
        router.push("/interventions");
        return;
      }
      await load();
      setNotice("Intervention archived. Its diagnosis and linked-lesson provenance remain intact.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The intervention management action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  function updateAction(owner: "schoolIntervention" | "parentIntervention", index: number, patch: Partial<InterventionAction>) {
    setEditor((current) => current ? { ...current, [owner]: current[owner].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center px-5 text-sm text-zinc-500">Opening intervention…</div>;
  if (!state || !editor) return <main className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Intervention unavailable."}</div></main>;

  const readOnly = state.handoff.status !== "draft";
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div> : null}

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-900">{state.handoff.status}</span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Action & Intervention Result</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{state.studentName}</h1>
            <p className="mt-2 text-sm text-zinc-600">{state.className} · {state.workspaceName}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap md:justify-end">
            <Link href={`/diagnosis/result?diagnosis=${encodeURIComponent(state.handoff.diagnosis_id)}`} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-center text-sm font-semibold text-blue-900">Open Source Diagnosis</Link>
            {state.handoff.next_lesson_id ? (
              <Link href={`/hqls/result?lesson=${encodeURIComponent(state.handoff.next_lesson_id)}`} className="min-h-11 rounded-xl bg-emerald-950 px-4 py-2.5 text-center text-sm font-semibold text-white">Open Linked HQLS Lesson</Link>
            ) : state.handoff.status === "confirmed" ? (
              <Link href="/interventions/next-lesson" className="min-h-11 rounded-xl bg-emerald-950 px-4 py-2.5 text-center text-sm font-semibold text-white">Build Next HQLS Lesson</Link>
            ) : null}
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-[#ddd4b7] bg-[#f8f4e8] p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-950">Approved diagnosis baseline</p><p className="mt-2 text-sm leading-6 text-zinc-700">{state.diagnosisSummary}</p></div>
      </section>

      <section className="mt-5 rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
        <TextArea label="Priority Growth Target" readOnly={readOnly} value={editor.priorityGrowthTarget} onChange={(value) => setEditor({ ...editor, priorityGrowthTarget: value })} />
        <TextArea label="Evidence Basis" readOnly={readOnly} value={editor.evidenceBasis} onChange={(value) => setEditor({ ...editor, evidenceBasis: value })} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2"><ActionList title="School Intervention" items={editor.schoolIntervention} readOnly={readOnly} onChange={(index, patch) => updateAction("schoolIntervention", index, patch)} /><ActionList title="Parent Intervention" items={editor.parentIntervention} readOnly={readOnly} onChange={(index, patch) => updateAction("parentIntervention", index, patch)} /></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Overall Timeframe"><input readOnly={readOnly} value={editor.timeframe} onChange={(event) => setEditor({ ...editor, timeframe: event.target.value })} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm read-only:bg-stone-50" /></Field><Field label="Review Date / Checkpoint"><input readOnly={readOnly} type="date" value={editor.reviewDate} onChange={(event) => setEditor({ ...editor, reviewDate: event.target.value })} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm read-only:bg-stone-50" /></Field></div>
        <TextArea label="Success Indicator" readOnly={readOnly} value={editor.successIndicator} onChange={(value) => setEditor({ ...editor, successIndicator: value })} />
        <TextArea label="Next Learning Adjustment" readOnly={readOnly} value={editor.nextLearningAdjustment} onChange={(value) => setEditor({ ...editor, nextLearningAdjustment: value })} />
      </section>

      <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {state.handoff.status === "draft" ? <><button type="button" disabled={busy !== null} onClick={() => void save(false)} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy === "save" ? "Saving…" : "Save Changes"}</button><button type="button" disabled={busy !== null} onClick={() => void save(true)} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "confirm" ? "Confirming…" : "Confirm Intervention"}</button></> : null}
          {state.canManage && state.handoff.status !== "archived" ? <button type="button" disabled={busy !== null} onClick={() => void manage("archive")} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50">{busy === "archive" ? "Archiving…" : "Archive Intervention"}</button> : null}
          {state.canManage && state.handoff.status === "archived" ? <button type="button" disabled={busy !== null} onClick={() => void manage("delete")} className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">{busy === "delete" ? "Deleting…" : "Permanent Delete"}</button> : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">Confirmed: {dateLabel(state.handoff.confirmed_at)}. Archived plans are immutable. If a confirmed intervention has already produced a linked HQLS lesson, permanent deletion remains blocked so the lesson keeps its provenance.</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2"><Link href="/interventions" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Intervention Workspace</Link><Link href="/dashboard" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Dashboard</Link></div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-semibold text-zinc-800">{label}{children}</label>; }
function TextArea({ label, value, readOnly, onChange }: { label: string; value: string; readOnly: boolean; onChange: (value: string) => void }) { return <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-800">{label}<textarea readOnly={readOnly} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 rounded-xl border border-zinc-300 bg-white p-3 text-sm font-normal leading-6 read-only:bg-stone-50" /></label>; }
function ActionList({ title, items, readOnly, onChange }: { title: string; items: InterventionAction[]; readOnly: boolean; onChange: (index: number, patch: Partial<InterventionAction>) => void }) { return <div className="overflow-hidden rounded-2xl border border-emerald-950/15"><div className="bg-emerald-950 px-4 py-2.5 text-center text-sm font-semibold text-white">{title}</div><div className="grid gap-3 p-4">{items.length ? items.map((item, index) => <div key={`${item.domain}-${index}`} className="rounded-xl border border-zinc-200 bg-stone-50 p-3"><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">{item.domain}</span><textarea readOnly={readOnly} value={item.action} onChange={(event) => onChange(index, { action: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm leading-6 read-only:bg-stone-50" /><input readOnly={readOnly} value={item.timeframe} onChange={(event) => onChange(index, { timeframe: event.target.value })} className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm read-only:bg-stone-50" /></div>) : <p className="text-sm text-zinc-500">No action recorded.</p>}</div></div>; }
