"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DiagnosisAction,
  DiagnosisCharacterFinding,
  DiagnosisStrengthChallenge,
  GeneratedDiagnosis,
} from "@/lib/diagnosis/engine";
import type { DiagnosisMode } from "@/lib/domain/diagnosis";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Workspace = {
  id: string;
  name: string;
  role: string;
  canApprove: boolean;
};

type Student = {
  id: string;
  name: string;
  classId: string | null;
  className: string;
};

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
  academic_session: string;
  term: string;
  reviewed_at: string | null;
  finalised_at: string | null;
  updated_at: string;
};

type DiagnosisEntry = {
  row: DiagnosisRow;
  generated: GeneratedDiagnosis;
};

type Payload = {
  workspace: Workspace;
  students: Student[];
  assessments: Assessment[];
  diagnoses: DiagnosisEntry[];
  modelPolicy: string;
};

type Observation = {
  domain: "academic" | "skill" | "character";
  statement: string;
};

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

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function requestedAssessmentId() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search)
    .get("assessment")
    ?.trim();
  return value || null;
}

function replaceAssessmentWorkflowUrl(assessmentId: string) {
  if (typeof window === "undefined") return;
  const url = assessmentId
    ? `/diagnosis?assessment=${encodeURIComponent(assessmentId)}`
    : "/diagnosis";
  window.history.replaceState(window.history.state, "", url);
}

function observation(
  domain: Observation["domain"],
  label: string,
  value: string,
): Observation | null {
  const statement = clean(value);
  if (!statement) return null;
  return { domain, statement: `${label}: ${statement}` };
}

function teacherObservations(sheet: TeacherSheet) {
  return [
    observation("academic", "Academic/Skills observation", sheet.academicObservations),
    observation("character", "Character/Discipline observation", sheet.characterObservations),
    observation(
      "academic",
      "Teacher-indicated Academic/Skills strength evidence",
      sheet.academicStrengthIndicators,
    ),
    observation(
      "academic",
      "Teacher-indicated Academic/Skills challenge evidence",
      sheet.academicChallengeIndicators,
    ),
    observation(
      "character",
      "Teacher-indicated Character/Discipline strength evidence",
      sheet.characterStrengthIndicators,
    ),
    observation(
      "character",
      "Teacher-indicated Character/Discipline challenge evidence",
      sheet.characterChallengeIndicators,
    ),
    observation(
      sheet.additionalNotesDomain,
      "Additional factual teacher context",
      sheet.additionalNotes,
    ),
  ].filter((item): item is Observation => Boolean(item));
}

