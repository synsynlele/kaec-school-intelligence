"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  parseGeneratedAssessment,
  type AssessmentItemCounts,
  type AssessmentMode,
  type AssessmentValidation,
  type GeneratedAssessment,
  type GeneratedAssessmentItem,
} from "@/lib/assessment/engine";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const ITEM_TYPES = [
  { value: "objective", label: "Objective" },
  { value: "subjective", label: "Subjective" },
  { value: "critical_thinking", label: "Critical Thinking" },
  { value: "project", label: "Project" },
] as const;

const CRITICAL_LABELS: Record<string, string> = {
  reality_simulation: "Reality Simulation",
  imperfect_choice: "Imperfect Choice",
  hidden_problem: "Hidden Problem",
  creation: "Creation",
  crisis: "Crisis",
};

type Workspace = {
  id: string;
  name: string;
  workspace_type: "individual" | "school";
};

type Subject = { id: string; name: string };
type SchoolClass = { id: string; name: string; age_range: string | null };
type Resource = {
  id: string;
  title: string;
  resource_type: string;
  visibility: string;
  status: string;
  mime_type: string | null;
};
type LessonSummary = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  status: "draft" | "validated" | "archived";
  class_id: string | null;
  subject_id: string | null;
  age_range: string | null;
};
type AssessmentSummary = {
  id: string;
  title: string;
  assessment_mode: AssessmentMode;
  status: "draft" | "validated" | "archived";
  source_lesson_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  blueprint: unknown;
  source_context: unknown;
  updated_at: string;
};
type AssessmentItemRow = {
  position: number;
  item_type: GeneratedAssessmentItem["itemType"];
  critical_thinking_type: GeneratedAssessmentItem["criticalThinkingType"] | null;
  topic: string | null;
  objective: string | null;
  difficulty: string | null;
  marks: number | null;
  content: unknown;
  answer_key: unknown;
  marking_guide: unknown;
};

type WorkspaceState = {
  workspace: Workspace;
  subjects: Subject[];
  classes: SchoolClass[];
  resources: Resource[];
  lessons: LessonSummary[];
  assessments: AssessmentSummary[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readValidation(value: unknown): AssessmentValidation | null {
  if (!isRecord(value)) return null;
  const violations = Array.isArray(value.violations)
    ? value.violations
        .map((item) => {
          if (!isRecord(item)) return null;
          return {
            code: typeof item.code === "string" ? item.code : "assessment_validation",
            message:
              typeof item.message === "string"
                ? item.message
                : "Assessment validation needs attention.",
            itemPosition:
              typeof item.itemPosition === "number" ? item.itemPosition : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  return {
    passed: value.passed === true,
    score: typeof value.score === "number" ? value.score : 0,
    violations,
    evidence: readStringList(value.evidence),
  };
}

function itemFromRow(row: AssessmentItemRow): GeneratedAssessmentItem {
  const content = isRecord(row.content) ? row.content : {};
  const answer = isRecord(row.answer_key) ? row.answer_key : {};
  const marking = isRecord(row.marking_guide) ? row.marking_guide : {};
  const difficulty =
    row.difficulty === "easy" ||
    row.difficulty === "moderate" ||
    row.difficulty === "challenging"
      ? row.difficulty
      : "moderate";
  return {
    position: row.position,
    itemType: row.item_type,
    criticalThinkingType: row.critical_thinking_type ?? "",
    topic: row.topic ?? "",
    objective: row.objective ?? "",
    competency: typeof content.competency === "string" ? content.competency : "",
    difficulty,
    marks: Number(row.marks ?? 0),
    prompt: typeof content.prompt === "string" ? content.prompt : "",
    options: readStringList(content.options),
    correctAnswer:
      typeof answer.correctAnswer === "string" ? answer.correctAnswer : "",
    answerRationale:
      typeof content.answerRationale === "string"
        ? content.answerRationale
        : typeof answer.rationale === "string"
          ? answer.rationale
          : "",
    expectedEvidence: readStringList(content.expectedEvidence),
    markingGuide: readStringList(marking.criteria),
    deliverable: typeof content.deliverable === "string" ? content.deliverable : "",
    constraints: readStringList(content.constraints),
  };
}

function assessmentFromRows(
  assessment: AssessmentSummary,
  items: AssessmentItemRow[],
): GeneratedAssessment {
  const blueprint = isRecord(assessment.blueprint) ? assessment.blueprint : {};
  return parseGeneratedAssessment({
    title: assessment.title,
    studentInstructions:
      typeof blueprint.studentInstructions === "string"
        ? blueprint.studentInstructions
        : "Answer all questions as instructed.",
    blueprint,
    items: items.map(itemFromRow),
  });
}

async function loadWorkspaceState(): Promise<WorkspaceState | null> {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile.default_workspace_id) {
    throw new Error("Choose an active workspace before creating an assessment.");
  }

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, subjectResult, classResult, resourceResult, lessonResult, assessmentResult] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("id,name,workspace_type")
        .eq("id", workspaceId)
        .single(),
      supabase
        .from("subjects")
        .select("id,name")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("classes")
        .select("id,name,age_range")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("resources")
        .select("id,title,resource_type,visibility,status,mime_type")
        .eq("workspace_id", workspaceId)
        .in("status", ["uploaded", "ready"])
        .order("created_at", { ascending: false }),
      supabase
        .from("lessons")
        .select("id,title,topic,objective,status,class_id,subject_id,age_range")
        .eq("workspace_id", workspaceId)
        .eq("status", "validated")
        .order("updated_at", { ascending: false }),
      supabase
        .from("assessments")
        .select(
          "id,title,assessment_mode,status,source_lesson_id,class_id,subject_id,blueprint,source_context,updated_at",
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }),
    ]);

  const firstError =
    workspaceResult.error ??
    subjectResult.error ??
    classResult.error ??
    resourceResult.error ??
    lessonResult.error ??
    assessmentResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data) throw new Error("The active workspace could not be loaded.");

  return {
    workspace: workspaceResult.data as Workspace,
    subjects: (subjectResult.data ?? []) as Subject[],
    classes: (classResult.data ?? []) as SchoolClass[],
    resources: (resourceResult.data ?? []) as Resource[],
    lessons: (lessonResult.data ?? []) as LessonSummary[],
    assessments: (assessmentResult.data ?? []) as AssessmentSummary[],
  };
}

