"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type LessonRow = {
  id: string;
  title: string;
  topic: string;
  status: string;
  class_id: string | null;
  subject_id: string | null;
  updated_at: string;
};

type NamedRow = { id: string; name: string };
type StudentRow = { id: string; class_id: string | null; active: boolean };

type DeliveryContext = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  lessons: LessonRow[];
  classes: NamedRow[];
  subjects: NamedRow[];
  students: StudentRow[];
};

type DeliveryResult = {
  delivery_id: string;
  student_count: number;
  reflection_prompt: string | null;
  real_life_assignment: string | null;
};

async function loadDeliveryContext(
  supabase: SupabaseClient,
): Promise<DeliveryContext | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", session.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) {
    throw new Error("Choose a school workspace before delivering a lesson.");
  }

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult, lessonsResult, classesResult, subjectsResult, studentsResult] =
    await Promise.all([
      supabase.from("workspaces").select("name,workspace_type").eq("id", workspaceId).single(),
      supabase
        .from("workspace_members")
        .select("role,status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", session.user.id)
        .single(),
      supabase
        .from("lessons")
        .select("id,title,topic,status,class_id,subject_id,updated_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "validated")
        .order("updated_at", { ascending: false }),
      supabase.from("classes").select("id,name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
      supabase.from("subjects").select("id,name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
      supabase.from("students").select("id,class_id,active").eq("workspace_id", workspaceId).eq("active", true),
    ]);

  const firstError =
    workspaceResult.error ??
    membershipResult.error ??
    lessonsResult.error ??
    classesResult.error ??
    subjectsResult.error ??
    studentsResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data || !membershipResult.data) {
    throw new Error("School workspace access could not be resolved.");
  }
  if (workspaceResult.data.workspace_type !== "school") {
    throw new Error("Lesson Delivery is available only inside a school workspace.");
  }
  if (!["owner", "admin", "teacher"].includes(membershipResult.data.role)) {
    throw new Error("Only teachers and school administrators can deliver lessons.");
  }

  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role,
    lessons: (lessonsResult.data ?? []) as LessonRow[],
    classes: (classesResult.data ?? []) as NamedRow[],
    subjects: (subjectsResult.data ?? []) as NamedRow[],
    students: (studentsResult.data ?? []) as StudentRow[],
  };
}

export function LessonDeliveryClient() {
  const router = useRouter();
  const [context, setContext] = useState<DeliveryContext | null>(null);
  const [results, setResults] = useState<Record<string, DeliveryResult>>({});
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadDeliveryContext(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setContext(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Lesson Delivery could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const classNames = useMemo(
    () => new Map(context?.classes.map((item) => [item.id, item.name]) ?? []),
    [context?.classes],
  );
  const subjectNames = useMemo(
    () => new Map(context?.subjects.map((item) => [item.id, item.name]) ?? []),
    [context?.subjects],
  );
  const classSizes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of context?.students ?? []) {
      if (!student.class_id) continue;
      counts.set(student.class_id, (counts.get(student.class_id) ?? 0) + 1);
    }
    return counts;
  }, [context?.students]);

  async function deliverLesson(lesson: LessonRow) {
    setBusyLessonId(lesson.id);
    setError(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("deliver_lesson_to_class", {
        target_lesson_id: lesson.id,
      });
      if (rpcError) throw rpcError;
      const result = data as DeliveryResult;
      setResults((current) => ({ ...current, [lesson.id]: result }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The lesson could not be delivered to the class.");
    } finally {
      setBusyLessonId(null);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Lesson Delivery…</p></main>;
  }

  if (error && !context) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div></main>;
  }

  if (!context) return null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/hqls" className="text-sm font-semibold text-emerald-900">← HQLS Lessons</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Lesson Delivery</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">{context.workspaceName}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Mark the lesson that was actually taught. KSI links the school, class, subject and delivering teacher, snapshots the current class roster, then sends the HQLS reflection and real-life assignment to those learners.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600">Role: {context.role}</span>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <section className="mt-8 space-y-4">
        {context.lessons.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
            No validated HQLS lessons are available yet.
          </div>
        ) : (
          context.lessons.map((lesson) => {
            const result = results[lesson.id];
            const linked = Boolean(lesson.class_id && lesson.subject_id);
            const className = lesson.class_id ? classNames.get(lesson.class_id) ?? "Unknown class" : "No class";
            const subjectName = lesson.subject_id ? subjectNames.get(lesson.subject_id) ?? "Unknown subject" : "No subject";
            const rosterSize = lesson.class_id ? classSizes.get(lesson.class_id) ?? 0 : 0;

            return (
              <article key={lesson.id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{className}</span>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{subjectName}</span>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{rosterSize} active learner{rosterSize === 1 ? "" : "s"}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-zinc-950">{lesson.title}</h2>
                    <p className="mt-1 text-sm text-zinc-500">{lesson.topic}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!linked || busyLessonId !== null}
                    onClick={() => void deliverLesson(lesson)}
                    className="w-fit rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                  >
                    {busyLessonId === lesson.id ? "Linking class…" : result ? "Linked to class" : "Mark taught & send to class"}
                  </button>
                </div>

                {!linked ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This older lesson is missing a real class or subject link. It cannot be delivered until that academic context is repaired.
                  </div>
                ) : null}

                {result ? (
                  <div className="mt-5 grid gap-3 rounded-2xl bg-emerald-50 p-5 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Students linked</p>
                      <p className="mt-1 text-2xl font-black text-emerald-950">{result.student_count}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Reflection</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-700">{result.reflection_prompt || "No reflection prompt in this lesson."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Real-life assignment</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-700">{result.real_life_assignment || "No transfer task in this lesson."}</p>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