export function KaecDiagnosisClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [mode, setMode] = useState<DiagnosisMode>("quick_teacher");
  const [studentId, setStudentId] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [term, setTerm] = useState("");
  const [classSessions, setClassSessions] = useState<Record<string, string>>({});
  const [teacherSheet, setTeacherSheet] = useState<TeacherSheet>(EMPTY_SHEET);

  const [assessmentId, setAssessmentId] = useState("");
  const [earnedMarks, setEarnedMarks] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [itemMarks, setItemMarks] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const [active, setActive] = useState<DiagnosisEntry | null>(null);
  const assessmentHandoffApplied = useRef(false);

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
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }, []);

  const refresh = useCallback(async () => {
    const response = await authenticatedFetch("/api/diagnosis");
    const payload = (await response.json()) as Payload & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Diagnosis workspace could not be loaded.");
    }

    const classIds = [
      ...new Set(
        payload.students
          .map((student) => student.classId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const sessions: Record<string, string> = {};
    if (classIds.length) {
      const supabase = getBrowserSupabaseClient();
      const { data: classRows, error: classError } = await supabase
        .from("classes")
        .select("id,academic_session")
        .in("id", classIds);
      if (classError) throw classError;
      for (const row of classRows ?? []) {
        if (row.academic_session) sessions[row.id] = row.academic_session;
      }
    }

    setClassSessions(sessions);
    setData(payload);

    if (!assessmentHandoffApplied.current) {
      assessmentHandoffApplied.current = true;
      const linkedAssessmentId = requestedAssessmentId();
      if (linkedAssessmentId) {
        const linkedAssessment = payload.assessments.find(
          (assessment) =>
            assessment.id === linkedAssessmentId && assessment.status !== "archived",
        );
        if (!linkedAssessment) {
          setError(
            "The linked assessment is not available as diagnosis evidence in the active workspace.",
          );
        } else {
          setMode("assessment_based");
          setAssessmentId(linkedAssessmentId);
          setItemMarks({});
          setItemNotes({});
          setNotice(
            `Assessment evidence loaded: ${linkedAssessment.title}. Select the learner and enter the observed results before generating the diagnosis.`,
          );
        }
      }
    }

    const nextStudentId = studentId || payload.students[0]?.id || "";
    if (!studentId && nextStudentId) setStudentId(nextStudentId);
    const student = payload.students.find((item) => item.id === nextStudentId);
    if (student?.classId && sessions[student.classId] && !academicSession) {
      setAcademicSession(sessions[student.classId]);
    }
  }, [academicSession, authenticatedFetch, studentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
        .catch((caught) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Diagnosis workspace could not be loaded.",
          ),
        )
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
      const validation = payload.validation as
        | { violations?: { message?: string }[] }
        | undefined;
      const details = validation?.violations
        ?.map((item) => item.message)
        .filter(Boolean)
        .join(" ");
      throw new Error(
        `${typeof payload.error === "string" ? payload.error : "Diagnosis request failed."}${details ? ` ${details}` : ""}`,
      );
    }
    return payload;
  }

  async function saveReportContext(diagnosisId: string) {
    const supabase = getBrowserSupabaseClient();
    const { data: contextRow, error: contextError } = await supabase.rpc(
      "set_diagnosis_report_context",
      {
        target_diagnosis_id: diagnosisId,
        target_academic_session: academicSession.trim(),
        target_term: term.trim(),
      },
    );
    if (contextError) throw contextError;
    return contextRow as DiagnosisRow;
  }

  function onStudentChange(nextStudentId: string) {
    setStudentId(nextStudentId);
    const student = data?.students.find((item) => item.id === nextStudentId);
    if (student?.classId && classSessions[student.classId]) {
      setAcademicSession(classSessions[student.classId]);
    }
  }

  function onModeChange(nextMode: DiagnosisMode) {
    setMode(nextMode);
    if (nextMode === "quick_teacher") {
      setAssessmentId("");
      setItemMarks({});
      setItemNotes({});
      replaceAssessmentWorkflowUrl("");
    }
  }

  function onAssessmentChange(nextAssessmentId: string) {
    setAssessmentId(nextAssessmentId);
    setItemMarks({});
    setItemNotes({});
    replaceAssessmentWorkflowUrl(nextAssessmentId);
  }

  async function generate() {
    if (!data?.workspace || !studentId) return;
    const observations = teacherObservations(teacherSheet);

    if (!academicSession.trim()) {
      setError("Academic Session is required for the parent diagnosis report.");
      return;
    }
    if (!term.trim()) {
      setError("Select the Term for this diagnosis report.");
      return;
    }
    if (mode === "quick_teacher" && observations.length < 2) {
      setError(
        "Quick Teacher Diagnosis needs at least two first-hand observations or indicators.",
      );
      return;
    }
    if (mode !== "quick_teacher" && !assessmentId) {
      setError("Select the saved assessment used as diagnosis evidence.");
      return;
    }

    setBusy("generate");
    setError(null);
    setNotice(null);

    try {
      const itemResults =
        selectedAssessment?.items
          .filter((item) => itemMarks[item.id]?.trim() !== "")
          .map((item) => ({
            assessmentItemId: item.id,
            awardedMarks: Number(itemMarks[item.id]),
            note: itemNotes[item.id]?.trim() ?? "",
          })) ?? [];

      const score =
        earnedMarks.trim() && totalMarks.trim()
          ? {
              earnedMarks: Number(earnedMarks),
              totalMarks: Number(totalMarks),
            }
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
          observations,
        },
      });

      const generated = payload.generated as GeneratedDiagnosis;
      const created = payload.diagnosis as DiagnosisRow;
      const contextRow = await saveReportContext(created.id);
      const entry: DiagnosisEntry = { row: contextRow, generated };

      setActive(entry);
      setNotice(
        "Diagnosis draft generated from the teacher's first-hand input and saved evidence. Review the KAEC parent sheet carefully before marking it Reviewed.",
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Diagnosis generation failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  function updateGenerated(next: GeneratedDiagnosis) {
    setActive((current) => (current ? { ...current, generated: next } : current));
  }

  async function saveEdits() {
    if (!active) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const payload = await post({
        action: "save_edits",
        diagnosisId: active.row.id,
        diagnosis: active.generated,
      });
      const entry: DiagnosisEntry = {
        row: payload.diagnosis as DiagnosisRow,
        generated: payload.generated as GeneratedDiagnosis,
      };
      setActive(entry);
      setNotice(
        entry.row.status === "draft"
          ? "Changes saved. Any previous review was invalidated, so the updated parent sheet must be reviewed again."
          : "Changes saved.",
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Diagnosis changes could not be saved.",
      );
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
      const payload = await post({
        action,
        diagnosisId: active.row.id,
      });
      const entry: DiagnosisEntry = {
        row: payload.diagnosis as DiagnosisRow,
        generated: payload.generated as GeneratedDiagnosis,
      };
      setActive(entry);
      setNotice(
        action === "review"
          ? "Teacher review recorded. Owner/Admin approval is now required before the parent report is released."
          : "Final approval recorded. The parent report is locked and ready for preview/download.",
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Diagnosis lifecycle action failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!active) return;
    setBusy("pdf");
    setError(null);
    try {
      const response = await authenticatedFetch(
        `/api/diagnosis/pdf?id=${encodeURIComponent(active.row.id)}`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Parent report could not be downloaded.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const reportStudent = data?.students.find(
        (item) => item.id === active.row.student_id,
      );
      anchor.href = url;
      anchor.download = `${reportStudent?.name || "student"}-kaec-diagnosis.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Parent report could not be downloaded.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <p className="text-sm font-medium text-zinc-500">
          Loading Diagnosis Intelligence...
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
      <div className="grid gap-7 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              KAEC first-hand diagnosis sheet
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Student Diagnosis Intelligence
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Start with what the school has actually seen. KSI uses the teacher's
              evidence to organise strengths, challenges and practical School/Parent
              action plans. AI never replaces the teacher's first-hand information.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Diagnosis mode">
                <select
                  value={mode}
                  onChange={(event) =>
                    onModeChange(event.target.value as DiagnosisMode)
                  }
                  className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                >
                  <option value="quick_teacher">Quick Teacher Diagnosis</option>
                  <option value="assessment_based">
                    Assessment-Based Diagnosis
                  </option>
                  <option value="combined">Combined Diagnosis</option>
                </select>
              </Field>
              <Field label="Student">
                <select
                  value={studentId}
                  onChange={(event) => onStudentChange(event.target.value)}
                  className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                >
                  <option value="">Select student</option>
                  {data?.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} - {student.className}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Academic Session">
                <input
                  value={academicSession}
                  onChange={(event) => setAcademicSession(event.target.value)}
                  placeholder="e.g. 2026/2027"
                  className="min-h-11 rounded-xl border border-zinc-300 px-3"
                />
              </Field>
              <Field label="Term">
                <select
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                >
                  <option value="">Select term</option>
                  {TERMS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-emerald-50/40 p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  First-hand Teacher Input
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Describe observable behaviour, work, performance and response to
                  guidance. Avoid labels such as lazy, dull or stubborn.
                </p>
              </div>

              <div className="mt-4 grid gap-4">
                <SheetTextarea
                  label="Academic / Skills Observations"
                  value={teacherSheet.academicObservations}
                  onChange={(value) =>
                    setTeacherSheet((current) => ({
                      ...current,
                      academicObservations: value,
                    }))
                  }
                  placeholder="What has the learner been doing academically or in practical skills? Include concrete examples."
                />
                <SheetTextarea
                  label="Character / Discipline Observations"
                  value={teacherSheet.characterObservations}
                  onChange={(value) =>
                    setTeacherSheet((current) => ({
                      ...current,
                      characterObservations: value,
                    }))
                  }
                  placeholder="What has been observed about responsibility, conduct, punctuality, teamwork, response to correction or self-management?"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <SheetTextarea
                    label="Academic / Skills Strength Indicators"
                    value={teacherSheet.academicStrengthIndicators}
                    onChange={(value) =>
                      setTeacherSheet((current) => ({
                        ...current,
                        academicStrengthIndicators: value,
                      }))
                    }
                    placeholder="Evidence of what the learner currently does well."
                  />
                  <SheetTextarea
                    label="Academic / Skills Challenge Indicators"
                    value={teacherSheet.academicChallengeIndicators}
                    onChange={(value) =>
                      setTeacherSheet((current) => ({
                        ...current,
                        academicChallengeIndicators: value,
                      }))
                    }
                    placeholder="Evidence of where the learner currently struggles or needs support."
                  />
                  <SheetTextarea
                    label="Character Strength Indicators"
                    value={teacherSheet.characterStrengthIndicators}
                    onChange={(value) =>
                      setTeacherSheet((current) => ({
                        ...current,
                        characterStrengthIndicators: value,
                      }))
                    }
                    placeholder="Positive habits, responsibility, discipline or relational strengths observed."
                  />
                  <SheetTextarea
                    label="Character Challenge Indicators"
                    value={teacherSheet.characterChallengeIndicators}
                    onChange={(value) =>
                      setTeacherSheet((current) => ({
                        ...current,
                        characterChallengeIndicators: value,
                      }))
                    }
                    placeholder="Observable conduct or self-management areas that need development."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
                  <Field label="Additional notes relate to">
                    <select
                      value={teacherSheet.additionalNotesDomain}
                      onChange={(event) =>
                        setTeacherSheet((current) => ({
                          ...current,
                          additionalNotesDomain: event.target
                            .value as TeacherSheet["additionalNotesDomain"],
                        }))
                      }
                      className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                    >
                      <option value="academic">Academics</option>
                      <option value="skill">Skills</option>
                      <option value="character">Character</option>
                    </select>
                  </Field>
                  <SheetTextarea
                    label="Additional Factual Notes"
                    value={teacherSheet.additionalNotes}
                    onChange={(value) =>
                      setTeacherSheet((current) => ({
                        ...current,
                        additionalNotes: value,
                      }))
                    }
                    placeholder="Any other first-hand context that genuinely helps the diagnosis."
                  />
                </div>
              </div>
            </div>

            {mode !== "quick_teacher" ? (
              <div className="mt-5 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                <Field label="Assessment Evidence">
                  <select
                    value={assessmentId}
                    onChange={(event) => onAssessmentChange(event.target.value)}
                    className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                  >
                    <option value="">Select saved assessment</option>
                    {data?.assessments
                      .filter((assessment) => assessment.status !== "archived")
                      .map((assessment) => (
                        <option key={assessment.id} value={assessment.id}>
                          {assessment.title}
                        </option>
                      ))}
                  </select>
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Earned marks">
                    <input
                      value={earnedMarks}
                      onChange={(event) => setEarnedMarks(event.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 14"
                      className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                    />
                  </Field>
                  <Field label="Total marks">
                    <input
                      value={totalMarks}
                      onChange={(event) => setTotalMarks(event.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 20"
                      className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3"
                    />
                  </Field>
                </div>

                {selectedAssessment?.items.length ? (
                  <details className="rounded-xl border border-zinc-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                      Add item-level evidence ({selectedAssessment.items.length} items)
                    </summary>
                    <div className="mt-4 grid gap-3">
                      {selectedAssessment.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-zinc-200 p-3"
                        >
                          <p className="text-sm font-semibold text-zinc-900">
                            Item {item.position} - {titleCase(item.item_type)} -{" "}
                            {Number(item.marks ?? 0)} marks
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {item.topic || "Topic not labelled"}
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
                            <input
                              value={itemMarks[item.id] ?? ""}
                              onChange={(event) =>
                                setItemMarks((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              inputMode="decimal"
                              placeholder="Marks"
                              className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm"
                            />
                            <input
                              value={itemNotes[item.id] ?? ""}
                              onChange={(event) =>
                                setItemNotes((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Optional factual note"
                              className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {notice}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!studentId || busy !== null}
              onClick={() => void generate()}
              className="mt-5 min-h-12 w-full rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === "generate"
                ? "Generating KAEC diagnosis..."
                : "Generate Diagnosis Draft"}
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Saved diagnoses</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Reopen a diagnosis to review, edit, approve or download it.
            </p>
            <div className="mt-4 grid gap-2">
              {data?.diagnoses.length ? (
                data.diagnoses.map((entry) => {
                  const student = data.students.find(
                    (candidate) => candidate.id === entry.row.student_id,
                  );
                  return (
                    <button
                      key={entry.row.id}
                      type="button"
                      onClick={() => setActive(entry)}
                      className="rounded-xl border border-zinc-200 p-3 text-left transition hover:bg-stone-50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-900">
                          {student?.name || "Student"}
                        </span>
                        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600">
                          {entry.row.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {entry.row.academic_session || "Session not set"} -{" "}
                        {entry.row.term || "Term not set"} -{" "}
                        {titleCase(entry.row.diagnosis_mode)}
                      </p>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">No saved diagnoses yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          {active ? (
            <>
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      Internal evidence review
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                      Evidence before conclusion
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      This reasoning layer is for school review. The parent report below
                      stays clear and practical.
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-800">
                    {active.row.status}
                  </span>
                </div>

                <details className="mt-5 rounded-2xl border border-zinc-200 p-4" open>
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                    Observed Evidence / Patterns / Possible Interpretations
                  </summary>
                  <div className="mt-4 grid gap-4">
                    <ReviewGroup title="Observed Evidence">
                      {active.generated.observedEvidence.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-zinc-200 bg-stone-50 p-3 text-sm"
                        >
                          <span className="font-semibold capitalize">
                            {item.domain}
                          </span>{" "}
                          - {item.statement}
                          {item.metric ? (
                            <span className="ml-2 text-zinc-500">
                              ({item.metric})
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </ReviewGroup>
                    <ReviewGroup title="Detected Patterns">
                      {active.generated.detectedPatterns.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-zinc-200 p-3 text-sm"
                        >
                          <span className="font-semibold capitalize">
                            {item.confidence} confidence:
                          </span>{" "}
                          {item.statement}
                        </div>
                      ))}
                    </ReviewGroup>
                    <ReviewGroup title="Possible Interpretations">
                      {active.generated.possibleInterpretations.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm"
                        >
                          <span className="font-semibold">
                            Possible, {item.confidence} confidence:
                          </span>{" "}
                          {item.statement}
                          <p className="mt-1 text-xs text-zinc-500">
                            Uncertainty: {item.uncertaintyNote}
                          </p>
                        </div>
                      ))}
                    </ReviewGroup>
                    <ReviewGroup title="Evidence Limitations">
                      <ul className="grid gap-2 text-sm text-zinc-700">
                        {active.generated.evidenceLimitations.map((item, index) => (
                          <li key={index}>- {item}</li>
                        ))}
                      </ul>
                    </ReviewGroup>
                  </div>
                </details>
              </div>

              <ParentSheetEditor
                entry={active}
                onChange={updateGenerated}
                readOnly={active.row.status === "final"}
              />

              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {active.row.status !== "final" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void saveEdits()}
                      className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold"
                    >
                      {busy === "save" ? "Saving..." : "Save Changes"}
                    </button>
                  ) : null}
                  {active.row.status === "draft" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void lifecycle("review")}
                      className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      {busy === "review" ? "Recording review..." : "Mark Reviewed"}
                    </button>
                  ) : null}
                  {active.row.status === "reviewed" ? (
                    <button
                      type="button"
                      disabled={busy !== null || !data?.workspace.canApprove}
                      onClick={() => void lifecycle("approve")}
                      className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {busy === "approve"
                        ? "Approving..."
                        : data?.workspace.canApprove
                          ? "Approve Final Report"
                          : "Owner/Admin Approval Required"}
                    </button>
                  ) : null}
                  {active.row.status === "final" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void downloadPdf()}
                      className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      {busy === "pdf" ? "Preparing PDF..." : "Download Parent PDF"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  Reviewed: {dateLabel(active.row.reviewed_at)} - Approved:{" "}
                  {dateLabel(active.row.finalised_at)}. Editing reviewed content returns
                  the diagnosis to Draft and requires a fresh review.
                </p>
              </div>

              {active.row.status === "final" ? (
                <ParentSheetPreview
                  entry={active}
                  student={
                    data?.students.find(
                      (item) => item.id === active.row.student_id,
                    ) ?? null
                  }
                  workspaceName={data?.workspace.name ?? "KAEC School"}
                />
              ) : null}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Generate a diagnosis or open a saved diagnosis to begin review.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      {label}
      {children}
    </label>
  );
}

function SheetTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-800">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal leading-6"
      />
    </label>
  );
}

function ReviewGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}

function ParentSheetEditor({
  entry,
  onChange,
  readOnly,
}: {
  entry: DiagnosisEntry;
  onChange: (next: GeneratedDiagnosis) => void;
  readOnly: boolean;
}) {
  const diagnosis = entry.generated;
  const set = <K extends keyof GeneratedDiagnosis>(
    key: K,
    value: GeneratedDiagnosis[K],
  ) => onChange({ ...diagnosis, [key]: value });

  return (
    <div className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Parent-facing KAEC sheet
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-950">
            Review what the parent will receive
          </h2>
        </div>
        <div className="text-xs text-zinc-500">
          <p>{entry.row.academic_session || "Session not set"}</p>
          <p>{entry.row.term || "Term not set"}</p>
        </div>
      </div>

      <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-800">
        Diagnosis
        <textarea
          readOnly={readOnly}
          value={diagnosis.conciseDiagnosis}
          onChange={(event) => set("conciseDiagnosis", event.target.value)}
          className="min-h-28 rounded-xl border border-zinc-300 px-3 py-2 font-normal leading-6"
        />
      </label>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ParentQuadrant
          title="ACADEMICS / SKILLS"
          leftTitle="Strengths"
          rightTitle="Challenges"
          left={diagnosis.academicSkillStrengths}
          right={diagnosis.academicSkillChallenges}
          readOnly={readOnly}
          onLeft={(items) => set("academicSkillStrengths", items)}
          onRight={(items) => set("academicSkillChallenges", items)}
        />
        <CharacterQuadrant
          title="CHARACTER (Discipline)"
          leftTitle="Strengths"
          rightTitle="Challenges"
          left={diagnosis.characterStrengths}
          right={diagnosis.characterChallenges}
          readOnly={readOnly}
          onLeft={(items) => set("characterStrengths", items)}
          onRight={(items) => set("characterChallenges", items)}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ActionQuadrant
          title="ACTION PLAN (Academics / Skills)"
          school={diagnosis.schoolAcademicActions}
          parents={diagnosis.parentAcademicActions}
          readOnly={readOnly}
          onSchool={(items) => set("schoolAcademicActions", items)}
          onParents={(items) => set("parentAcademicActions", items)}
        />
        <ActionQuadrant
          title="ACTION PLAN (Character)"
          school={diagnosis.schoolCharacterActions}
          parents={diagnosis.parentCharacterActions}
          readOnly={readOnly}
          onSchool={(items) => set("schoolCharacterActions", items)}
          onParents={(items) => set("parentCharacterActions", items)}
        />
      </div>

      <label className="mt-5 grid gap-2 text-sm font-semibold text-zinc-800">
        Builder Growth Direction
        <textarea
          readOnly={readOnly}
          value={diagnosis.builderGrowthDirection}
          onChange={(event) => set("builderGrowthDirection", event.target.value)}
          className="min-h-24 rounded-xl border border-zinc-300 px-3 py-2 font-normal leading-6"
        />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-zinc-800">
        Encouragement Note
        <textarea
          readOnly={readOnly}
          value={diagnosis.encouragementNote}
          onChange={(event) => set("encouragementNote", event.target.value)}
          className="min-h-24 rounded-xl border border-zinc-300 px-3 py-2 font-normal leading-6"
        />
      </label>
    </div>
  );
}

function ParentQuadrant({
  title,
  leftTitle,
  rightTitle,
  left,
  right,
  readOnly,
  onLeft,
  onRight,
}: {
  title: string;
  leftTitle: string;
  rightTitle: string;
  left: DiagnosisStrengthChallenge[];
  right: DiagnosisStrengthChallenge[];
  readOnly: boolean;
  onLeft: (items: DiagnosisStrengthChallenge[]) => void;
  onRight: (items: DiagnosisStrengthChallenge[]) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-950/15">
      <div className="bg-emerald-950 px-4 py-2 text-center text-sm font-semibold text-white">
        {title}
      </div>
      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <EditableFindingColumn
          title={leftTitle}
          items={left}
          readOnly={readOnly}
          onChange={onLeft}
        />
        <EditableFindingColumn
          title={rightTitle}
          items={right}
          readOnly={readOnly}
          onChange={onRight}
        />
      </div>
    </div>
  );
}

function CharacterQuadrant({
  title,
  leftTitle,
  rightTitle,
  left,
  right,
  readOnly,
  onLeft,
  onRight,
}: {
  title: string;
  leftTitle: string;
  rightTitle: string;
  left: DiagnosisCharacterFinding[];
  right: DiagnosisCharacterFinding[];
  readOnly: boolean;
  onLeft: (items: DiagnosisCharacterFinding[]) => void;
  onRight: (items: DiagnosisCharacterFinding[]) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-950/15">
      <div className="bg-emerald-950 px-4 py-2 text-center text-sm font-semibold text-white">
        {title}
      </div>
      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <EditableCharacterColumn
          title={leftTitle}
          items={left}
          readOnly={readOnly}
          onChange={onLeft}
        />
        <EditableCharacterColumn
          title={rightTitle}
          items={right}
          readOnly={readOnly}
          onChange={onRight}
        />
      </div>
    </div>
  );
}

function EditableFindingColumn({
  title,
  items,
  readOnly,
  onChange,
}: {
  title: string;
  items: DiagnosisStrengthChallenge[];
  readOnly: boolean;
  onChange: (items: DiagnosisStrengthChallenge[]) => void;
}) {
  return (
    <div className="min-w-0 bg-white p-3">
      <p className="rounded-lg bg-[#f5f0df] px-2 py-1.5 text-center text-xs font-semibold text-zinc-800">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item, index) => (
            <textarea
              key={index}
              readOnly={readOnly}
              value={item.statement}
              onChange={(event) =>
                onChange(
                  items.map((candidate, itemIndex) =>
                    itemIndex === index
                      ? { ...candidate, statement: event.target.value }
                      : candidate,
                  ),
                )
              }
              className="min-h-24 w-full rounded-lg border border-zinc-200 p-2 text-xs leading-5"
            />
          ))
        ) : (
          <p className="text-xs text-zinc-400">No supported finding.</p>
        )}
      </div>
    </div>
  );
}

function EditableCharacterColumn({
  title,
  items,
  readOnly,
  onChange,
}: {
  title: string;
  items: DiagnosisCharacterFinding[];
  readOnly: boolean;
  onChange: (items: DiagnosisCharacterFinding[]) => void;
}) {
  return (
    <div className="min-w-0 bg-white p-3">
      <p className="rounded-lg bg-[#f5f0df] px-2 py-1.5 text-center text-xs font-semibold text-zinc-800">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item, index) => (
            <textarea
              key={index}
              readOnly={readOnly}
              value={item.statement}
              onChange={(event) =>
                onChange(
                  items.map((candidate, itemIndex) =>
                    itemIndex === index
                      ? { ...candidate, statement: event.target.value }
                      : candidate,
                  ),
                )
              }
              className="min-h-24 w-full rounded-lg border border-zinc-200 p-2 text-xs leading-5"
            />
          ))
        ) : (
          <p className="text-xs text-zinc-400">No supported finding.</p>
        )}
      </div>
    </div>
  );
}

function ActionQuadrant({
  title,
  school,
  parents,
  readOnly,
  onSchool,
  onParents,
}: {
  title: string;
  school: DiagnosisAction[];
  parents: DiagnosisAction[];
  readOnly: boolean;
  onSchool: (items: DiagnosisAction[]) => void;
  onParents: (items: DiagnosisAction[]) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-950/15">
      <div className="bg-emerald-950 px-4 py-2 text-center text-sm font-semibold text-white">
        {title}
      </div>
      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <EditableActionColumn
          title="SCHOOL"
          items={school}
          readOnly={readOnly}
          onChange={onSchool}
        />
        <EditableActionColumn
          title="PARENTS"
          items={parents}
          readOnly={readOnly}
          onChange={onParents}
        />
      </div>
    </div>
  );
}

function EditableActionColumn({
  title,
  items,
  readOnly,
  onChange,
}: {
  title: string;
  items: DiagnosisAction[];
  readOnly: boolean;
  onChange: (items: DiagnosisAction[]) => void;
}) {
  return (
    <div className="min-w-0 bg-white p-3">
      <p className="rounded-lg bg-[#f5f0df] px-2 py-1.5 text-center text-xs font-semibold text-zinc-800">
        {title}
      </p>
      <div className="mt-3 grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={index} className="grid gap-1.5">
              <textarea
                readOnly={readOnly}
                value={item.action}
                onChange={(event) =>
                  onChange(
                    items.map((candidate, itemIndex) =>
                      itemIndex === index
                        ? { ...candidate, action: event.target.value }
                        : candidate,
                    ),
                  )
                }
                className="min-h-24 w-full rounded-lg border border-zinc-200 p-2 text-xs leading-5"
              />
              <input
                readOnly={readOnly}
                value={item.timeframe}
                onChange={(event) =>
                  onChange(
                    items.map((candidate, itemIndex) =>
                      itemIndex === index
                        ? { ...candidate, timeframe: event.target.value }
                        : candidate,
                    ),
                  )
                }
                className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs"
                placeholder="Timeframe"
              />
            </div>
          ))
        ) : (
          <p className="text-xs text-zinc-400">No action generated.</p>
        )}
      </div>
    </div>
  );
}

function ParentSheetPreview({
  entry,
  student,
  workspaceName,
}: {
  entry: DiagnosisEntry;
  student: Student | null;
  workspaceName: string;
}) {
  const diagnosis = entry.generated;
  return (
    <div className="rounded-3xl border border-emerald-950/15 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Parent Report Preview
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-emerald-950">
            {workspaceName}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {student?.name || "Student"} - {student?.className || "Class not linked"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 px-4 py-3 text-xs text-zinc-600">
          <p>
            <span className="font-semibold">SESSION:</span>{" "}
            {entry.row.academic_session}
          </p>
          <p className="mt-1">
            <span className="font-semibold">TERM:</span> {entry.row.term}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-950/15 bg-[#f8f4e8] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-950">
          Diagnosis
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-800">
          {diagnosis.conciseDiagnosis}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PreviewQuadrant
          title="ACADEMICS / SKILLS"
          leftTitle="Strengths"
          rightTitle="Challenges"
          left={diagnosis.academicSkillStrengths.map((item) => item.statement)}
          right={diagnosis.academicSkillChallenges.map((item) => item.statement)}
        />
        <PreviewQuadrant
          title="CHARACTER (Discipline)"
          leftTitle="Strengths"
          rightTitle="Challenges"
          left={diagnosis.characterStrengths.map((item) => item.statement)}
          right={diagnosis.characterChallenges.map((item) => item.statement)}
        />
        <PreviewQuadrant
          title="ACTION PLAN (Academics / Skills)"
          leftTitle="SCHOOL"
          rightTitle="PARENTS"
          left={diagnosis.schoolAcademicActions.map(
            (item) => `${item.action} (${item.timeframe})`,
          )}
          right={diagnosis.parentAcademicActions.map(
            (item) => `${item.action} (${item.timeframe})`,
          )}
        />
        <PreviewQuadrant
          title="ACTION PLAN (Character)"
          leftTitle="SCHOOL"
          rightTitle="PARENTS"
          left={diagnosis.schoolCharacterActions.map(
            (item) => `${item.action} (${item.timeframe})`,
          )}
          right={diagnosis.parentCharacterActions.map(
            (item) => `${item.action} (${item.timeframe})`,
          )}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-900">
            Builder Growth Direction
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            {diagnosis.builderGrowthDirection}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-900">
            Encouragement Note
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            {diagnosis.encouragementNote}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewQuadrant({
  title,
  leftTitle,
  rightTitle,
  left,
  right,
}: {
  title: string;
  leftTitle: string;
  rightTitle: string;
  left: string[];
  right: string[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-950/15">
      <div className="bg-emerald-950 px-3 py-2 text-center text-xs font-semibold text-white">
        {title}
      </div>
      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <PreviewColumn title={leftTitle} items={left} />
        <PreviewColumn title={rightTitle} items={right} />
      </div>
    </div>
  );
}

function PreviewColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-h-40 p-3">
      <p className="rounded-md bg-[#f5f0df] px-2 py-1 text-center text-[11px] font-semibold text-zinc-800">
        {title}
      </p>
      <ul className="mt-3 grid gap-2 text-xs leading-5 text-zinc-700">
        {items.length ? (
          items.map((item, index) => <li key={index}>- {item}</li>)
        ) : (
          <li className="text-zinc-400">Insufficient Evidence.</li>
        )}
      </ul>
    </div>
  );
}
