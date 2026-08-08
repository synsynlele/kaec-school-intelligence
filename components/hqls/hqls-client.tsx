"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HQLS_STAGES } from "@/lib/domain/hqls";
import {
  parseHqlsStageContent,
  type HqlsStageAction,
  type HqlsStageContent,
} from "@/lib/hqls/engine";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Workspace = {
  id: string;
  name: string;
  workspace_type: "individual" | "school";
};

type Subject = {
  id: string;
  name: string;
};

type SchoolClass = {
  id: string;
  name: string;
  age_range: string | null;
};

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
  age_range: string | null;
  duration_minutes: number | null;
  class_id: string | null;
  subject_id: string | null;
  source_context: unknown;
  updated_at: string;
};

type ValidationView = {
  passed: boolean;
  score: number;
  violations: Array<{ code: string; message: string }>;
  evidence: string[];
};

type HqlsWorkspaceState = {
  workspace: Workspace;
  subjects: Subject[];
  classes: SchoolClass[];
  resources: Resource[];
  lessons: LessonSummary[];
};

const ACTION_OPTIONS: Array<{ value: HqlsStageAction; label: string }> = [
  { value: "improve", label: "Improve" },
  { value: "simplify", label: "Simplify" },
  { value: "increase_challenge", label: "Increase Challenge" },
  { value: "make_more_practical", label: "Make More Practical" },
  { value: "reduce_resource_dependence", label: "Reduce Resource Dependence" },
  { value: "regenerate", label: "Regenerate" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sourceLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      isRecord(item) && typeof item.title === "string" ? item.title : null,
    )
    .filter((item): item is string => Boolean(item));
}

function readViolationList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const code =
        typeof item.code === "string" ? item.code : "hqls_fidelity";
      const message =
        typeof item.message === "string"
          ? item.message
          : "HQLS fidelity needs attention.";
      return { code, message };
    })
    .filter(
      (item): item is { code: string; message: string } => Boolean(item),
    );
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

function requestedLessonId() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("lesson")?.trim();
  return value || null;
}

async function loadWorkspaceState(): Promise<HqlsWorkspaceState | null> {
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
    throw new Error("Choose an active workspace before creating an HQLS lesson.");
  }

  const workspaceId = profile.default_workspace_id;
  const [
    workspaceResult,
    subjectResult,
    classResult,
    resourceResult,
    lessonResult,
  ] = await Promise.all([
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
      .select(
        "id,title,topic,objective,status,age_range,duration_minutes,class_id,subject_id,source_context,updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
  ]);

  const firstError =
    workspaceResult.error ??
    subjectResult.error ??
    classResult.error ??
    resourceResult.error ??
    lessonResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data) {
    throw new Error("The active workspace could not be loaded.");
  }

  return {
    workspace: workspaceResult.data as Workspace,
    subjects: (subjectResult.data ?? []) as Subject[],
    classes: (classResult.data ?? []) as SchoolClass[],
    resources: (resourceResult.data ?? []) as Resource[],
    lessons: (lessonResult.data ?? []) as LessonSummary[],
  };
}

