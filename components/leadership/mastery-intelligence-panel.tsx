"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type MasterySummary = {
  students_with_graph: number;
  objectives_tracked: number;
  mastered: number;
  developing: number;
  intervention_required: number;
  evidence_building: number;
  medium_or_high_confidence: number;
};

type GroupMastery = {
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  students_with_graph: number;
  objectives_tracked: number;
  mastered: number;
  developing: number;
  intervention_required: number;
  evidence_building: number;
  medium_or_high_confidence: number;
};

type PriorityObjective = {
  objective_id: string;
  subject_name: string;
  class_name: string;
  topic: string | null;
  objective: string;
  learners_affected: number;
  average_mastery_percent: number | null;
  confidence_basis: string;
};

type MasteryPayload = {
  summary: MasterySummary;
  class_mastery: GroupMastery[];
  subject_mastery: GroupMastery[];
  priority_objectives: PriorityObjective[];
};

async function loadMastery(supabase: SupabaseClient): Promise<MasteryPayload | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", session.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) throw new Error("Choose a school workspace before opening mastery intelligence.");

  const { data, error } = await supabase.rpc("get_leadership_mastery_intelligence", {
    target_workspace_id: profile.default_workspace_id,
  });
  if (error) throw error;
  return data as MasteryPayload;
}

export function MasteryIntelligencePanel() {
  const [state, setState] = useState<MasteryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();
    void loadMastery(supabase)
      .then((next) => { if (!cancelled) setState(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Mastery intelligence could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8"><div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm font-semibold text-zinc-600">Building objective mastery intelligence…</div></section>;
  }

  if (error || !state) {
    return <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8"><div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error ?? "Mastery intelligence unavailable."}</div></section>;
  }

  const maturePercent = state.summary.objectives_tracked > 0
    ? Math.round((state.summary.medium_or_high_confidence / state.summary.objectives_tracked) * 100)
    : 0;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Mastery Intelligence</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950">Objective-level learning health</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              KSI separates evidence collection from mastery claims. Priority objectives appear only after medium or high-confidence evidence exists.
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.11em] text-zinc-500">Evidence maturity</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{maturePercent}%</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Students with graph" value={state.summary.students_with_graph} />
          <Metric label="Objectives tracked" value={state.summary.objectives_tracked} />
          <Metric label="Mastered" value={state.summary.mastered} />
          <Metric label="Developing" value={state.summary.developing} />
          <Metric label="Focused support" value={state.summary.intervention_required} />
          <Metric label="Evidence building" value={state.summary.evidence_building} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <GroupPanel title="By class" rows={state.class_mastery} nameKey="class_name" />
        <GroupPanel title="By subject" rows={state.subject_mastery} nameKey="subject_name" />
      </div>

      <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">High-confidence priority objectives</p>
        <h3 className="mt-2 text-xl font-bold text-zinc-950">Where leadership action is justified by repeated evidence</h3>
        {state.priority_objectives.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {state.priority_objectives.map((item) => (
              <article key={item.objective_id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-white px-2.5 py-1 text-zinc-700">{item.class_name}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-zinc-700">{item.subject_name}</span>
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 text-amber-950">{item.learners_affected} learner{item.learners_affected === 1 ? "" : "s"}</span>
                </div>
                <h4 className="mt-3 font-bold leading-6 text-zinc-950">{item.objective}</h4>
                {item.topic ? <p className="mt-1 text-sm text-zinc-500">{item.topic}</p> : null}
                <p className="mt-3 text-sm font-semibold text-zinc-700">Average mastery: {item.average_mastery_percent === null ? "Not scored" : `${Math.round(item.average_mastery_percent)}%`}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-zinc-50 p-5 text-sm leading-6 text-zinc-600">
            No objective currently has enough repeated evidence to justify a school-level mastery escalation. KSI will keep collecting evidence rather than overstate certainty.
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p><p className="mt-2 text-2xl font-black text-zinc-950">{value}</p></div>;
}

function GroupPanel({ title, rows, nameKey }: { title: string; rows: GroupMastery[]; nameKey: "class_name" | "subject_name" }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-zinc-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={`${String(row[nameKey])}-${index}`} className="rounded-2xl bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-bold text-zinc-900">{row[nameKey] ?? "Unassigned"}</p>
              <span className="text-xs font-semibold text-zinc-500">{row.students_with_graph} learner{row.students_with_graph === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Small label="Mastered" value={row.mastered} />
              <Small label="Developing" value={row.developing} />
              <Small label="Support" value={row.intervention_required} />
              <Small label="Building" value={row.evidence_building} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Small({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white px-3 py-2"><p className="text-zinc-500">{label}</p><p className="mt-1 font-black text-zinc-900">{value}</p></div>;
}
