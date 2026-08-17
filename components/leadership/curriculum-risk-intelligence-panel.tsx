"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type CoverageRow = {
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  canonical_objectives: number;
  published_resources: number;
  verified_aligned_objectives: number;
};

type RiskSignal = {
  key: string;
  severity: "high" | "medium" | "watch" | "clear";
  count: number;
  label: string;
  action: string;
};

type Payload = {
  curriculum: {
    adopted_frameworks: number;
    canonical_objectives: number;
    published_resources: number;
    verified_curriculum_links: number;
    resource_coverage_percent: number;
    alignment_coverage_percent: number;
    curriculum_ready: boolean;
  };
  learning_risk: { active_students: number; signals: RiskSignal[] };
  class_curriculum_coverage: CoverageRow[];
  subject_curriculum_coverage: CoverageRow[];
  principle: string;
};

async function loadPayload(supabase: SupabaseClient): Promise<Payload | null> {
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
  if (!profile.default_workspace_id) throw new Error("Choose a school workspace before opening Leadership KSI.");

  const { data, error } = await supabase.rpc("get_leadership_curriculum_risk_intelligence", {
    target_workspace_id: profile.default_workspace_id,
  });
  if (error) throw error;
  return data as Payload;
}

function severityClass(severity: RiskSignal["severity"]) {
  if (severity === "high") return "border-red-200 bg-red-50 text-red-950";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  if (severity === "watch") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

export function CurriculumRiskIntelligencePanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadPayload(supabase)
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Curriculum/risk intelligence could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRisks = useMemo(
    () => (payload?.learning_risk.signals ?? []).filter((signal) => signal.count > 0),
    [payload],
  );

  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
      </section>
    );
  }
  if (!payload) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Curriculum coverage</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950">Is the approved curriculum actually reaching learners?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Coverage is calculated only from an adopted canonical curriculum and separately published student resources. Pending scheme rows do not count as curriculum coverage.
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${payload.curriculum.curriculum_ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
            {payload.curriculum.curriculum_ready ? "Curriculum live" : "Awaiting promotion/adoption"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Adopted frameworks" value={payload.curriculum.adopted_frameworks} />
          <Metric label="Canonical objectives" value={payload.curriculum.canonical_objectives} />
          <Metric label="Published resources" value={payload.curriculum.published_resources} />
          <Metric label="Verified links" value={payload.curriculum.verified_curriculum_links} />
          <Metric label="Resource coverage" value={`${payload.curriculum.resource_coverage_percent}%`} />
          <Metric label="Alignment coverage" value={`${payload.curriculum.alignment_coverage_percent}%`} />
        </div>

        {!payload.curriculum.curriculum_ready ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            Curriculum coverage is intentionally not being claimed yet. Canonical objectives must first complete the Stage 12 review/promotion process and be adopted by the school.
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Learning-risk signals</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Where the learning system needs a response</h2>
          </div>
          <span className="text-sm font-semibold text-zinc-500">{activeRisks.length} active signal{activeRisks.length === 1 ? "" : "s"}</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {payload.learning_risk.signals.map((signal) => (
            <article key={signal.key} className={`rounded-2xl border p-5 ${severityClass(signal.severity)}`}>
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-bold leading-6">{signal.label}</h3>
                <span className="text-2xl font-bold">{signal.count}</span>
              </div>
              <p className="mt-3 text-sm leading-6 opacity-80">{signal.action}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-zinc-400">{payload.principle}</p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <CoverageTable title="Class curriculum coverage" rows={payload.class_curriculum_coverage} nameKey="class_name" />
        <CoverageTable title="Subject curriculum coverage" rows={payload.subject_curriculum_coverage} nameKey="subject_name" />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-zinc-950">{value}</p>
    </article>
  );
}

function CoverageTable({
  title,
  rows,
  nameKey,
}: {
  title: string;
  rows: CoverageRow[];
  nameKey: "class_name" | "subject_name";
}) {
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-zinc-950">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.08em] text-zinc-500">
              <th className="pb-3 pr-4">{nameKey === "class_name" ? "Class" : "Subject"}</th>
              <th className="pb-3 pr-4">Objectives</th>
              <th className="pb-3 pr-4">Resources</th>
              <th className="pb-3">Verified links</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[nameKey] ?? "row"}-${index}`} className="border-b border-zinc-100 last:border-0">
                <td className="py-3 pr-4 font-semibold text-zinc-900">{row[nameKey] ?? "Unassigned"}</td>
                <td className="py-3 pr-4 text-zinc-700">{row.canonical_objectives}</td>
                <td className="py-3 pr-4 text-zinc-700">{row.published_resources}</td>
                <td className="py-3 text-zinc-700">{row.verified_aligned_objectives}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}