export function HqlsClient() {
  const router = useRouter();
  const [state, setState] = useState<HqlsWorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regeneratingStage, setRegeneratingStage] = useState<number | null>(
    null,
  );

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("90");
  const [objective, setObjective] = useState("");
  const [previousLearning, setPreviousLearning] = useState("");
  const [availableResources, setAvailableResources] = useState("");
  const [classContext, setClassContext] = useState("");
  const [teacherInstructions, setTeacherInstructions] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  const [selectedLesson, setSelectedLesson] = useState<LessonSummary | null>(
    null,
  );
  const [editorStages, setEditorStages] = useState<HqlsStageContent[]>([]);
  const [validation, setValidation] = useState<ValidationView | null>(null);
  const [dirty, setDirty] = useState(false);
  const [stageActions, setStageActions] = useState<
    Record<number, HqlsStageAction>
  >({});

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

  const refreshLessons = useCallback(async () => {
    if (!state) return;
    const supabase = getBrowserSupabaseClient();
    const { data, error: lessonError } = await supabase
      .from("lessons")
      .select(
        "id,title,topic,objective,status,age_range,duration_minutes,class_id,subject_id,source_context,updated_at",
      )
      .eq("workspace_id", state.workspace.id)
      .order("updated_at", { ascending: false });
    if (lessonError) throw lessonError;
    setState((current) =>
      current
        ? { ...current, lessons: (data ?? []) as LessonSummary[] }
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
        setSubject((current) => current || next.subjects[0]?.name || "");
        const firstClass = next.classes[0];
        setClassLevel((current) => current || firstClass?.name || "");
        setAgeRange((current) => current || firstClass?.age_range || "");

        const lessonId = requestedLessonId();
        if (!lessonId) return;
        if (!next.lessons.some((lesson) => lesson.id === lessonId)) {
          setError("The linked HQLS lesson is not available in the active workspace.");
          return;
        }
        void openLesson(lessonId).then((opened) => {
          if (!cancelled && opened) {
            setNotice("Opened the HQLS lesson linked from the previous workflow.");
          }
        });
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "HQLS Lesson Intelligence could not be loaded.",
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
    if (!session?.access_token) {
      throw new Error("Your session has expired. Sign in again.");
    }

    const response = await fetch("/api/hqls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const baseMessage =
        typeof payload.error === "string"
          ? payload.error
          : "The HQLS request failed.";
      const fidelity = isRecord(payload.validation)
        ? readViolationList(payload.validation.violations)
        : [];
      const detail = fidelity.map((item) => item.message).join(" ");
      throw new Error(detail ? `${baseMessage} ${detail}` : baseMessage);
    }
    return payload;
  }

  async function openLesson(lessonId: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const [lessonResult, stageResult, fidelityResult] = await Promise.all([
        supabase
          .from("lessons")
          .select(
            "id,title,topic,objective,status,age_range,duration_minutes,class_id,subject_id,source_context,updated_at",
          )
          .eq("id", lessonId)
          .single(),
        supabase
          .from("lesson_stages")
          .select("stage_number,stage_key,content,validation")
          .eq("lesson_id", lessonId)
          .order("stage_number"),
        supabase
          .from("hqls_fidelity_checks")
          .select("passed,score,violations,evidence,created_at")
          .eq("lesson_id", lessonId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const firstError =
        lessonResult.error ?? stageResult.error ?? fidelityResult.error;
      if (firstError) throw firstError;
      if (
        !lessonResult.data ||
        !stageResult.data ||
        stageResult.data.length !== 7
      ) {
        throw new Error("This HQLS lesson is incomplete and cannot be opened.");
      }

      const stages = stageResult.data.map((row, index) =>
        parseHqlsStageContent(row.content, index + 1),
      );
      setSelectedLesson(lessonResult.data as LessonSummary);
      setEditorStages(stages);
      setDirty(false);
      if (fidelityResult.data) {
        setValidation({
          passed: fidelityResult.data.passed,
          score: Number(fidelityResult.data.score ?? 0),
          violations: readViolationList(fidelityResult.data.violations),
          evidence: readStringList(fidelityResult.data.evidence),
        });
      } else {
        setValidation(null);
      }

      router.replace(`/hqls?lesson=${encodeURIComponent(lessonId)}`, {
        scroll: false,
      });
      window.setTimeout(() => {
        document
          .getElementById("hqls-selected-lesson")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The saved HQLS lesson could not be opened.",
      );
      return false;
    }
  }

  async function generateLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const duration = Number(durationMinutes);
      const payload = await authenticatedPost({
        action: "generate",
        input: {
          workspaceId: state.workspace.id,
          subjectId: subjectMatch?.id ?? null,
          subject,
          classId: classMatch?.id ?? null,
          classLevel,
          ageRange,
          durationMinutes: duration,
          topic,
          objective,
          previousLearning,
          availableResources,
          classContext,
          teacherInstructions,
          resourceIds: selectedResourceIds,
        },
      });
      const lesson =
        isRecord(payload.lesson) && typeof payload.lesson.id === "string"
          ? payload.lesson.id
          : null;
      const warnings = readStringList(payload.sourceWarnings);
      if (!lesson) {
        throw new Error(
          "The generated lesson was saved but its id was not returned.",
        );
      }
      await refreshLessons();
      await openLesson(lesson);
      setNotice(
        warnings.length > 0
          ? `HQLS lesson generated and validated. Source note: ${warnings.join(" ")}`
          : "HQLS lesson generated, independently validated and saved.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The HQLS lesson could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function toggleResource(resourceId: string) {
    setSelectedResourceIds((current) => {
      if (current.includes(resourceId)) {
        return current.filter((id) => id !== resourceId);
      }
      if (current.length >= 3) {
        setNotice("Select at most three source resources for one generation.");
        return current;
      }
      return [...current, resourceId];
    });
  }

  function updateStage(
    stageNumber: number,
    field: keyof HqlsStageContent,
    value: string | string[],
  ) {
    setEditorStages((current) =>
      current.map((stage) =>
        stage.stageNumber === stageNumber ? { ...stage, [field]: value } : stage,
      ),
    );
    setDirty(true);
  }

  async function saveEdits() {
    if (!selectedLesson || editorStages.length !== 7) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await authenticatedPost({
        action: "save_edits",
        lessonId: selectedLesson.id,
        stages: editorStages,
      });
      await refreshLessons();
      await openLesson(selectedLesson.id);
      setNotice(
        "Your edits were saved as a new lesson version and checked for HQLS fidelity.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your HQLS lesson edits could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function regenerateStage(stage: HqlsStageContent) {
    if (!selectedLesson) return;
    setRegeneratingStage(stage.stageNumber);
    setError(null);
    setNotice(null);
    try {
      const payload = await authenticatedPost({
        action: "regenerate_stage",
        lessonId: selectedLesson.id,
        stageNumber: stage.stageNumber,
        stageAction: stageActions[stage.stageNumber] ?? "improve",
      });
      await refreshLessons();
      await openLesson(selectedLesson.id);
      const warnings = readStringList(payload.sourceWarnings);
      setNotice(
        warnings.length > 0
          ? `Stage updated without overwriting the other stages. Source note: ${warnings.join(" ")}`
          : "Stage updated without overwriting the other stages.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "This HQLS stage could not be regenerated.",
      );
    } finally {
      setRegeneratingStage(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm font-medium text-zinc-500">
          Loading HQLS Lesson Intelligence…
        </p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          {error ?? "HQLS Lesson Intelligence could not be loaded."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-emerald-900"
            >
              ← Dashboard
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
              HQLS Lesson Intelligence
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Design the learning
            </h1>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-stone-50 px-4 py-3 text-sm">
            <p className="font-medium text-zinc-900">{state.workspace.name}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Learner = Hero · Teacher = Guide · Problem = Villain
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error ? <Message tone="error">{error}</Message> : null}
        {notice ? <Message tone="success">{notice}</Message> : null}

        <section className="grid gap-6 lg:grid-cols-[1.55fr_0.75fr]">
          <form
            onSubmit={generateLesson}
            className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-emerald-800">
                Create HQLS Lesson
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Give the essential context. KSI handles the HQLS structure.
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Full teaching will be held until after the first meaningful learner
                attempt. Every generated lesson is checked before it is saved as
                HQLS-valid.
              </p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Subject"
                value={subject}
                onChange={setSubject}
                list="hqls-subjects"
                placeholder="English Language"
                required
              />
              <datalist id="hqls-subjects">
                {state.subjects.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              <TextInput
                label="Topic"
                value={topic}
                onChange={setTopic}
                placeholder="Parts of speech"
                required
              />
              <TextInput
                label="Class level"
                value={classLevel}
                onChange={(value) => {
                  setClassLevel(value);
                  const matched = state.classes.find(
                    (item) =>
                      item.name.toLowerCase() === value.trim().toLowerCase(),
                  );
                  if (matched?.age_range) setAgeRange(matched.age_range);
                }}
                list="hqls-classes"
                placeholder="JSS 1"
                required
              />
              <datalist id="hqls-classes">
                {state.classes.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              <TextInput
                label="Age / age range"
                value={ageRange}
                onChange={setAgeRange}
                placeholder="10–12"
                required
              />
              <TextInput
                label="Duration (minutes)"
                value={durationMinutes}
                onChange={setDurationMinutes}
                placeholder="90"
                type="number"
                required
              />
            </div>
            <div className="mt-4">
              <TextArea
                label="Lesson objective"
                value={objective}
                onChange={setObjective}
                placeholder="By the end of the lesson, learners should be able to…"
                rows={3}
                required
              />
            </div>

            <details className="mt-6 rounded-2xl border border-zinc-200 bg-stone-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                Advanced context (optional)
              </summary>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <TextArea
                  label="Previous learning"
                  value={previousLearning}
                  onChange={setPreviousLearning}
                  placeholder="What learners already encountered…"
                  rows={3}
                />
                <TextArea
                  label="Available resources / constraints"
                  value={availableResources}
                  onChange={setAvailableResources}
                  placeholder="No electricity, chalkboard only, 30 learners…"
                  rows={3}
                />
                <TextArea
                  label="Class context"
                  value={classContext}
                  onChange={setClassContext}
                  placeholder="Common strengths, misconceptions or context…"
                  rows={3}
                />
                <TextArea
                  label="Teacher instructions"
                  value={teacherInstructions}
                  onChange={setTeacherInstructions}
                  placeholder="Anything KSI should respect for this lesson…"
                  rows={3}
                />
              </div>

              <div className="mt-5 border-t border-zinc-200 pt-5">
                <p className="text-sm font-semibold text-zinc-800">
                  Authorised source resources
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Select up to three resources from this workspace. Private resources
                  remain protected by existing workspace permissions.
                </p>
                {state.resources.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {state.resources.map((resource) => (
                      <label
                        key={resource.id}
                        className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedResourceIds.includes(resource.id)}
                          onChange={() => toggleResource(resource.id)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium text-zinc-900">
                            {resource.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {resource.resource_type} · {resource.visibility}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    No uploaded resources are available in this workspace yet.
                  </p>
                )}
              </div>
            </details>

            <button
              type="submit"
              disabled={generating}
              className="mt-6 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating
                ? "Designing + validating HQLS lesson…"
                : "Generate HQLS Lesson"}
            </button>
          </form>

          <aside className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800">Saved work</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  HQLS lessons
                </h2>
              </div>
              <span className="text-xs text-zinc-400">
                {state.lessons.length}
              </span>
            </div>
            <div className="mt-5 space-y-2">
              {state.lessons.length ? (
                state.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => void openLesson(lesson.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedLesson?.id === lesson.id ? "border-emerald-800 bg-emerald-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-stone-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-zinc-900">{lesson.title}</p>
                      <StatusBadge status={lesson.status} />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{lesson.topic}</p>
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Updated {new Date(lesson.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-zinc-500">
                  Your generated HQLS lessons will appear here and remain available
                  after refresh or re-login.
                </div>
              )}
            </div>
          </aside>
        </section>

        {selectedLesson && editorStages.length === 7 ? (
          <section id="hqls-selected-lesson" className="mt-8 scroll-mt-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedLesson.status} />
                  {validation ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${validation.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      HQLS fidelity {validation.score}/100
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  {selectedLesson.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {selectedLesson.objective}
                </p>
                {sourceLabels(selectedLesson.source_context).length ? (
                  <p className="mt-3 text-xs text-zinc-400">
                    Sources: {sourceLabels(selectedLesson.source_context).join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {selectedLesson.status === "validated" ? (
                  <Link
                    href={`/assessment?lesson=${encodeURIComponent(selectedLesson.id)}`}
                    className="rounded-xl bg-emerald-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-900"
                  >
                    Build Assessment
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={saving || !dirty}
                  className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving + checking…" : dirty ? "Save edits" : "Saved"}
                </button>
              </div>
            </div>

            {validation && !validation.passed ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                <p className="font-semibold">
                  This saved draft needs HQLS attention.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validation.violations.map((item, index) => (
                    <li key={`${item.code}-${index}`}>{item.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 space-y-5">
              {editorStages.map((stage) => {
                const definition = HQLS_STAGES[stage.stageNumber - 1];
                return (
                  <article
                    key={stage.stageKey}
                    className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
                  >
                    <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                          Stage {stage.stageNumber}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold tracking-tight">
                          {definition.title}
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                          {definition.purpose} {definition.nonNegotiable}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 sm:w-56">
                        <select
                          value={stageActions[stage.stageNumber] ?? "improve"}
                          onChange={(event) =>
                            setStageActions((current) => ({
                              ...current,
                              [stage.stageNumber]: event.target
                                .value as HqlsStageAction,
                            }))
                          }
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700"
                        >
                          {ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void regenerateStage(stage)}
                          disabled={regeneratingStage !== null}
                          className="rounded-xl border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50"
                        >
                          {regeneratingStage === stage.stageNumber
                            ? "Updating stage…"
                            : "Apply to this stage"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-2">
                      <TextArea
                        label="Learning experience / task"
                        value={stage.experience}
                        onChange={(value) =>
                          updateStage(stage.stageNumber, "experience", value)
                        }
                        rows={5}
                      />
                      <TextArea
                        label="Teacher prompts / actions (one per line)"
                        value={joinLines(stage.teacherPrompts)}
                        onChange={(value) =>
                          updateStage(
                            stage.stageNumber,
                            "teacherPrompts",
                            splitLines(value),
                          )
                        }
                        rows={5}
                      />
                      <TextArea
                        label="Expected learner actions (one per line)"
                        value={joinLines(stage.learnerActions)}
                        onChange={(value) =>
                          updateStage(
                            stage.stageNumber,
                            "learnerActions",
                            splitLines(value),
                          )
                        }
                        rows={5}
                      />
                      <TextArea
                        label="Guide Guardrails — what the teacher must NOT do"
                        value={joinLines(stage.guideGuardrails)}
                        onChange={(value) =>
                          updateStage(
                            stage.stageNumber,
                            "guideGuardrails",
                            splitLines(value),
                          )
                        }
                        rows={5}
                      />
                      <TextArea
                        label="Evidence to notice (one per line)"
                        value={joinLines(stage.evidenceToNotice)}
                        onChange={(value) =>
                          updateStage(
                            stage.stageNumber,
                            "evidenceToNotice",
                            splitLines(value),
                          )
                        }
                        rows={4}
                      />

                      {stage.stageNumber === 4 ? (
                        <TextArea
                          label="Productive struggle expected"
                          value={stage.productiveStruggle}
                          onChange={(value) =>
                            updateStage(
                              stage.stageNumber,
                              "productiveStruggle",
                              value,
                            )
                          }
                          rows={4}
                        />
                      ) : null}
                      {stage.stageNumber === 5 ? (
                        <>
                          <TextArea
                            label="Full Illumination — concise teaching after struggle"
                            value={stage.teachingContent}
                            onChange={(value) =>
                              updateStage(
                                stage.stageNumber,
                                "teachingContent",
                                value,
                              )
                            }
                            rows={7}
                          />
                          <TextArea
                            label="How this responds to Trial 1 gaps"
                            value={stage.respondsToFirstAttempt}
                            onChange={(value) =>
                              updateStage(
                                stage.stageNumber,
                                "respondsToFirstAttempt",
                                value,
                              )
                            }
                            rows={5}
                          />
                        </>
                      ) : null}
                      {stage.stageNumber === 7 ? (
                        <>
                          <TextArea
                            label="Reflection — how thinking changed"
                            value={stage.reflectionPrompt}
                            onChange={(value) =>
                              updateStage(
                                stage.stageNumber,
                                "reflectionPrompt",
                                value,
                              )
                            }
                            rows={4}
                          />
                          <TextArea
                            label="Real-life / future transfer"
                            value={stage.transferTask}
                            onChange={(value) =>
                              updateStage(
                                stage.stageNumber,
                                "transferTask",
                                value,
                              )
                            }
                            rows={5}
                          />
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Message({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-5 rounded-2xl px-4 py-3 text-sm ${tone === "error" ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: LessonSummary["status"] }) {
  const label =
    status === "validated"
      ? "Validated"
      : status === "archived"
        ? "Archived"
        : "Draft";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status === "validated" ? "bg-emerald-100 text-emerald-800" : status === "archived" ? "bg-zinc-100 text-zinc-600" : "bg-amber-100 text-amber-800"}`}
    >
      {label}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  list,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  list?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-800">
        {label}
      </span>
      <input
        type={type}
        list={list}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 outline-none focus:border-emerald-700"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder = "",
  rows = 4,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-800">
        {label}
      </span>
      <textarea
        required={required}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm leading-6 outline-none focus:border-emerald-700"
      />
    </label>
  );
}
