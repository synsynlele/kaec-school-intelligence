"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type MasteryState = "mastered" | "developing" | "intervention_required" | "evidence_building";
type Confidence = "low" | "medium" | "high";

type ObjectiveMastery = {
  objective_id: string;
  subject_id: string;
  subject: string;
  topic: string | null;
  objective: string;
  state: MasteryState;
  mastery_percent: number | null;
  item_evidence_count: number;
  qualitative_evidence_count: number;
  confidence: Confidence;
  last_evidence_at: string | null;
};

type MasteryGraph = {
  student_id: string;
  class_id: string | null;
  summary: {
    total_objectives: number;
    mastered: number;
    developing: number;
    intervention_required: number;
    evidence_building: number;
  };
  next_best_action: {
    source: "intervention" | "mastery" | "baseline";
    title: string;
    action: string;
    why: string;
    objective_id: string | null;
    lesson_id: string | null;
    lesson_title?: string | null;
  };
  objectives: ObjectiveMastery[];
};

async function loadMastery(supabase: SupabaseClient): Promise<MasteryGraph | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data, error } = await supabase.rpc("get_my_mastery_graph");
  if (error) throw error;
  return data as MasteryGraph;
}

function stateLabel(state: MasteryState) {
  if (state === "mastered") return "Mastered";
  if (state === "developing") return "Developing";
  if (state === "intervention_required") return "Needs focused support";
  return "Evidence building";
}

function stateClasses(state: MasteryState) {
  if (state === "mastered") return "bg-emerald-100 text-emerald-900";
  if (state === "developing") return "bg-sky-100 text-sky-900";
  if (state === "intervention_required") return "bg-amber-100 text-amber-950";
  return "bg-zinc-100 text-zinc-700";
}

export function StudentMasteryClient() {
  const router = useRouter();
  const [graph, setGraph] = useState<MasteryGraph | null>(null);
  const [subject, setSubject] = useState("All subjects");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();

    void loadMastery(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setGraph(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Your mastery graph could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [router]);

  const subjects = useMemo(() => {
    const values = new Set((graph?.objectives ?? []).map((item) => item.subject));
    return ["All subjects", ...Array.from(values).sort()];
  }, [graph]);

  const objectives = useMemo(
    () => (graph?.objectives ?? []).filter((item) => subject === "All subjects" || item.subject === subject),
    [graph, subject],
  );

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Building your mastery graph…</p></main>;
  }

  if (error || !graph) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Mastery graph unavailable."}</div></main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/student" className="text-sm font-semibold text-emerald-900">← Student KSI</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">My Mastery</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">Your living learning graph</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            KSI follows learning objective by objective. Test evidence can change mastery percentage; reviewed reflections and real-life work strengthen the evidence picture without pretending to be test scores.
          </p>
        </div>
        <Link href="/student/learning" className="w-fit rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Open My Learning</Link>
      </div>

      <section className="mt-7 rounded-3xl bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">Next Best Learning Action</p>
        <h2 className="mt-2 text-2xl font-bold">{graph.next_best_action.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">{graph.next_best_action.action}</p>
        <p className="mt-3 max-w-3xl text-xs font-semibold leading-6 text-emerald-200">Why KSI chose this: {graph.next_best_action.why}</p>
        {graph.next_best_action.lesson_id ? (
          <Link href="/student/learning" className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-950">
            Study {graph.next_best_action.lesson_title ?? "the relevant lesson"}
          </Link>
        ) : null}
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Objectives tracked" value={graph.summary.total_objectives} />
        <Metric label="Mastered" value={graph.summary.mastered} />
        <Metric label="Developing" value={graph.summary.developing} />
        <Metric label="Focused support" value={graph.summary.intervention_required} />
        <Metric label="Evidence building" value={graph.summary.evidence_building} />
      </section>

      <section className="mt-7 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block max-w-xs">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Subject</span>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700">
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <section className="mt-6 space-y-4">
        {objectives.length ? objectives.map((item) => (
          <article key={item.objective_id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{item.subject}</span>
                  {item.topic ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{item.topic}</span> : null}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stateClasses(item.state)}`}>{stateLabel(item.state)}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold leading-7 text-zinc-950">{item.objective}</h2>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.11em] text-zinc-400">Evidence confidence</p>
                <p className="mt-1 text-sm font-bold capitalize text-zinc-700">{item.confidence}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <EvidenceMetric label="Assessment evidence" value={item.item_evidence_count} />
              <EvidenceMetric label="Reviewed real-life evidence" value={item.qualitative_evidence_count} />
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.11em] text-zinc-500">Mastery percentage</p>
                <p className="mt-1 text-lg font-black text-zinc-950">{item.mastery_percent === null ? "Not enough scored evidence" : `${Math.round(item.mastery_percent)}%`}</p>
              </div>
            </div>
          </article>
        )) : (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm leading-6 text-zinc-600">
            No objective-level evidence is available yet. Complete learning activities and assessments so KSI can begin building your mastery graph.
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.11em] text-zinc-500">{label}</p><p className="mt-2 text-3xl font-black text-zinc-950">{value}</p></article>;
}

function EvidenceMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.11em] text-zinc-500">{label}</p><p className="mt-1 text-lg font-black text-zinc-950">{value}</p></div>;
}
