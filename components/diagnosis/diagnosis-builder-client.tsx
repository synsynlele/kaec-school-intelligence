"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DiagnosisMode } from "@/lib/domain/diagnosis";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Workspace = { id: string; name: string; role: string; canApprove: boolean };
type Student = { id: string; name: string; classId: string | null; className: string };
type AssessmentItem = { id: string; position: number; item_type: string; topic: string | null; marks: number | string | null };
type Assessment = { id: string; title: string; status: string; items: AssessmentItem[] };
type DiagnosisEntry = { row: { id: string; student_id: string; diagnosis_mode: DiagnosisMode; status: string; academic_session: string; term: string; updated_at: string } };
type Payload = { workspace: Workspace; students: Student[]; assessments: Assessment[]; diagnoses: DiagnosisEntry[] };
type Observation = { domain: "academic" | "skill" | "character"; statement: string };

type TeacherSheet = {
  academicObservations: string;
  characterObservations: string;
  academicStrengthIndicators: string;
  academicChallengeIndicators: string;
  characterStrengthIndicators: string;
  characterChallengeIndicators: string;
  additionalNotes: string;
  additionalNotesDomain: "academic" | "skill" | "character";
};

const EMPTY_SHEET: TeacherSheet = {
  academicObservations: "",
  characterObservations: "",
  academicStrengthIndicators: "",
  academicChallengeIndicators: "",
  characterStrengthIndicators: "",
  characterChallengeIndicators: "",
  additionalNotes: "",
  additionalNotesDomain: "academic",
};

const TERMS = ["FIRST TERM", "SECOND TERM", "THIRD TERM"] as const;

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function observation(domain: Observation["domain"], label: string, value: string): Observation | null {
  const statement = clean(value);
  return statement ? { domain, statement: `${label}: ${statement}` } : null;
}

function teacherObservations(sheet: TeacherSheet) {
  return [
    observation("academic", "Academic/Skills observation", sheet.academicObservations),
    observation("character", "Character/Discipline observation", sheet.characterObservations),
    observation("academic", "Teacher-indicated Academic/Skills strength evidence", sheet.academicStrengthIndicators),
    observation("academic", "Teacher-indicated Academic/Skills challenge evidence", sheet.academicChallengeIndicators),
    observation("character", "Teacher-indicated Character/Discipline strength evidence", sheet.characterStrengthIndicators),
    observation("character", "Teacher-indicated Character/Discipline challenge evidence", sheet.characterChallengeIndicators),
    observation(sheet.additionalNotesDomain, "Additional factual teacher context", sheet.additionalNotes),
  ].filter((item): item is Observation => Boolean(item));
}

function requestedAssessmentId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("assessment")?.trim() ?? "";
}

