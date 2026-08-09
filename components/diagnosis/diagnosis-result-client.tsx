"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  DiagnosisAction,
  DiagnosisCharacterFinding,
  DiagnosisStrengthChallenge,
  GeneratedDiagnosis,
} from "@/lib/diagnosis/engine";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type DiagnosisRow = {
  id: string;
  workspace_id: string;
  student_id: string;
  assessment_id: string | null;
  diagnosis_mode: string;
  status: "draft" | "reviewed" | "final" | "archived";
  academic_session: string;
  term: string;
  reviewed_at: string | null;
  finalised_at: string | null;
  updated_at: string;
};

type DiagnosisEntry = { row: DiagnosisRow; generated: GeneratedDiagnosis };
type Payload = {
  workspace: { id: string; name: string; role: string; canApprove: boolean };
  assessments: Array<{ id: string; title: string; status: string }>;
  diagnoses: DiagnosisEntry[];
};

type Handoff = { id: string; status: string; next_lesson_id: string | null };

function dateLabel(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function DiagnosisResultClient({ diagnosisId }: { diagnosisId: string }) {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [entry, setEntry] = useState<DiagnosisEntry | null>(null);
  const [studentName, setStudentName] = useState("Student");
  const [className, setClassName] = useState("Class not linked");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
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
    return fetch(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` },
    });
  }, []);

  const load = useCallback(async () => {
    const response = await authenticatedFetch("/api/diagnosis");
    const next = (await response.json()) as Payload & { error?: string };
    if (!response.ok) throw new Error(next.error || "Diagnosis workspace could not be loaded.");
    const found = next.diagnoses.find((item) => item.row.id === diagnosisId);
    if (!found) throw new Error("This diagnosis is not available in the active workspace.");

    const supabase = getBrowserSupabaseClient();
    const [studentResult, handoffResult] = await Promise.all([
      supabase
        .from("students")
        .select("display_name,class_id")
        .eq("workspace_id", next.workspace.id)
        .eq("id", found.row.student_id)
        .maybeSingle(),
      supabase
        .from("intervention_handoffs")
        .select("id,status,next_lesson_id")
        .eq("workspace_id", next.workspace.id)
        .eq("diagnosis_id", diagnosisId)
        .maybeSingle(),
    ]);
    if (studentResult.error) throw studentResult.error;
    if (handoffResult.error) throw handoffResult.error;

    let nextClassName = "Class not linked";
    if (studentResult.data?.class_id) {
      const { data } = await supabase
        .from("classes")
        .select("name")
        .eq("workspace_id", next.workspace.id)
        .eq("id", studentResult.data.class_id)
        .maybeSingle();
      if (data?.name) nextClassName = data.name;
    }

    setPayload(next);
    setEntry(found);
    setStudentName(studentResult.data?.display_name || "Student");
    setClassName(nextClassName);
    setHandoff((handoffResult.data as Handoff | null) ?? null);
  }, [authenticatedFetch, diagnosisId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void load()
        .catch((caught) => {
          if (active) setError(caught instanceof Error ? caught.message : "The diagnosis could not be opened.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  function updateGenerated(next: GeneratedDiagnosis) {
    setEntry((current) => (current ? { ...current, generated: next } : current));
  }

  async function diagnosisAction(action: "save_edits" | "review" | "approve") {
    if (!entry) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const body =
        action === "save_edits"
          ? { action, diagnosisId: entry.row.id, diagnosis: entry.generated }
          : { action, diagnosisId: entry.row.id };
      const response = await authenticatedFetch("/api/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The diagnosis action could not be completed.");
      await load();
      setNotice(
        action === "save_edits"
          ? "Diagnosis changes saved. Any previous review must be repeated if the report changed."
          : action === "review"
            ? "Diagnosis marked Reviewed."
            : "Diagnosis approved as Final.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The diagnosis action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function manage(action: "archive" | "delete") {
    if (!entry) return;
    if (action === "archive") {
      const confirmed = window.confirm(
        "Archive this diagnosis? It will leave active diagnosis work but remain available as history.",
      );
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
      const response = await authenticatedFetch("/api/diagnosis/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisId: entry.row.id, action, confirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The diagnosis management action could not be completed.");
      if (action === "delete") {
        router.push("/diagnosis");
        return;
      }
      await load();
      setNotice("Diagnosis archived. Its approved history remains available and read-only.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The diagnosis management action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!entry) return;
    setBusy("pdf");
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/diagnosis/pdf?id=${encodeURIComponent(entry.row.id)}`);
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "Parent PDF could not be prepared.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? "kaec-diagnosis.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Parent PDF could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center px-5 text-sm text-zinc-500">Opening diagnosis…</div>;
  if (!entry || !payload) return <main className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Diagnosis unavailable."}</div></main>;

  const assessment = payload.assessments.find((item) => item.id === entry.row.assessment_id) ?? null;
  const readOnly = entry.row.status === "final" || entry.row.status === "archived";
  const canManage = payload.workspace.canApprove;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div> : null}

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-900">{entry.row.status}</span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Student Diagnosis Result</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{studentName}</h1>
            <p className="mt-2 text-sm text-zinc-600">{className} · {entry.row.academic_session || "Session not set"} · {entry.row.term || "Term not set"}</p>
            <p className="mt-1 text-xs text-zinc-500">{payload.workspace.name} · {entry.row.diagnosis_mode.replaceAll("_", " ")}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap md:justify-end">
            {assessment ? <Link href={`/assessment/result?assessment=${encodeURIComponent(assessment.id)}`} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-center text-sm font-semibold text-blue-900">Open Evidence Assessment</Link> : null}
            {handoff ? <Link href={`/interventions/result?intervention=${encodeURIComponent(handoff.id)}`} className="min-h-11 rounded-xl border border-emerald-900/20 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-950">Open Intervention</Link> : null}
            {(entry.row.status === "final" || entry.row.status === "archived") && entry.row.finalised_at ? (
              <button type="button" disabled={busy !== null} onClick={() => void downloadPdf()} className="min-h-11 rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "pdf" ? "Preparing PDF…" : "Download Parent PDF"}</button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <details className="rounded-2xl border border-zinc-200 bg-stone-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Internal evidence review</summary>
          <div className="mt-4 grid gap-5">
            <Group title="Observed evidence" items={entry.generated.observedEvidence.map((item) => `${item.domain}: ${item.statement}${item.metric ? ` (${item.metric})` : ""}`)} />
            <Group title="Detected patterns" items={entry.generated.detectedPatterns.map((item) => `${item.statement} — ${item.confidence} confidence`)} />
            <Group title="Possible interpretations" items={entry.generated.possibleInterpretations.map((item) => `${item.statement} — ${item.confidence} confidence. ${item.uncertaintyNote}`)} />
            <Group title="Evidence limitations" items={entry.generated.evidenceLimitations} />
          </div>
        </details>
      </section>

      <section className="mt-5 rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Parent-facing diagnosis</p>
        <EditableText label="Concise Diagnosis" value={entry.generated.conciseDiagnosis} readOnly={readOnly} onChange={(value) => updateGenerated({ ...entry.generated, conciseDiagnosis: value })} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <FindingEditor title="Academic / Skill Strengths" items={entry.generated.academicSkillStrengths} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, academicSkillStrengths: items })} />
          <FindingEditor title="Academic / Skill Challenges" items={entry.generated.academicSkillChallenges} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, academicSkillChallenges: items })} />
          <CharacterEditor title="Character Strengths" items={entry.generated.characterStrengths} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, characterStrengths: items })} />
          <CharacterEditor title="Character Challenges" items={entry.generated.characterChallenges} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, characterChallenges: items })} />
          <ActionEditor title="School Academic Actions" items={entry.generated.schoolAcademicActions} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, schoolAcademicActions: items })} />
          <ActionEditor title="Parent Academic Actions" items={entry.generated.parentAcademicActions} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, parentAcademicActions: items })} />
          <ActionEditor title="School Character Actions" items={entry.generated.schoolCharacterActions} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, schoolCharacterActions: items })} />
          <ActionEditor title="Parent Character Actions" items={entry.generated.parentCharacterActions} readOnly={readOnly} onChange={(items) => updateGenerated({ ...entry.generated, parentCharacterActions: items })} />
        </div>
        <EditableText label="Builder Growth Direction" value={entry.generated.builderGrowthDirection} readOnly={readOnly} onChange={(value) => updateGenerated({ ...entry.generated, builderGrowthDirection: value })} />
        <EditableText label="Encouragement Note" value={entry.generated.encouragementNote} readOnly={readOnly} onChange={(value) => updateGenerated({ ...entry.generated, encouragementNote: value })} />
      </section>

      <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <button type="button" disabled={busy !== null} onClick={() => void diagnosisAction("save_edits")} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy === "save_edits" ? "Saving…" : "Save Changes"}</button>
          ) : null}
          {entry.row.status === "draft" ? (
            <button type="button" disabled={busy !== null} onClick={() => void diagnosisAction("review")} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "review" ? "Recording review…" : "Mark Reviewed"}</button>
          ) : null}
          {entry.row.status === "reviewed" ? (
            <button type="button" disabled={busy !== null || !payload.workspace.canApprove} onClick={() => void diagnosisAction("approve")} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy === "approve" ? "Approving…" : payload.workspace.canApprove ? "Approve Final Report" : "Owner/Admin Approval Required"}</button>
          ) : null}
          {canManage && entry.row.status !== "archived" ? (
            <button type="button" disabled={busy !== null} onClick={() => void manage("archive")} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50">{busy === "archive" ? "Archiving…" : "Archive Diagnosis"}</button>
          ) : null}
          {canManage && entry.row.status === "archived" ? (
            <button type="button" disabled={busy !== null} onClick={() => void manage("delete")} className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">{busy === "delete" ? "Deleting…" : "Permanent Delete"}</button>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">Reviewed: {dateLabel(entry.row.reviewed_at)} · Approved: {dateLabel(entry.row.finalised_at)}. Archive removes the record from active work without breaking history. Permanent deletion is allowed only after archival and only when no intervention depends on the diagnosis.</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/diagnosis" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">New Diagnosis</Link>
        <Link href="/dashboard" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Dashboard</Link>
      </div>
    </main>
  );
}