export function AssessmentClient() {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("mixed");
  const [totalItems, setTotalItems] = useState("10");
  const [totalMarks, setTotalMarks] = useState("20");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [purpose, setPurpose] = useState("");
  const [teacherInstructions, setTeacherInstructions] = useState("");
  const [sourceLessonId, setSourceLessonId] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [counts, setCounts] = useState<AssessmentItemCounts>({
    objective: 4,
    subjective: 3,
    critical_thinking: 2,
    project: 1,
  });

  const [selectedAssessment, setSelectedAssessment] =
    useState<AssessmentSummary | null>(null);
  const [editor, setEditor] = useState<GeneratedAssessment | null>(null);
  const [validation, setValidation] = useState<AssessmentValidation | null>(null);
  const [dirty, setDirty] = useState(false);

  const subjectMatch = useMemo(
    () =>
      state?.subjects.find(
        (item) => item.name.toLowerCase() === subject.trim().toLowerCase(),
      ) ?? null,
    [state?.subjects, subject],
  );
  const classMatch = useMemo(
    () =>
      state?.classes.find(
        (item) => item.name.toLowerCase() === classLevel.trim().toLowerCase(),
      ) ?? null,
    [state?.classes, classLevel],
  );

  const refreshAssessments = useCallback(async () => {
    if (!state) return;
    const supabase = getBrowserSupabaseClient();
    const { data, error: assessmentError } = await supabase
      .from("assessments")
      .select(
        "id,title,assessment_mode,status,source_lesson_id,class_id,subject_id,blueprint,source_context,updated_at",
      )
      .eq("workspace_id", state.workspace.id)
      .order("updated_at", { ascending: false });
    if (assessmentError) throw assessmentError;
    setState((current) =>
      current
        ? { ...current, assessments: (data ?? []) as AssessmentSummary[] }
        : current,
    );
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceState()
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setState(next);
        setSubject(next.subjects[0]?.name ?? "");
        setClassLevel(next.classes[0]?.name ?? "");
        setAgeRange(next.classes[0]?.age_range ?? "");
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Assessment Intelligence could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function authenticatedPost(body: unknown) {
    const supabase = getBrowserSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");

    const response = await fetch("/api/assessment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const base =
        typeof payload.error === "string" ? payload.error : "The assessment request failed.";
      const validationRow = isRecord(payload.validation) ? readValidation(payload.validation) : null;
      const detail = validationRow?.violations.map((item) => item.message).join(" ") ?? "";
      throw new Error(detail ? `${base} ${detail}` : base);
    }
    return payload;
  }

  function applySourceLesson(lessonId: string) {
    setSourceLessonId(lessonId);
    if (!state || !lessonId) return;
    const lesson = state.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    setTopic(lesson.topic);
    setObjective(lesson.objective);
    setTitle(`${lesson.title} — Assessment`);
    if (lesson.subject_id) {
      const match = state.subjects.find((item) => item.id === lesson.subject_id);
      if (match) setSubject(match.name);
    }
    if (lesson.class_id) {
      const match = state.classes.find((item) => item.id === lesson.class_id);
      if (match) {
        setClassLevel(match.name);
        setAgeRange(match.age_range ?? lesson.age_range ?? "");
      }
    }
  }

  function toggleResource(resourceId: string) {
    setSelectedResourceIds((current) => {
      if (current.includes(resourceId)) return current.filter((id) => id !== resourceId);
      if (current.length >= 3) {
        setNotice("Select at most three source resources per assessment generation.");
        return current;
      }
      return [...current, resourceId];
    });
  }

  function updateCount(key: keyof AssessmentItemCounts, value: string) {
    const next = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setCounts((current) => ({ ...current, [key]: next }));
  }

  async function generateAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await authenticatedPost({
        action: "generate",
        input: {
          workspaceId: state.workspace.id,
          subjectId: subjectMatch?.id ?? null,
          subject,
          classId: classMatch?.id ?? null,
          classLevel,
          ageRange,
          title,
          topic,
          objective,
          assessmentMode,
          totalItems: Number(totalItems),
          totalMarks: totalMarks ? Number(totalMarks) : null,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          sourceLessonId: sourceLessonId || null,
          resourceIds: selectedResourceIds,
          purpose,
          teacherInstructions,
          itemCounts: counts,
        },
      });
      const row = isRecord(payload.assessment) ? payload.assessment : null;
      if (!row || typeof row.id !== "string") {
        throw new Error("The assessment was generated but its saved id was not returned.");
      }
      await refreshAssessments();
      await openAssessment(row.id);
      const warnings = readStringList(payload.sourceWarnings);
      setNotice(
        warnings.length
          ? `Assessment generated, validated and saved. Source note: ${warnings.join(" ")}`
          : "Assessment generated, independently validated and saved.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The assessment could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function openAssessment(assessmentId: string) {
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const [assessmentResult, itemResult] = await Promise.all([
        supabase
          .from("assessments")
          .select(
            "id,title,assessment_mode,status,source_lesson_id,class_id,subject_id,blueprint,source_context,updated_at",
          )
          .eq("id", assessmentId)
          .single(),
        supabase
          .from("assessment_items")
          .select(
            "position,item_type,critical_thinking_type,topic,objective,difficulty,marks,content,answer_key,marking_guide",
          )
          .eq("assessment_id", assessmentId)
          .order("position"),
      ]);
      const firstError = assessmentResult.error ?? itemResult.error;
      if (firstError) throw firstError;
      if (!assessmentResult.data || !itemResult.data?.length) {
        throw new Error("This saved assessment is incomplete.");
      }
      const summary = assessmentResult.data as AssessmentSummary;
      const nextEditor = assessmentFromRows(summary, itemResult.data as AssessmentItemRow[]);
      const blueprint = isRecord(summary.blueprint) ? summary.blueprint : {};
      setSelectedAssessment(summary);
      setEditor(nextEditor);
      setValidation(readValidation(blueprint.validation));
      setDirty(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The saved assessment could not be opened.",
      );
    }
  }

  function updateAssessmentField(field: "title" | "studentInstructions", value: string) {
    setEditor((current) => (current ? { ...current, [field]: value } : current));
    setDirty(true);
  }

  function updateItem(
    position: number,
    field: keyof GeneratedAssessmentItem,
    value: string | string[] | number,
  ) {
    setEditor((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.position === position ? { ...item, [field]: value } : item,
            ),
          }
        : current,
    );
    setDirty(true);
  }

  async function saveEdits() {
    if (!selectedAssessment || !editor) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await authenticatedPost({
        action: "save_edits",
        assessmentId: selectedAssessment.id,
        assessment: editor,
      });
      const validationRow = isRecord(payload.validation)
        ? readValidation(payload.validation)
        : null;
      setValidation(validationRow);
      await refreshAssessments();
      await openAssessment(selectedAssessment.id);
      setNotice("Assessment edits were saved as a new version and revalidated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The assessment edits could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!selectedAssessment) return;
    setDownloading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch(
        `/api/assessment/pdf?assessmentId=${encodeURIComponent(selectedAssessment.id)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "The assessment PDF could not be prepared.",
        );
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "kaec-assessment.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The assessment PDF could not be downloaded.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <p className="text-sm font-medium text-zinc-500">Loading Assessment Intelligence…</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          {error ?? "Assessment Intelligence could not be loaded."}
        </div>
      </main>
    );
  }

  return (
    <main className="text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-emerald-900">
              ← Dashboard
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Assessment Intelligence
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Measure what the learner actually understands
            </h1>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-stone-50 px-4 py-3 text-sm">
            <p className="font-medium text-zinc-900">{state.workspace.name}</p>
            <p className="mt-1 text-xs text-zinc-500">
              HQLS Lesson → Assessment → Evidence → Diagnosis
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error ? <Message tone="error">{error}</Message> : null}
        {notice ? <Message tone="success">{notice}</Message> : null}

        <section className="grid gap-6 lg:grid-cols-[1.55fr_0.75fr]">
          <form
            onSubmit={generateAssessment}
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"
          >
            <p className="text-sm font-semibold text-emerald-800">Create Assessment</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              Start from a lesson or give KSI the assessment context directly.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              KSI checks item counts, marks, answer/marking guidance and real critical-thinking demand before saving a validated assessment.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <SelectInput
                label="Source HQLS lesson (optional)"
                value={sourceLessonId}
                onChange={applySourceLesson}
                options={[
                  { value: "", label: "Create from direct context" },
                  ...state.lessons.map((lesson) => ({ value: lesson.id, label: lesson.title })),
                ]}
              />
              <TextInput label="Assessment title" value={title} onChange={setTitle} required />
              <TextInput label="Subject" value={subject} onChange={setSubject} list="assessment-subjects" required />
              <datalist id="assessment-subjects">
                {state.subjects.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              <TextInput label="Class" value={classLevel} onChange={setClassLevel} list="assessment-classes" required />
              <datalist id="assessment-classes">
                {state.classes.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              <TextInput label="Age / age range" value={ageRange} onChange={setAgeRange} required />
              <SelectInput
                label="Assessment mode"
                value={assessmentMode}
                onChange={(value) => setAssessmentMode(value as AssessmentMode)}
                options={[
                  { value: "mixed", label: "Mixed assessment" },
                  ...ITEM_TYPES,
                ]}
              />
              <TextInput label="Topic" value={topic} onChange={setTopic} required />
              <TextInput label="Objective" value={objective} onChange={setObjective} required />
              <NumberInput label="Number of items" value={totalItems} onChange={setTotalItems} min={1} max={60} />
              <NumberInput label="Total marks" value={totalMarks} onChange={setTotalMarks} min={1} />
              <NumberInput label="Duration (minutes)" value={durationMinutes} onChange={setDurationMinutes} min={5} />
            </div>

            {assessmentMode === "mixed" ? (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold">Mixed item distribution</p>
                <p className="mt-1 text-xs text-zinc-500">
                  These four numbers must add up to the total number of items.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {ITEM_TYPES.map((item) => (
                    <NumberInput
                      key={item.value}
                      label={item.label}
                      value={String(counts[item.value])}
                      onChange={(value) => updateCount(item.value, value)}
                      min={0}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <details className="mt-5 rounded-2xl border border-zinc-200 bg-stone-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                Advanced context and authorised sources
              </summary>
              <div className="mt-4 grid gap-4">
                <TextArea
                  label="Assessment purpose / student instructions"
                  value={purpose}
                  onChange={setPurpose}
                  rows={3}
                />
                <TextArea
                  label="Teacher constraints"
                  value={teacherInstructions}
                  onChange={setTeacherInstructions}
                  rows={3}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-800">School resources (maximum 3)</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {state.resources.length ? (
                      state.resources.map((resource) => (
                        <label
                          key={resource.id}
                          className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedResourceIds.includes(resource.id)}
                            onChange={() => toggleResource(resource.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-medium">{resource.title}</span>
                            <span className="text-xs text-zinc-500">{resource.resource_type}</span>
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">No authorised resources are available in this workspace.</p>
                    )}
                  </div>
                </div>
              </div>
            </details>

            <button
              type="submit"
              disabled={generating}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {generating ? "Generating and validating…" : "Generate Assessment"}
            </button>
          </form>

          <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Saved assessments</h2>
            <p className="mt-1 text-sm text-zinc-500">Open any saved assessment to review, edit or export it.</p>
            <div className="mt-5 grid gap-3">
              {state.assessments.length ? (
                state.assessments.map((assessment) => (
                  <button
                    type="button"
                    key={assessment.id}
                    onClick={() => void openAssessment(assessment.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedAssessment?.id === assessment.id
                        ? "border-emerald-700 bg-emerald-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <p className="font-medium text-zinc-900">{assessment.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                      {assessment.assessment_mode.replaceAll("_", " ")} · {assessment.status}
                    </p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                  No assessments yet.
                </p>
              )}
            </div>
          </aside>
        </section>

        {selectedAssessment && editor ? (
          <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Saved assessment</p>
                <input
                  value={editor.title}
                  onChange={(event) => updateAssessmentField("title", event.target.value)}
                  className="mt-2 w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
                />
                {selectedAssessment.source_lesson_id ? (
                  <p className="mt-2 text-sm text-zinc-500">Linked to a saved HQLS lesson.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={!dirty || saving}
                  className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save edits"}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadPdf()}
                  disabled={downloading || selectedAssessment.status !== "validated"}
                  className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                >
                  {downloading ? "Preparing PDF…" : "Download PDF"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <TextArea
                label="Student instructions"
                value={editor.studentInstructions}
                onChange={(value) => updateAssessmentField("studentInstructions", value)}
                rows={4}
              />
              <div className="rounded-2xl border border-zinc-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold">KAEC validation</p>
                <p className={`mt-2 text-sm font-medium ${validation?.passed ? "text-emerald-700" : "text-amber-700"}`}>
                  {validation?.passed ? `Validated · ${validation.score}/100` : "Validation status unavailable or needs attention"}
                </p>
                {validation?.evidence.length ? (
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-600">
                    {validation.evidence.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="mt-7 grid gap-5">
              {editor.items.map((item) => (
                <article key={item.position} className="rounded-2xl border border-zinc-200 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-emerald-900">
                      {item.position}. {item.itemType.replaceAll("_", " ")}
                      {item.criticalThinkingType
                        ? ` · ${CRITICAL_LABELS[item.criticalThinkingType] ?? item.criticalThinkingType}`
                        : ""}
                    </p>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      {item.difficulty} · {item.marks} mark{item.marks === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TextInput
                      label="Topic"
                      value={item.topic}
                      onChange={(value) => updateItem(item.position, "topic", value)}
                    />
                    <TextInput
                      label="Objective"
                      value={item.objective}
                      onChange={(value) => updateItem(item.position, "objective", value)}
                    />
                    <TextInput
                      label="Competency / capability target"
                      value={item.competency}
                      onChange={(value) => updateItem(item.position, "competency", value)}
                    />
                    <NumberInput
                      label="Marks"
                      value={String(item.marks)}
                      onChange={(value) => updateItem(item.position, "marks", Number(value))}
                      min={1}
                    />
                  </div>

                  <div className="mt-4 grid gap-4">
                    <TextArea
                      label="Question / task"
                      value={item.prompt}
                      onChange={(value) => updateItem(item.position, "prompt", value)}
                      rows={4}
                    />
                    {item.itemType === "objective" ? (
                      <>
                        <TextArea
                          label="Options — one per line"
                          value={item.options.join("\n")}
                          onChange={(value) => updateItem(item.position, "options", splitLines(value))}
                          rows={4}
                        />
                        <TextInput
                          label="Correct answer — must exactly match one option"
                          value={item.correctAnswer}
                          onChange={(value) => updateItem(item.position, "correctAnswer", value)}
                        />
                        <TextArea
                          label="Teacher answer rationale"
                          value={item.answerRationale}
                          onChange={(value) => updateItem(item.position, "answerRationale", value)}
                          rows={2}
                        />
                      </>
                    ) : (
                      <TextArea
                        label="Marking guide — one criterion per line"
                        value={item.markingGuide.join("\n")}
                        onChange={(value) => updateItem(item.position, "markingGuide", splitLines(value))}
                        rows={4}
                      />
                    )}
                    <TextArea
                      label="Expected evidence — one point per line"
                      value={item.expectedEvidence.join("\n")}
                      onChange={(value) => updateItem(item.position, "expectedEvidence", splitLines(value))}
                      rows={3}
                    />
                    {item.itemType === "project" ? (
                      <TextInput
                        label="Observable deliverable"
                        value={item.deliverable}
                        onChange={(value) => updateItem(item.position, "deliverable", value)}
                      />
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Message({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required = false,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  list?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        list={list}
        className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