export function DiagnosisBuilderClient() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<DiagnosisMode>("quick_teacher");
  const [studentId, setStudentId] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [term, setTerm] = useState("");
  const [teacherSheet, setTeacherSheet] = useState<TeacherSheet>(EMPTY_SHEET);
  const [assessmentId, setAssessmentId] = useState("");
  const [earnedMarks, setEarnedMarks] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [itemMarks, setItemMarks] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [classSessions, setClassSessions] = useState<Record<string, string>>({});
  const handoffApplied = useRef(false);

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
    const response = await authenticatedFetch("/api/diagnosis");
    const payload = (await response.json()) as Payload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Diagnosis workspace could not be loaded.");

    const classIds = [...new Set(payload.students.map((student) => student.classId).filter((id): id is string => Boolean(id)))];
    const sessions: Record<string, string> = {};
    if (classIds.length) {
      const supabase = getBrowserSupabaseClient();
      const { data: rows, error: classError } = await supabase.from("classes").select("id,academic_session").in("id", classIds);
      if (classError) throw classError;
      for (const row of rows ?? []) if (row.academic_session) sessions[row.id] = row.academic_session;
    }
    setClassSessions(sessions);
    setData(payload);

    if (!handoffApplied.current) {
      handoffApplied.current = true;
      const linkedId = requestedAssessmentId();
      if (linkedId) {
        const linked = payload.assessments.find((assessment) => assessment.id === linkedId && assessment.status !== "archived");
        if (!linked) {
          setError("The linked assessment is not available as diagnosis evidence in the active workspace.");
        } else {
          setMode("assessment_based");
          setAssessmentId(linkedId);
          setNotice(`Assessment evidence loaded: ${linked.title}. Select the learner and enter the observed results.`);
        }
      }
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    let active = true;
    void load()
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Diagnosis workspace could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const selectedAssessment = useMemo(() => data?.assessments.find((item) => item.id === assessmentId) ?? null, [assessmentId, data]);

  function onStudentChange(nextId: string) {
    setStudentId(nextId);
    const student = data?.students.find((item) => item.id === nextId);
    if (student?.classId && classSessions[student.classId]) setAcademicSession(classSessions[student.classId]);
  }

  function onModeChange(nextMode: DiagnosisMode) {
    setMode(nextMode);
    if (nextMode === "quick_teacher") {
      setAssessmentId("");
      setItemMarks({});
      setItemNotes({});
      window.history.replaceState(window.history.state, "", "/diagnosis");
    }
  }

  function onAssessmentChange(nextId: string) {
    setAssessmentId(nextId);
    setItemMarks({});
    setItemNotes({});
    const url = nextId ? `/diagnosis?assessment=${encodeURIComponent(nextId)}` : "/diagnosis";
    window.history.replaceState(window.history.state, "", url);
  }

  async function generate() {
    if (!data || !studentId) return;
    const observations = teacherObservations(teacherSheet);
    if (!academicSession.trim()) return setError("Academic Session is required for the parent diagnosis report.");
    if (!term.trim()) return setError("Select the Term for this diagnosis report.");
    if (mode === "quick_teacher" && observations.length < 2) return setError("Quick Teacher Diagnosis needs at least two first-hand observations or indicators.");
    if (mode !== "quick_teacher" && !assessmentId) return setError("Select the saved assessment used as diagnosis evidence.");

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const itemResults = selectedAssessment?.items
        .filter((item) => itemMarks[item.id]?.trim() !== "")
        .map((item) => ({ assessmentItemId: item.id, awardedMarks: Number(itemMarks[item.id]), note: itemNotes[item.id]?.trim() ?? "" })) ?? [];
      const score = earnedMarks.trim() && totalMarks.trim()
        ? { earnedMarks: Number(earnedMarks), totalMarks: Number(totalMarks) }
        : null;

      const response = await authenticatedFetch("/api/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          input: {
            workspaceId: data.workspace.id,
            studentId,
            mode,
            assessmentId: mode === "quick_teacher" ? null : assessmentId || null,
            score,
            itemResults,
            observations,
          },
        }),
      });
      const result = (await response.json()) as { error?: string; diagnosis?: { id?: string } };
      if (!response.ok) throw new Error(result.error || "Diagnosis generation failed.");
      const diagnosisId = result.diagnosis?.id;
      if (!diagnosisId) throw new Error("Diagnosis was saved but no id was returned.");

      const supabase = getBrowserSupabaseClient();
      const { error: contextError } = await supabase.rpc("set_diagnosis_report_context", {
        target_diagnosis_id: diagnosisId,
        target_academic_session: academicSession.trim(),
        target_term: term.trim(),
      });
      if (contextError) throw contextError;
      router.push(`/diagnosis/result?diagnosis=${encodeURIComponent(diagnosisId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diagnosis generation failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center px-5 text-sm text-zinc-500">Loading Diagnosis Intelligence…</div>;
  if (!data) return <main className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Diagnosis workspace unavailable."}</div></main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Student Diagnosis Intelligence</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Create evidence-based diagnosis</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Enter only observed school evidence. KSI generates a draft; review and approval happen on the dedicated result page.</p>

          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
          {notice ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div> : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Diagnosis Mode"><select value={mode} onChange={(event) => onModeChange(event.target.value as DiagnosisMode)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"><option value="quick_teacher">Quick Teacher Diagnosis</option><option value="assessment_based">Assessment-Based Diagnosis</option><option value="combined">Combined Evidence Diagnosis</option></select></Field>
            <Field label="Learner"><select value={studentId} onChange={(event) => onStudentChange(event.target.value)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"><option value="">Select learner</option>{data.students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.className}</option>)}</select></Field>
            <Field label="Academic Session"><input value={academicSession} onChange={(event) => setAcademicSession(event.target.value)} placeholder="2026/2027" className="min-h-11 rounded-xl border border-zinc-300 px-3" /></Field>
            <Field label="Term"><select value={term} onChange={(event) => setTerm(event.target.value)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"><option value="">Select term</option>{TERMS.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-stone-50 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-zinc-950">Teacher evidence sheet</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Use factual observations, not labels or clinical conclusions.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Text label="Academic / Skills Observations" value={teacherSheet.academicObservations} onChange={(value) => setTeacherSheet((current) => ({ ...current, academicObservations: value }))} />
              <Text label="Character / Discipline Observations" value={teacherSheet.characterObservations} onChange={(value) => setTeacherSheet((current) => ({ ...current, characterObservations: value }))} />
              <Text label="Academic / Skills Strength Indicators" value={teacherSheet.academicStrengthIndicators} onChange={(value) => setTeacherSheet((current) => ({ ...current, academicStrengthIndicators: value }))} />
              <Text label="Academic / Skills Challenge Indicators" value={teacherSheet.academicChallengeIndicators} onChange={(value) => setTeacherSheet((current) => ({ ...current, academicChallengeIndicators: value }))} />
              <Text label="Character Strength Indicators" value={teacherSheet.characterStrengthIndicators} onChange={(value) => setTeacherSheet((current) => ({ ...current, characterStrengthIndicators: value }))} />
              <Text label="Character Challenge Indicators" value={teacherSheet.characterChallengeIndicators} onChange={(value) => setTeacherSheet((current) => ({ ...current, characterChallengeIndicators: value }))} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <Field label="Additional notes relate to"><select value={teacherSheet.additionalNotesDomain} onChange={(event) => setTeacherSheet((current) => ({ ...current, additionalNotesDomain: event.target.value as TeacherSheet["additionalNotesDomain"] }))} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"><option value="academic">Academics</option><option value="skill">Skills</option><option value="character">Character</option></select></Field>
              <Text label="Additional Factual Notes" value={teacherSheet.additionalNotes} onChange={(value) => setTeacherSheet((current) => ({ ...current, additionalNotes: value }))} />
            </div>
          </div>

          {mode !== "quick_teacher" ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
              <Field label="Assessment Evidence"><select value={assessmentId} onChange={(event) => onAssessmentChange(event.target.value)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"><option value="">Select saved assessment</option>{data.assessments.filter((assessment) => assessment.status !== "archived").map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></Field>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Earned marks"><input value={earnedMarks} onChange={(event) => setEarnedMarks(event.target.value)} inputMode="decimal" className="min-h-11 rounded-xl border border-zinc-300 px-3" /></Field><Field label="Total marks"><input value={totalMarks} onChange={(event) => setTotalMarks(event.target.value)} inputMode="decimal" className="min-h-11 rounded-xl border border-zinc-300 px-3" /></Field></div>
              {selectedAssessment?.items.length ? <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-zinc-800">Add item-level evidence ({selectedAssessment.items.length} items)</summary><div className="mt-4 grid gap-3">{selectedAssessment.items.map((item) => <div key={item.id} className="rounded-xl border border-zinc-200 p-3"><p className="text-sm font-semibold">Item {item.position} · {Number(item.marks ?? 0)} marks</p><p className="mt-1 text-xs text-zinc-500">{item.topic || "Topic not labelled"}</p><div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]"><input value={itemMarks[item.id] ?? ""} onChange={(event) => setItemMarks((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Marks" inputMode="decimal" className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm" /><input value={itemNotes[item.id] ?? ""} onChange={(event) => setItemNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional factual note" className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm" /></div></div>)}</div></details> : null}
            </div>
          ) : null}

          <button type="button" disabled={!studentId || busy} onClick={() => void generate()} className="mt-6 min-h-12 w-full rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto">{busy ? "Generating diagnosis…" : "Generate Diagnosis Draft"}</button>
        </section>

        <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-800">Saved work</p><h2 className="mt-1 text-xl font-semibold">Diagnoses</h2></div><span className="text-xs text-zinc-400">{data.diagnoses.length}</span></div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Results open on their own page, keeping this workspace focused on evidence entry.</p>
          <div className="mt-4 grid gap-2">{data.diagnoses.length ? data.diagnoses.map((entry) => { const student = data.students.find((item) => item.id === entry.row.student_id); return <Link key={entry.row.id} href={`/diagnosis/result?diagnosis=${encodeURIComponent(entry.row.id)}`} className="rounded-2xl border border-zinc-200 p-3 transition hover:bg-stone-50"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-zinc-900">{student?.name || "Student"}</span><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600">{entry.row.status}</span></div><p className="mt-1 text-xs text-zinc-500">{entry.row.academic_session || "Session not set"} · {entry.row.term || "Term not set"}</p></Link>; }) : <p className="text-sm text-zinc-500">No saved diagnoses yet.</p>}</div>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-zinc-700">{label}{children}</label>;
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium text-zinc-800">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal leading-6" /></label>;
}
