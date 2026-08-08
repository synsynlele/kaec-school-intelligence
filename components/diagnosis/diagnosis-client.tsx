"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  DiagnosisAction,
  DiagnosisCharacterFinding,
  DiagnosisStrengthChallenge,
  GeneratedDiagnosis,
} from "@/lib/diagnosis/engine";
import type { DiagnosisMode } from "@/lib/domain/diagnosis";

type Workspace = { id: string; name: string; role: string; canApprove: boolean };
type Student = { id: string; name: string; classId: string | null; className: string };
type AssessmentItem = {
  id: string;
  assessment_id: string;
  position: number;
  item_type: string;
  topic: string | null;
  objective: string | null;
  difficulty: string | null;
  marks: number | string | null;
  content: unknown;
};
type Assessment = {
  id: string;
  title: string;
  status: string;
  assessment_mode: string;
  blueprint: unknown;
  updated_at: string;
  items: AssessmentItem[];
};
type DiagnosisRow = {
  id: string;
  student_id: string;
  assessment_id: string | null;
  diagnosis_mode: DiagnosisMode;
  status: "draft" | "reviewed" | "final" | "archived";
  reviewed_at: string | null;
  finalised_at: string | null;
  updated_at: string;
};
type DiagnosisEntry = { row: DiagnosisRow; generated: GeneratedDiagnosis };
type Payload = {
  workspace: Workspace;
  students: Student[];
  assessments: Assessment[];
  diagnoses: DiagnosisEntry[];
  modelPolicy: string;
};
type Observation = { domain: "academic" | "skill" | "character"; statement: string };

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function dateLabel(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function DiagnosisClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<DiagnosisMode>("quick_teacher");
  const [studentId, setStudentId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [earnedMarks, setEarnedMarks] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [itemMarks, setItemMarks] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState<Observation[]>([
    { domain: "academic", statement: "" },
    { domain: "character", statement: "" },
  ]);
  const [active, setActive] = useState<DiagnosisEntry | null>(null);

  const authenticatedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const supabase = getBrowserSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    return response;
  }, []);

  const refresh = useCallback(async () => {
    const response = await authenticatedFetch("/api/diagnosis");
    const payload = (await response.json()) as Payload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Diagnosis workspace could not be loaded.");
    setData(payload);
    setStudentId((current) => current || payload.students[0]?.id || "");
  }, [authenticatedFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Diagnosis workspace could not be loaded."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const selectedStudent = useMemo(
    () => data?.students.find((student) => student.id === studentId) ?? null,
    [data, studentId],
  );
  const selectedAssessment = useMemo(
    () => data?.assessments.find((assessment) => assessment.id === assessmentId) ?? null,
    [assessmentId, data],
  );

  async function post(body: Record<string, unknown>) {
    const response = await authenticatedFetch("/api/diagnosis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const validation = payload.validation as { violations?: { message?: string }[] } | undefined;
      const details = validation?.violations?.map((item) => item.message).filter(Boolean).join(" ");
      throw new Error(`${typeof payload.error === "string" ? payload.error : "Diagnosis request failed."}${details ? ` ${details}` : ""}`);
    }
    return payload;
  }

  async function generate() {
    if (!data?.workspace || !studentId) return;
    setBusy("generate");
    setError(null);
    setNotice(null);
    try {
      const itemResults = selectedAssessment?.items
        .filter((item) => itemMarks[item.id]?.trim() !== "")
        .map((item) => ({
          assessmentItemId: item.id,
          awardedMarks: Number(itemMarks[item.id]),
          note: itemNotes[item.id]?.trim() ?? "",
        })) ?? [];
      const cleanObservations = observations
        .map((item) => ({ ...item, statement: item.statement.trim() }))
        .filter((item) => item.statement);
      const score = earnedMarks.trim() && totalMarks.trim()
        ? { earnedMarks: Number(earnedMarks), totalMarks: Number(totalMarks) }
        : null;
      const payload = await post({
        action: "generate",
        input: {
          workspaceId: data.workspace.id,
          studentId,
          mode,
          assessmentId: mode === "quick_teacher" ? null : assessmentId || null,
          score,
          itemResults,
          observations: cleanObservations,
        },
      });
      const entry: DiagnosisEntry = {
        row: payload.diagnosis as DiagnosisRow,
        generated: payload.generated as GeneratedDiagnosis,
      };
      setActive(entry);
      setNotice("Diagnosis draft generated and saved. Review the evidence chain before marking it Reviewed.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diagnosis generation failed.");
    } finally {
      setBusy(null);
    }
  }

  function updateGenerated(next: GeneratedDiagnosis) {
    setActive((current) => current ? { ...current, generated: next } : current);
  }

  async function saveEdits() {
    if (!active) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const payload = await post({ action: "save_edits", diagnosisId: active.row.id, diagnosis: active.generated });
      const entry = { row: payload.diagnosis as DiagnosisRow, generated: payload.generated as GeneratedDiagnosis };
      setActive(entry);
      setNotice(entry.row.status === "draft" ? "Changes saved. Any previous review was invalidated, so review the updated diagnosis again." : "Changes saved.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diagnosis changes could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function lifecycle(action: "review" | "approve") {
    if (!active) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const payload = await post({ action, diagnosisId: active.row.id });
      const entry = { row: payload.diagnosis as DiagnosisRow, generated: payload.generated as GeneratedDiagnosis };
      setActive(entry);
      setNotice(action === "review" ? "Human review recorded. Owner/admin approval is now required before parent PDF download." : "Diagnosis approved. The final parent report is now locked and downloadable.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diagnosis lifecycle action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!active) return;
    setBusy("pdf");
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/diagnosis/pdf?id=${encodeURIComponent(active.row.id)}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Parent report could not be downloaded.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedStudent?.name || "student"}-kaec-diagnosis.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Parent report could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return <div className="flex min-h-[55vh] items-center justify-center"><p className="text-sm font-medium text-zinc-500">Loading Diagnosis Intelligence…</p></div>;
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Evidence first</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Student Diagnosis Intelligence</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Record what actually happened. KSI separates evidence from patterns and possible interpretations, then turns them into school and parent actions.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Diagnosis mode
                <select value={mode} onChange={(event) => setMode(event.target.value as DiagnosisMode)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3">
                  <option value="quick_teacher">Quick Teacher Diagnosis</option>
                  <option value="assessment_based">Assessment-Based Diagnosis</option>
                  <option value="combined">Combined Diagnosis</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Student
                <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3">
                  <option value="">Select student</option>
                  {data?.students.map((student) => <option key={student.id} value={student.id}>{student.name} — {student.className}</option>)}
                </select>
              </label>
            </div>

            {mode !== "quick_teacher" ? (
              <div className="mt-5 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Assessment
                  <select value={assessmentId} onChange={(event) => { setAssessmentId(event.target.value); setItemMarks({}); setItemNotes({}); }} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3">
                    <option value="">Select saved assessment</option>
                    {data?.assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">Earned marks<input value={earnedMarks} onChange={(event) => setEarnedMarks(event.target.value)} inputMode="decimal" placeholder="e.g. 14" className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3" /></label>
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">Total marks<input value={totalMarks} onChange={(event) => setTotalMarks(event.target.value)} inputMode="decimal" placeholder="e.g. 20" className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3" /></label>
                </div>
                {selectedAssessment?.items.length ? (
                  <details className="rounded-xl border border-zinc-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-800">Add item-level evidence ({selectedAssessment.items.length} items)</summary>
                    <div className="mt-4 grid gap-3">
                      {selectedAssessment.items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-zinc-200 p-3">
                          <p className="text-sm font-semibold text-zinc-900">Item {item.position} · {titleCase(item.item_type)} · {Number(item.marks ?? 0)} marks</p>
                          <p className="mt-1 text-xs text-zinc-500">{item.topic || "Topic not labelled"}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
                            <input value={itemMarks[item.id] ?? ""} onChange={(event) => setItemMarks((current) => ({ ...current, [item.id]: event.target.value }))} inputMode="decimal" placeholder="Marks" className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm" />
                            <input value={itemNotes[item.id] ?? ""} onChange={(event) => setItemNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional factual note" className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Teacher observations</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Write only what was observed. Avoid labels such as “lazy” or hidden-cause assumptions.</p>
                </div>
                <button type="button" onClick={() => setObservations((current) => [...current, { domain: "academic", statement: "" }])} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold">Add</button>
              </div>
              <div className="mt-4 grid gap-3">
                {observations.map((observation, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[135px_1fr_auto]">
                    <select value={observation.domain} onChange={(event) => setObservations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, domain: event.target.value as Observation["domain"] } : item))} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm">
                      <option value="academic">Academic</option><option value="skill">Skill</option><option value="character">Character</option>
                    </select>
                    <textarea value={observation.statement} onChange={(event) => setObservations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, statement: event.target.value } : item))} placeholder="Example: Completed 4 of 5 tasks independently after the first correction." className="min-h-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" />
                    <button type="button" onClick={() => setObservations((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="h-10 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-600">Remove</button>
                  </div>
                ))}
              </div>
            </div>

            {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
            {notice ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div> : null}
            <button type="button" disabled={!studentId || busy !== null} onClick={() => void generate()} className="mt-5 min-h-12 w-full rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy === "generate" ? "Generating diagnosis…" : "Generate Diagnosis Draft"}</button>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Saved diagnoses</h2>
            <div className="mt-4 grid gap-2">
              {data?.diagnoses.length ? data.diagnoses.map((entry) => {
                const student = data.students.find((candidate) => candidate.id === entry.row.student_id);
                return <button key={entry.row.id} type="button" onClick={() => setActive(entry)} className="rounded-xl border border-zinc-200 p-3 text-left hover:bg-stone-50"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-zinc-900">{student?.name || "Student"}</span><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600">{entry.row.status}</span></div><p className="mt-1 text-xs text-zinc-500">{titleCase(entry.row.diagnosis_mode)} · {new Date(entry.row.updated_at).toLocaleDateString()}</p></button>;
              }) : <p className="text-sm text-zinc-500">No saved diagnoses yet.</p>}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          {active ? (
            <>
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Evidence → Pattern → Interpretation → Action</p><h2 className="mt-2 text-2xl font-semibold text-zinc-950">Diagnosis review</h2></div>
                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-800">{active.row.status}</span>
                </div>

                <div className="mt-5 grid gap-4">
                  <div><h3 className="text-sm font-semibold text-zinc-900">Observed Evidence</h3><div className="mt-2 grid gap-2">{active.generated.observedEvidence.map((item) => <div key={item.id} className="rounded-xl border border-zinc-200 bg-stone-50 p-3 text-sm"><span className="font-semibold capitalize">{item.domain}</span> · {item.statement}{item.metric ? <span className="ml-2 text-zinc-500">({item.metric})</span> : null}</div>)}</div></div>
                  <div><h3 className="text-sm font-semibold text-zinc-900">Detected Patterns</h3><div className="mt-2 grid gap-2">{active.generated.detectedPatterns.map((item, index) => <div key={index} className="rounded-xl border border-zinc-200 p-3 text-sm"><span className="font-semibold capitalize">{item.confidence} confidence:</span> {item.statement}</div>)}</div></div>
                  <div><h3 className="text-sm font-semibold text-zinc-900">Possible Interpretations</h3><div className="mt-2 grid gap-2">{active.generated.possibleInterpretations.map((item, index) => <div key={index} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm"><span className="font-semibold">Possible, {item.confidence} confidence:</span> {item.statement}<p className="mt-1 text-xs text-zinc-500">Uncertainty: {item.uncertaintyNote}</p></div>)}</div></div>
                </div>
              </div>

              <EditableParentContent active={active} onChange={updateGenerated} readOnly={active.row.status === "final"} />

              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {active.row.status !== "final" ? <button type="button" disabled={busy !== null} onClick={() => void saveEdits()} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold">{busy === "save" ? "Saving…" : "Save Changes"}</button> : null}
                  {active.row.status === "draft" ? <button type="button" disabled={busy !== null} onClick={() => void lifecycle("review")} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{busy === "review" ? "Recording review…" : "Mark Reviewed"}</button> : null}
                  {active.row.status === "reviewed" ? <button type="button" disabled={busy !== null || !data?.workspace.canApprove} onClick={() => void lifecycle("approve")} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy === "approve" ? "Approving…" : data?.workspace.canApprove ? "Approve Final Report" : "Owner/Admin Approval Required"}</button> : null}
                  {active.row.status === "final" ? <button type="button" disabled={busy !== null} onClick={() => void downloadPdf()} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white">{busy === "pdf" ? "Preparing PDF…" : "Download Parent PDF"}</button> : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Reviewed: {dateLabel(active.row.reviewed_at)} · Approved: {dateLabel(active.row.finalised_at)}. Editing a reviewed diagnosis automatically returns it to Draft and requires a fresh human review.</p>
              </div>

              {active.row.status === "reviewed" || active.row.status === "final" ? <ParentPreview entry={active} student={data?.students.find((item) => item.id === active.row.student_id) ?? null} workspaceName={data?.workspace.name ?? "KAEC School"} /> : null}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Generate a diagnosis or open a saved diagnosis to begin review.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function EditableParentContent({ active, onChange, readOnly }: { active: DiagnosisEntry; onChange: (next: GeneratedDiagnosis) => void; readOnly: boolean }) {
  const diagnosis = active.generated;
  const set = <K extends keyof GeneratedDiagnosis>(key: K, value: GeneratedDiagnosis[K]) => onChange({ ...diagnosis, [key]: value });
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-zinc-950">Parent-facing content</h2>
      <p className="mt-1 text-sm text-zinc-500">Review the wording carefully. Evidence links remain protected while you edit the report language and actions.</p>
      <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-800">Concise Diagnosis<textarea readOnly={readOnly} value={diagnosis.conciseDiagnosis} onChange={(event) => set("conciseDiagnosis", event.target.value)} className="min-h-28 rounded-xl border border-zinc-300 px-3 py-2 font-normal" /></label>
      <FindingEditor title="Academics / Skills — Strengths" items={diagnosis.academicSkillStrengths} readOnly={readOnly} onChange={(items) => set("academicSkillStrengths", items)} />
      <FindingEditor title="Academics / Skills — Challenges" items={diagnosis.academicSkillChallenges} readOnly={readOnly} onChange={(items) => set("academicSkillChallenges", items)} />
      <CharacterEditor title="Character — Strengths" items={diagnosis.characterStrengths} readOnly={readOnly} onChange={(items) => set("characterStrengths", items)} />
      <CharacterEditor title="Character — Challenges" items={diagnosis.characterChallenges} readOnly={readOnly} onChange={(items) => set("characterChallenges", items)} />
      <ActionEditor title="School Action — Academics / Skills" items={diagnosis.schoolAcademicActions} readOnly={readOnly} onChange={(items) => set("schoolAcademicActions", items)} />
      <ActionEditor title="Parent Action — Academics / Skills" items={diagnosis.parentAcademicActions} readOnly={readOnly} onChange={(items) => set("parentAcademicActions", items)} />
      <ActionEditor title="School Action — Character" items={diagnosis.schoolCharacterActions} readOnly={readOnly} onChange={(items) => set("schoolCharacterActions", items)} />
      <ActionEditor title="Parent Action — Character" items={diagnosis.parentCharacterActions} readOnly={readOnly} onChange={(items) => set("parentCharacterActions", items)} />
      <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-800">Builder Growth Direction<textarea readOnly={readOnly} value={diagnosis.builderGrowthDirection} onChange={(event) => set("builderGrowthDirection", event.target.value)} className="min-h-24 rounded-xl border border-zinc-300 px-3 py-2 font-normal" /></label>
      <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-800">Encouragement Note<textarea readOnly={readOnly} value={diagnosis.encouragementNote} onChange={(event) => set("encouragementNote", event.target.value)} className="min-h-24 rounded-xl border border-zinc-300 px-3 py-2 font-normal" /></label>
      <div className="mt-5"><p className="text-sm font-semibold text-zinc-800">Evidence Limitations</p>{diagnosis.evidenceLimitations.map((item, index) => <textarea key={index} readOnly={readOnly} value={item} onChange={(event) => set("evidenceLimitations", diagnosis.evidenceLimitations.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className="mt-2 min-h-16 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />)}</div>
    </div>
  );
}

function FindingEditor({ title, items, readOnly, onChange }: { title: string; items: DiagnosisStrengthChallenge[]; readOnly: boolean; onChange: (items: DiagnosisStrengthChallenge[]) => void }) {
  return <div className="mt-5"><p className="text-sm font-semibold text-zinc-800">{title}</p>{items.map((item, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[100px_1fr]"><span className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold capitalize text-zinc-600">{item.domain}</span><textarea readOnly={readOnly} value={item.statement} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, statement: event.target.value } : value))} className="min-h-16 rounded-xl border border-zinc-300 px-3 py-2 text-sm" /></div>)}</div>;
}

function CharacterEditor({ title, items, readOnly, onChange }: { title: string; items: DiagnosisCharacterFinding[]; readOnly: boolean; onChange: (items: DiagnosisCharacterFinding[]) => void }) {
  return <div className="mt-5"><p className="text-sm font-semibold text-zinc-800">{title}</p>{items.map((item, index) => <textarea key={index} readOnly={readOnly} value={item.statement} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, statement: event.target.value } : value))} className="mt-2 min-h-16 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />)}</div>;
}

function ActionEditor({ title, items, readOnly, onChange }: { title: string; items: DiagnosisAction[]; readOnly: boolean; onChange: (items: DiagnosisAction[]) => void }) {
  return <div className="mt-5"><p className="text-sm font-semibold text-zinc-800">{title}</p>{items.map((item, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[1fr_160px]"><textarea readOnly={readOnly} value={item.action} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, action: event.target.value } : value))} className="min-h-16 rounded-xl border border-zinc-300 px-3 py-2 text-sm" /><input readOnly={readOnly} value={item.timeframe} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, timeframe: event.target.value } : value))} className="min-h-11 rounded-xl border border-zinc-300 px-3 text-sm" placeholder="Timeframe" /></div>)}</div>;
}

function ParentPreview({ entry, student, workspaceName }: { entry: DiagnosisEntry; student: Student | null; workspaceName: string }) {
  const d = entry.generated;
  return <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Parent Report Preview</p><h2 className="mt-2 text-2xl font-semibold text-zinc-950">{student?.name || "Student"}</h2><p className="mt-1 text-sm text-zinc-500">{workspaceName} · {student?.className || "Class"}</p><div className="mt-6 grid gap-5"><PreviewSection title="Concise Diagnosis" lines={[d.conciseDiagnosis]} /><PreviewSection title="Academics / Skills — Strengths" lines={d.academicSkillStrengths.map((item) => item.statement)} /><PreviewSection title="Academics / Skills — Challenges" lines={d.academicSkillChallenges.map((item) => item.statement)} /><PreviewSection title="Character — Strengths" lines={d.characterStrengths.map((item) => item.statement)} /><PreviewSection title="Character — Challenges" lines={d.characterChallenges.map((item) => item.statement)} /><PreviewSection title="School Actions — Academics / Skills" lines={d.schoolAcademicActions.map((item) => `${item.action} (${item.timeframe})`)} /><PreviewSection title="Parent Actions — Academics / Skills" lines={d.parentAcademicActions.map((item) => `${item.action} (${item.timeframe})`)} /><PreviewSection title="School Actions — Character" lines={d.schoolCharacterActions.map((item) => `${item.action} (${item.timeframe})`)} /><PreviewSection title="Parent Actions — Character" lines={d.parentCharacterActions.map((item) => `${item.action} (${item.timeframe})`)} /><PreviewSection title="Builder Growth Direction" lines={[d.builderGrowthDirection]} /><PreviewSection title="Encouragement Note" lines={[d.encouragementNote]} /></div></div>;
}

function PreviewSection({ title, lines }: { title: string; lines: string[] }) {
  return <section><h3 className="text-sm font-semibold text-zinc-900">{title}</h3><div className="mt-2 space-y-2 text-sm leading-6 text-zinc-600">{lines.length ? lines.map((line, index) => <p key={index}>• {line}</p>) : <p>• Insufficient Evidence at this time.</p>}</div></section>;
}