function EditableText({ label, value, readOnly, onChange }: { label: string; value: string; readOnly: boolean; onChange: (value: string) => void }) {
  return <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-900">{label}<textarea readOnly={readOnly} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 rounded-xl border border-zinc-300 bg-white p-3 text-sm font-normal leading-6 read-only:bg-stone-50" /></label>;
}

function Group({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="text-sm font-semibold text-zinc-900">{title}</h3><ul className="mt-2 grid gap-2 text-sm leading-6 text-zinc-700">{items.length ? items.map((item, index) => <li key={index}>• {item}</li>) : <li>No evidence recorded.</li>}</ul></div>;
}

function FindingEditor({ title, items, readOnly, onChange }: { title: string; items: DiagnosisStrengthChallenge[]; readOnly: boolean; onChange: (items: DiagnosisStrengthChallenge[]) => void }) {
  return <EditorShell title={title}>{items.map((item, index) => <textarea key={index} readOnly={readOnly} value={item.statement} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, statement: event.target.value } : current))} className="min-h-20 rounded-xl border border-zinc-300 bg-white p-3 text-sm leading-6 read-only:bg-stone-50" />)}</EditorShell>;
}

function CharacterEditor({ title, items, readOnly, onChange }: { title: string; items: DiagnosisCharacterFinding[]; readOnly: boolean; onChange: (items: DiagnosisCharacterFinding[]) => void }) {
  return <EditorShell title={title}>{items.map((item, index) => <textarea key={index} readOnly={readOnly} value={item.statement} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, statement: event.target.value } : current))} className="min-h-20 rounded-xl border border-zinc-300 bg-white p-3 text-sm leading-6 read-only:bg-stone-50" />)}</EditorShell>;
}

function ActionEditor({ title, items, readOnly, onChange }: { title: string; items: DiagnosisAction[]; readOnly: boolean; onChange: (items: DiagnosisAction[]) => void }) {
  return <EditorShell title={title}>{items.map((item, index) => <div key={index} className="grid gap-2"><textarea readOnly={readOnly} value={item.action} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, action: event.target.value } : current))} className="min-h-20 rounded-xl border border-zinc-300 bg-white p-3 text-sm leading-6 read-only:bg-stone-50" /><input readOnly={readOnly} value={item.timeframe} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, timeframe: event.target.value } : current))} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm read-only:bg-stone-50" /></div>)}</EditorShell>;
}

function EditorShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-zinc-200 bg-stone-50 p-4"><h3 className="text-sm font-semibold text-zinc-900">{title}</h3><div className="mt-3 grid gap-3">{children}</div></div>;
}
