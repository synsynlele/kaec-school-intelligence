"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SchoolSignal = {
  id: string;
  name: string;
  access_status: "active" | "paused" | "blocked" | "disabled";
  created_at: string;
  limited_metrics: boolean;
  lessons: number;
  assessments: number;
  records_updated_30d: number;
  last_learning_update_at: string | null;
  final_diagnoses: number | null;
  draft_diagnoses: number | null;
  confirmed_interventions: number | null;
  latest_final_without_intervention: number | null;
};

const DAYS_14 = 14 * 86400000;

function daysSince(value: string | null, now: number) {
  return value ? Math.max(0, Math.floor((now - new Date(value).getTime()) / 86400000)) : null;
}

export function PlatformSchoolOverview() {
  const [schools, setSchools] = useState<SchoolSignal[]>([]);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyAttention, setOnlyAttention] = useState(false);

  async function refresh() {
    setError(null);
    const { data, error: rpcError } = await getBrowserSupabaseClient().rpc("get_platform_school_overview");
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!Array.isArray(data)) {
      setError("The platform overview returned an unexpected response.");
      return;
    }
    setSchools(data as SchoolSignal[]);
    setLoadedAt(Date.now());
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();
    void supabase.rpc("get_platform_school_overview").then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) setError(rpcError.message);
      else if (Array.isArray(data)) {
        setSchools(data as SchoolSignal[]);
        setLoadedAt(Date.now());
      } else setError("The platform overview returned an unexpected response.");
    });
    return () => { cancelled = true; };
  }, []);

  const view = useMemo(() => {
    const now = loadedAt ?? 0;
    const attention = (school: SchoolSignal) => school.access_status === "active" && (
      school.last_learning_update_at === null ||
      (now - new Date(school.last_learning_update_at).getTime() >= DAYS_14) ||
      (school.latest_final_without_intervention ?? 0) > 0
    );
    return {
      active: schools.filter((school) => school.access_status === "active").length,
      attention: schools.filter(attention).length,
      updates: schools.reduce((sum, school) => sum + school.records_updated_30d, 0),
      rows: schools.filter((school) => !onlyAttention || attention(school))
        .sort((a, b) => Number(attention(b)) - Number(attention(a)) || a.name.localeCompare(b.name)),
    };
  }, [schools, loadedAt, onlyAttention]);

  return (
    <section className="mx-auto max-w-7xl px-5 pt-8 sm:px-8" aria-labelledby="platform-overview-heading">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Platform operations</p>
            <h2 id="platform-overview-heading" className="mt-2 text-2xl font-bold text-zinc-950">Learning workflow across schools</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              School-level counts from saved KSI records. Activity means a record was updated; it does not establish teaching quality or student progress.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700">Refresh overview</button>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Overview unavailable: {error}</div> : null}
        {loadedAt === null && !error ? <p className="mt-6 text-sm text-zinc-500">Loading governed school signals…</p> : null}
        {loadedAt !== null ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-2xl font-bold">{view.active}</p><p className="text-xs text-emerald-900">Active schools</p></div>
              <div className="rounded-2xl bg-amber-50 p-4"><p className="text-2xl font-bold">{view.attention}</p><p className="text-xs text-amber-900">Active schools to check</p></div>
              <div className="rounded-2xl bg-blue-50 p-4"><p className="text-2xl font-bold">{view.updates}</p><p className="text-xs text-blue-900">Visible records updated in 30 days</p></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <input type="checkbox" checked={onlyAttention} onChange={(event) => setOnlyAttention(event.target.checked)} />
                Show schools to check
              </label>
              <p className="text-xs text-zinc-500">As of {new Date(loadedAt).toLocaleString()} · learner-related counts withheld under 5 active learners</p>
            </div>
            {view.rows.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {view.rows.map((school) => {
                  const days = daysSince(school.last_learning_update_at, loadedAt);
                  return <article key={school.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-zinc-950">{school.name}</h3>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold capitalize text-zinc-600">{school.access_status}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">Last visible update: {days === null ? "No visible activity" : days === 0 ? "Today" : `${days} days ago`}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-zinc-500">HQLS lessons</dt><dd className="font-bold text-zinc-900">{school.lessons}</dd></div>
                      <div><dt className="text-xs text-zinc-500">Assessments</dt><dd className="font-bold text-zinc-900">{school.assessments}</dd></div>
                      <div><dt className="text-xs text-zinc-500">Draft diagnoses</dt><dd className="font-bold text-zinc-900">{school.draft_diagnoses ?? "—"}</dd></div>
                      <div><dt className="text-xs text-zinc-500">Latest final without confirmed action</dt><dd className="font-bold text-zinc-900">{school.latest_final_without_intervention ?? "—"}</dd></div>
                    </dl>
                    {school.limited_metrics ? <p className="mt-3 text-xs text-zinc-500">Learner-related counts withheld for privacy.</p> : null}
                  </article>;
                })}
              </div>
            ) : <p className="mt-6 text-sm text-zinc-500">No schools match this view.</p>}
            <p className="mt-4 text-xs leading-5 text-zinc-500">“To check” means no visible saved activity, no visible update for 14 days, or a latest final diagnosis without a linked confirmed intervention. It is a prompt to investigate, not a judgement of a school.</p>
            <Link href="#school-access-controls" className="mt-4 inline-block text-sm font-bold text-emerald-900">Manage school access ↓</Link>
          </>
        ) : null}
      </div>
    </section>
  );
}
