"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Handoff = {
  id: string;
  workspace_id: string;
  diagnosis_id: string;
  student_id: string;
  status: string;
  priority_growth_target: string;
  evidence_basis: string;
  timeframe: string;
  success_indicator: string;
  review_date: string | null;
  next_learning_adjustment: string;
  next_lesson_id: string | null;
  confirmed_at: string | null;
};

type Student = { id: string; display_name: string; class_id: string | null };
type SchoolClass = { id: string; name: string; age_range: string | null };
type Subject = { id: string; name: string };

type StarterState = {
  workspaceId: string;
  handoffs: Handoff[];
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
};

function anonymise(value: string, studentName: string) {
  if (!studentName.trim()) return value;
  const escaped = studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(escaped, "gi"), "the target learner");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function loadStarterState(): Promise<StarterState | null> {
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
  const workspaceId = profile?.default_workspace_id as string | null | undefined;
  if (!workspaceId) {
    throw new Error("Choose an active workspace before building the next HQLS lesson.");
  }

  const [handoffResult, studentResult, classResult, subjectResult] = await Promise.all([
    supabase
      .from("intervention_handoffs")
      .select(
        "id,workspace_id,diagnosis_id,student_id,status,priority_growth_target,evidence_basis,timeframe,success_indicator,review_date,next_learning_adjustment,next_lesson_id,confirmed_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false }),
    supabase
      .from("students")
      .select("id,display_name,class_id")
      .eq("workspace_id", workspaceId)
      .eq("active", true),
    supabase
      .from("classes")
      .select("id,name,age_range")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("subjects")
      .select("id,name")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .order("name"),
  ]);

  const firstError =
    handoffResult.error ?? studentResult.error ?? classResult.error ?? subjectResult.error;
  if (firstError) throw firstError;

  return {
    workspaceId,
    handoffs: (handoffResult.data ?? []) as Handoff[],
    students: (studentResult.data ?? []) as Student[],
    classes: (classResult.data ?? []) as SchoolClass[],
    subjects: (subjectResult.data ?? []) as Subject[],
  };
}

export function NextLessonClient() {
  const [state, setState] = useState<StarterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generatedLessonId, setGeneratedLessonId] = useState<string | null>(null);

  const [handoffId, setHandoffId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("90");

  useEffect(() => {
    let cancelled = false;
    void loadStarterState()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        if (next) {
          const available = next.handoffs.find((item) => !item.next_lesson_id) ?? next.handoffs[0];
          setHandoffId(available?.id ?? "");
          setObjective(available?.priority_growth_target ?? "");
          setSubjectId(next.subjects[0]?.id ?? "");
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The next-lesson handoff could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handoff = useMemo(
    () => state?.handoffs.find((item) => item.id === handoffId) ?? null,
    [handoffId, state?.handoffs],
  );
  const student = useMemo(
    () => state?.students.find((item) => item.id === handoff?.student_id) ?? null,
    [handoff?.student_id, state?.students],
  );
  const schoolClass = useMemo(
    () => state?.classes.find((item) => item.id === student?.class_id) ?? null,
    [state?.classes, student?.class_id],
  );
  const subject = useMemo(
    () => state?.subjects.find((item) => item.id === subjectId) ?? null,
    [state?.subjects, subjectId],
  );

  function selectHandoff(nextId: string) {
    setHandoffId(nextId);
    const next = state?.handoffs.find((item) => item.id === nextId);
    if (next) setObjective(next.priority_growth_target);
    setGeneratedLessonId(null);
    setNotice(null);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state || !handoff || !student || !schoolClass || !subject) return;
    if (handoff.next_lesson_id) {
      setError("This intervention already has a linked next HQLS lesson. Open HQLS Lessons instead of generating another one.");
      return;
    }
    if (!topic.trim()) {
      setError("Enter the subject topic for the next lesson.");
      return;
    }
    if (!objective.trim()) {
      setError("Enter the learning objective for the next lesson.");
      return;
    }

    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration < 10 || duration > 240) {
      setError("Lesson duration must be between 10 and 240 minutes.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setGeneratedLessonId(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");

      const priority = anonymise(handoff.priority_growth_target, student.display_name);
      const adjustment = anonymise(handoff.next_learning_adjustment, student.display_name);
      const success = anonymise(handoff.success_indicator, student.display_name);
      const evidence = anonymise(handoff.evidence_basis, student.display_name);

      const response = await fetch("/api/hqls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "generate",
          input: {
            workspaceId: state.workspaceId,
            subjectId: subject.id,
            subject: subject.name,
            classId: schoolClass.id,
            classLevel: schoolClass.name,
            ageRange: schoolClass.age_range || "Class age range not recorded",
            durationMinutes: Math.round(duration),
            topic: topic.trim(),
            objective: objective.trim(),
            previousLearning: `Confirmed intervention baseline for one learner in this class: ${evidence}`,
            availableResources: "Use ordinary available classroom resources unless the teacher later adds specific source materials.",
            classContext: `A learner in this class has a confirmed improvement target. Do not name, label or single out any learner in the lesson. Priority growth target: ${priority} Success indicator: ${success} Review timeframe: ${handoff.timeframe}.`,
            teacherInstructions: `Apply this confirmed intervention as inclusive class-level differentiation without reducing HQLS challenge: ${adjustment} The lesson must let the target skill or behaviour be practised and observed while remaining appropriate for the whole class.`,
            resourceIds: [],
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        const baseMessage =
          typeof payload.error === "string" ? payload.error : "The next HQLS lesson could not be generated.";
        throw new Error(baseMessage);
      }
      const lessonId =
        isRecord(payload.lesson) && typeof payload.lesson.id === "string"
          ? payload.lesson.id
          : null;
      if (!lessonId) {
        throw new Error("The HQLS lesson was generated but no lesson id was returned.");
      }

      const { error: linkError } = await supabase
        .from("intervention_handoffs")
        .update({ next_lesson_id: lessonId })
        .eq("id", handoff.id)
        .eq("status", "confirmed")
        .is("next_lesson_id", null);

      setGeneratedLessonId(lessonId);
      if (linkError) {
        setError(
          "The HQLS lesson was generated successfully, but KSI could not attach it to the intervention handoff. Do not generate another lesson; open HQLS Lessons and preserve this lesson while the link is repaired.",
        );
        return;
      }

      setState((current) =>
        current
          ? {
              ...current,
              handoffs: current.handoffs.map((item) =>
                item.id === handoff.id ? { ...item, next_lesson_id: lessonId } : item,
              ),
            }
          : current,
      );
      setNotice(
        "Closed loop complete: the confirmed intervention was applied to the existing HQLS engine and the new lesson is now linked back to this intervention.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The next HQLS lesson could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-5xl items-center justify-center px-5">
        <p className="text-sm font-medium text-zinc-500">Loading confirmed interventions...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
      <div className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
          Closed-loop lesson handoff
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">
          Build the Next HQLS Lesson
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          KSI keeps the existing HQLS engine in control. The confirmed intervention is supplied as private class context so the next lesson deliberately creates another opportunity to practise and observe the agreed growth target.
        </p>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>
        ) : null}

        {state?.handoffs.length ? (
          <form onSubmit={(event) => void generate(event)} className="mt-6 grid gap-5">
            <Field label="Confirmed Intervention">
              <select
                value={handoffId}
                onChange={(event) => selectHandoff(event.target.value)}
                className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
              >
                {state.handoffs.map((item) => {
                  const learner = state.students.find((studentItem) => studentItem.id === item.student_id);
                  return (
                    <option key={item.id} value={item.id}>
                      {learner?.display_name || "Student"} · {item.next_lesson_id ? "Lesson linked" : "Ready"}
                    </option>
                  );
                })}
              </select>
            </Field>

            {handoff ? (
              <div className="rounded-2xl border border-[#ddd4b7] bg-[#f8f4e8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-950">Confirmed growth target</p>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{handoff.priority_growth_target}</p>
                <p className="mt-3 text-xs text-zinc-500">
                  {student?.display_name || "Student"} · {schoolClass?.name || "Class not linked"} · Review {handoff.review_date || "not set"}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Subject">
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                >
                  {state.subjects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duration (minutes)">
                <input
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  inputMode="numeric"
                  className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                />
              </Field>
            </div>

            <Field label="Next Lesson Topic">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="What topic will the class learn next?"
                className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
              />
            </Field>

            <Field label="Lesson Objective">
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                className="min-h-24 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm leading-6 text-zinc-900"
              />
            </Field>

            {handoff?.next_lesson_id ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This intervention already has a next lesson linked. KSI will not create a duplicate closed-loop lesson from the same confirmed handoff.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5">
              <button
                type="submit"
                disabled={busy || !handoff || Boolean(handoff.next_lesson_id)}
                className="rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Building with HQLS..." : "Generate Next HQLS Lesson"}
              </button>
              <Link
                href="/hqls"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800"
              >
                Open HQLS Lessons
              </Link>
              {generatedLessonId ? (
                <span className="text-xs font-medium text-emerald-800">Lesson created and saved.</span>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center">
            <p className="text-sm font-semibold text-zinc-800">No confirmed intervention is ready yet.</p>
            <p className="mt-2 text-sm text-zinc-500">Confirm an intervention before building its next HQLS lesson.</p>
            <Link href="/interventions" className="mt-4 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white">
              Open Interventions
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      {children}
    </label>
  );
}
