"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type DeliveryHealth = {
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  deliveries: number;
  assigned: number;
  submitted: number;
  reviewed: number;
  submission_percent: number;
  review_percent: number;
};

type DeliveryIntelligence = {
  summary: {
    deliveries: number;
    assigned: number;
    submitted: number;
    reviewed: number;
    submission_percent: number;
    review_percent: number;
  };
  class_delivery_health: DeliveryHealth[];
  subject_delivery_health: DeliveryHealth[];
};

async function loadDeliveryIntelligence(supabase: SupabaseClient): Promise<DeliveryIntelligence> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) throw new Error("Authentication required.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", session.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) throw new Error("Choose a school workspace first.");

  const { data, error } = await supabase.rpc("get_leadership_delivery_intelligence", {
    target_workspace_id: profile.default_workspace_id,
  });
  if (error) throw error;
  return data as DeliveryIntelligence;
}

export function DeliveryIntelligencePanel() {
  const [state, setState] = useState<DeliveryIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadDeliveryIntelligence(supabase)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Delivery intelligence unavailable.");
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <section className="mx-auto mb-10 max-w-7xl px-5 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div></section>;
  }
  if (!state) {
    return <section className="mx-auto mb-10 max-w-7xl px-5 sm:px-8"><p className="text-sm text-zinc-500">Loading lesson-delivery intelligence…</p></section>;
  }

  return (
    <section className="mx-auto mb-10 max-w-7xl px-5 sm:px-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Learning loop execution</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">Are taught lessons becoming reviewed student evidence?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Leadership sees completion signals, not private reflection text: lesson deliveries, assigned learner work, submissions and teacher reviews.</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Lessons taught" value={state.summary.deliveries} />
          <Metric label="Learner work" value={state.summary.assigned} />
          <Metric label="Submitted" value={state.summary.submitted} />
          <Metric label="Reviewed" value={state.summary.reviewed} />
          <Metric label="Submission" value={`${state.summary.submission_percent}%`} />
          <Metric label="Review" value={`${state.summary.review_percent}%`} />
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <HealthList title="By class" rows={state.class_delivery_health} labelKey="class_name" />
          <HealthList title="By subject" rows={state.subject_delivery_health} labelKey="subject_name" />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-zinc-950">{value}</p>
    </div>
  );
}

function HealthList({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows: DeliveryHealth[];
  labelKey: "class_name" | "subject_name";
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-5">
      <h3 className="font-bold text-zinc-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={`${labelKey}-${String(row[labelKey])}`} className="rounded-xl bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-zinc-900">{String(row[labelKey] ?? "Unassigned")}</p>
              <span className="text-xs font-bold text-zinc-500">{row.deliveries} taught</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-zinc-500">Submission</span><p className="mt-1 font-bold text-zinc-900">{row.submission_percent}%</p></div>
              <div><span className="text-zinc-500">Teacher review</span><p className="mt-1 font-bold text-zinc-900">{row.review_percent}%</p></div>
            </div>
          </div>
        )) : <p className="text-sm text-zinc-500">No taught-lesson activity yet.</p>}
      </div>
    </div>
  );
}
