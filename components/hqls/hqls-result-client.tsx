"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { HQLS_STAGES } from "@/lib/domain/hqls";
import { parseHqlsStageContent, type HqlsStageContent } from "@/lib/hqls/engine";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Lesson = {
  id: string;
  workspace_id: string;
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

type ResultState = {
  workspaceName: string;
  lesson: Lesson;
  subjectName: string;
  className: string;
  stages: HqlsStageContent[];
  fidelity: { passed: boolean; score: number } | null;
};

function sourceLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const title = (item as Record<string, unknown>).title;
      return typeof title === "string" ? title : null;
    })
    .filter((item): item is string => Boolean(item));
}

export function HqlsResultClient({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile.default_workspace_id) {
        throw new Error("Choose an active workspace before opening this HQLS lesson.");
      }
      const workspaceId = profile.default_workspace_id;

      const [workspaceResult, lessonResult, stageResult, fidelityResult] = await Promise.all([
        supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
        supabase
          .from("lessons")
          .select("id,workspace_id,title,topic,objective,status,age_range,duration_minutes,class_id,subject_id,source_context,updated_at")
          .eq("workspace_id", workspaceId)
          .eq("id", lessonId)
          .single(),
        supabase
          .from("lesson_stages")
          .select("stage_number,content")
          .eq("lesson_id", lessonId)
          .order("stage_number"),
        supabase
          .from("hqls_fidelity_checks")
          .select("passed,score,created_at")
          .eq("workspace_id", workspaceId)
          .eq("lesson_id", lessonId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const firstError =
        workspaceResult.error ?? lessonResult.error ?? stageResult.error ?? fidelityResult.error;
      if (firstError) throw firstError;
      if (!workspaceResult.data || !lessonResult.data || stageResult.data?.length !== 7) {
        throw new Error("This HQLS lesson is unavailable or incomplete in the active workspace.");
      }

      let subjectName = "Subject not linked";
      let className = "Class not linked";
      if (lessonResult.data.subject_id) {
        const { data } = await supabase
          .from("subjects")
          .select("name")
          .eq("workspace_id", workspaceId)
          .eq("id", lessonResult.data.subject_id)
          .maybeSingle();
        if (data?.name) subjectName = data.name;
      }
      if (lessonResult.data.class_id) {
        const { data } = await supabase
          .from("classes")
          .select("name")
          .eq("workspace_id", workspaceId)
          .eq("id", lessonResult.data.class_id)
          .maybeSingle();
        if (data?.name) className = data.name;
      }

      if (!cancelled) {
        setState({
          workspaceName: workspaceResult.data.name,
          lesson: lessonResult.data as Lesson,
          subjectName,
          className,
          stages: stageResult.data.map((row, index) =>
            parseHqlsStageContent(row.content, index + 1),
          ),
          fidelity: fidelityResult.data
            ? {
                passed: fidelityResult.data.passed,
                score: Number(fidelityResult.data.score ?? 0),
              }
            : null,
        });
      }
    }

    void load()
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "The HQLS lesson could not be opened.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, router]);

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center px-5 text-sm text-zinc-500">Opening HQLS lesson…</div>;
  }
  if (!state) {
    return <div className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "HQLS lesson unavailable."}</div></div>;
  }

  const sources = sourceLabels(state.lesson.source_context);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-900">{state.lesson.status}</span>
              {state.fidelity ? (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.fidelity.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  HQLS fidelity {state.fidelity.score}/100
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">HQLS Lesson Result</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{state.lesson.title}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{state.lesson.objective}</p>
            <p className="mt-3 text-xs text-zinc-500">
              {state.subjectName} · {state.className} · {state.lesson.age_range || "Age not recorded"} · {state.lesson.duration_minutes ?? "—"} minutes
            </p>
            <p className="mt-1 text-xs text-zinc-400">{state.workspaceName} · Updated {new Date(state.lesson.updated_at).toLocaleDateString()}</p>
            {sources.length ? <p className="mt-3 text-xs text-zinc-500">Sources: {sources.join(", ")}</p> : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap md:justify-end">
            {state.lesson.status === "validated" ? (
              <Link href={`/assessment?lesson=${encodeURIComponent(state.lesson.id)}`} className="min-h-11 rounded-xl bg-emerald-950 px-4 py-2.5 text-center text-sm font-semibold text-white">Build Assessment</Link>
            ) : null}
            {state.lesson.status !== "archived" ? (
              <Link href={`/hqls?lesson=${encodeURIComponent(state.lesson.id)}&edit=1`} className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-800">Edit / Improve</Link>
            ) : null}
            <Link href="/hqls" className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-800">New Lesson</Link>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {state.stages.map((stage) => {
          const definition = HQLS_STAGES[stage.stageNumber - 1];
          return (
            <article key={stage.stageKey} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Stage {stage.stageNumber}</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-950 sm:text-2xl">{definition.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{definition.purpose}</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ResultBlock title="Learning experience" text={stage.experience} />
                <ResultList title="Teacher prompts / actions" items={stage.teacherPrompts} />
                <ResultList title="Expected learner actions" items={stage.learnerActions} />
                <ResultList title="Evidence to notice" items={stage.evidenceToNotice} />
                <ResultList title="Guide guardrails" items={stage.guideGuardrails} />
                {stage.productiveStruggle ? <ResultBlock title="Productive struggle" text={stage.productiveStruggle} /> : null}
                {stage.teachingContent ? <ResultBlock title="Full illumination" text={stage.teachingContent} /> : null}
                {stage.respondsToFirstAttempt ? <ResultBlock title="Response to Trial 1" text={stage.respondsToFirstAttempt} /> : null}
                {stage.reflectionPrompt ? <ResultBlock title="Reflection" text={stage.reflectionPrompt} /> : null}
                {stage.transferTask ? <ResultBlock title="Real-life / future transfer" text={stage.transferTask} /> : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/saved-work" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Manage Saved Work</Link>
        <Link href="/dashboard" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Dashboard</Link>
      </div>
    </main>
  );
}

function ResultBlock({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return <div className="rounded-2xl bg-stone-50 p-4"><h3 className="text-sm font-semibold text-zinc-900">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{text}</p></div>;
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-zinc-700">
        {items.map((item, index) => <li key={index}>• {item}</li>)}
      </ul>
    </div>
  );
}
