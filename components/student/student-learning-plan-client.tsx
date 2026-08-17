"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type PlanStep = {
  id: string;
  position: number;
  source_kind: "intervention" | "mastery" | "curriculum" | "baseline";
  subject_id: string | null;
  subject: string | null;
  objective_node_id: string | null;
  curriculum_node_id: string | null;
  lesson_id: string | null;
  lesson_title: string | null;
  title: string;
  action: string;
  why: string;
  success_signal: string | null;
  status: "todo" | "in_progress" | "completed" | "skipped";
  completed_at: string | null;
  mastery_state: string | null;
  mastery_percent: number | null;
  confidence: string | null;
  curriculum_source_reference: string | null;
};

type PlanPayload = {
  student_id: string;
  workspace_id: string;
  plan: {
    id: string;
    generated_at: string;
    updated_at: string;
    progress: {
      total: number;
      completed: number;
      in_progress: number;
      remaining: number;
      percent: number;
    };
  };
  steps: PlanStep[];
};

async function loadPlan(supabase: SupabaseClient): Promise<PlanPayload | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data, error } = await supabase.rpc("get_my_personalized_learning_plan");
  if (error) throw error;
  return data as PlanPayload;
}

function sourceLabel(source: PlanStep["source_kind"]) {
  switch (source) {
    case "intervention":
      return "Confirmed intervention";
    case "mastery":
      return "Mastery evidence";
    case "curriculum":
      return "Approved curriculum";
    default:
      return "Learning baseline";
  }
}

export function StudentLearningPlanClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    const next = await loadPlan(supabase);
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setPayload(next);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadPlan(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setPayload(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Your personalized learning plan could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function changeStatus(step: PlanStep, status: PlanStep["status"]) {
    setSavingId(step.id);
    setError(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("update_my_learning_plan_step", {
        target_step_id: step.id,
        target_status: status,
      });
      if (rpcError) throw rpcError;
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That learning-plan step could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="text-sm font-semibold text-zinc-600">Building your personalized learning plan…</p>
      </main>
    );
  }

  if (error && !payload) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
      </main>
    );
  }

  if (!payload) return null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <Link href="/student" className="text-sm font-semibold text-emerald-900">← Student KSI</Link>

      <section className="mt-5 rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">My Learning Plan</p>
        <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your next learning, in the right order</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">
              KSI builds this plan from your latest confirmed intervention, objective-level mastery evidence,
              approved curriculum and validated class resources. When the underlying evidence changes, KSI creates a new plan version rather than silently rewriting your history.
            </p>
          </div>
          <div className="min-w-48 rounded-2xl bg-white/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Progress</p>
            <p className="mt-1 text-3xl font-bold">{payload.plan.progress.percent}%</p>
            <p className="mt-1 text-xs font-semibold text-emerald-100">
              {payload.plan.progress.completed} of {payload.plan.progress.total} completed
            </p>
          </div>
        </div>
      </section>

      {error ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <section className="mt-7 space-y-5">
        {payload.steps.map((step) => (
          <article key={step.id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Step {step.position}</span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{sourceLabel(step.source_kind)}</span>
                  {step.subject ? <span className="text-xs font-semibold text-zinc-400">{step.subject}</span> : null}
                </div>
                <h2 className="mt-3 text-xl font-bold text-zinc-950">{step.title}</h2>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                step.status === "completed"
                  ? "bg-emerald-100 text-emerald-900"
                  : step.status === "in_progress"
                    ? "bg-amber-100 text-amber-900"
                    : step.status === "skipped"
                      ? "bg-zinc-200 text-zinc-600"
                      : "bg-zinc-100 text-zinc-700"
              }`}>
                {step.status.replace("_", " ")}
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">What to do</p>
                <p className="mt-2 text-sm leading-7 text-zinc-700">{step.action}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Why KSI selected it</p>
                <p className="mt-2 text-sm leading-7 text-zinc-700">{step.why}</p>
              </div>
            </div>

            {step.success_signal ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <strong>Success looks like:</strong> {step.success_signal}
              </div>
            ) : null}

            {step.mastery_state ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                <span>Mastery: {step.mastery_state.replace("_", " ")}</span>
                {step.mastery_percent !== null ? <span>· {step.mastery_percent}%</span> : null}
                {step.confidence ? <span>· {step.confidence} confidence</span> : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {step.lesson_id ? (
                <Link href="/student/learning" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-950">
                  Open learning resource
                </Link>
              ) : null}
              {step.status !== "in_progress" && step.status !== "completed" ? (
                <button
                  type="button"
                  disabled={savingId === step.id}
                  onClick={() => void changeStatus(step, "in_progress")}
                  className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Start this step
                </button>
              ) : null}
              {step.status !== "completed" ? (
                <button
                  type="button"
                  disabled={savingId === step.id}
                  onClick={() => void changeStatus(step, "completed")}
                  className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-800 disabled:opacity-50"
                >
                  Mark complete
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingId === step.id}
                  onClick={() => void changeStatus(step, "todo")}
                  className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-700 disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-7 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm leading-6 text-zinc-600">
        A completed step does not automatically change your mastery. KSI updates mastery only when new governed learning evidence arrives through assessments or reviewed learning work.
      </section>
    </main>
  );
}