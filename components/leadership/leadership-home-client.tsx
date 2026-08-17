"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type ClassHealth = {
  class_id: string;
  class_name: string;
  students: number;
  final_diagnoses: number;
  confirmed_interventions: number;
  students_needing_attention: number;
};

type SubjectHealth = {
  subject_id: string;
  subject_name: string;
  lessons: number;
  assessments: number;
  final_diagnoses: number;
  confirmed_interventions: number;
};

type AttentionStudent = {
  student_id: string;
  student_name: string;
  class_name: string | null;
  diagnosis_id: string;
  concise_diagnosis: string | null;
  growth_direction: string | null;
};

type LeadershipIntelligence = {
  role: string;
  school: {
    id: string;
    name: string;
  };
  summary: {
    students: number;
    final_diagnoses: number;
    confirmed_interventions: number;
    students_needing_attention: number;
    intervention_coverage_percent: number;
  };
  class_health: ClassHealth[];
  subject_health: SubjectHealth[];
  students_needing_attention: AttentionStudent[];
};

async function loadLeadershipIntelligence(
  supabase: SupabaseClient,
): Promise<LeadershipIntelligence | null> {
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
  if (!profile.default_workspace_id) {
    throw new Error(
      "Choose a school workspace before opening Leadership KSI.",
    );
  }

  const workspaceId = profile.default_workspace_id;
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role,status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", session.user.id)
    .single();
  if (membershipError) throw membershipError;
  if (!membership || !["owner", "admin", "leader"].includes(membership.role)) {
    throw new Error(
      "You do not have Leadership KSI permission for this school.",
    );
  }

  const { data, error } = await supabase.rpc(
    "get_leadership_learning_intelligence",
    { target_workspace_id: workspaceId },
  );
  if (error) throw error;

  return {
    ...(data as Omit<LeadershipIntelligence, "role">),
    role: membership.role,
  };
}

function coverageTone(value: number) {
  if (value >= 80) return "Strong";
  if (value >= 50) return "Building";
  return "Needs attention";
}

export function LeadershipHomeClient() {
  const router = useRouter();
  const [state, setState] = useState<LeadershipIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadLeadershipIntelligence(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setState(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Leadership KSI could not be loaded.",
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

  const classesWithAttention = useMemo(
    () =>
      (state?.class_health ?? []).filter(
        (item) => item.students_needing_attention > 0,
      ),
    [state],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <p className="text-sm font-semibold text-zinc-600">
          Building school learning health…
        </p>
      </main>
    );
  }

  if (error || !state) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">
          {error ?? "Leadership data unavailable."}
        </div>
      </main>
    );
  }

  const metrics = [
    ["Active students", state.summary.students],
    ["Final learning diagnoses", state.summary.final_diagnoses],
    ["Confirmed interventions", state.summary.confirmed_interventions],
    ["Students needing attention", state.summary.students_needing_attention],
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
          Leadership KSI
        </p>
        <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {state.school.name} Learning Health
            </h1>
            <p className="mt-2 text-sm text-emerald-50/90">
              Role: {state.role}. Live intelligence from the same learning records used by Teacher and Student KSI.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
              Intervention coverage
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-3xl font-bold">
                {state.summary.intervention_coverage_percent}%
              </span>
              <span className="text-sm font-semibold text-emerald-100">
                {coverageTone(state.summary.intervention_coverage_percent)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article
            key={label}
            className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                Class learning health
              </p>
              <h2 className="mt-2 text-xl font-bold text-zinc-950">
                Where leadership attention is needed
              </h2>
            </div>
            <span className="text-sm font-semibold text-zinc-500">
              {classesWithAttention.length} class{classesWithAttention.length === 1 ? "" : "es"} flagged
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-[0.1em] text-zinc-500">
                  <th className="pb-3 pr-4">Class</th>
                  <th className="pb-3 pr-4">Students</th>
                  <th className="pb-3 pr-4">Diagnoses</th>
                  <th className="pb-3 pr-4">Confirmed plans</th>
                  <th className="pb-3">Need attention</th>
                </tr>
              </thead>
              <tbody>
                {state.class_health.map((item) => (
                  <tr key={item.class_id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-4 pr-4 font-semibold text-zinc-900">
                      {item.class_name}
                    </td>
                    <td className="py-4 pr-4 text-zinc-700">{item.students}</td>
                    <td className="py-4 pr-4 text-zinc-700">
                      {item.final_diagnoses}
                    </td>
                    <td className="py-4 pr-4 text-zinc-700">
                      {item.confirmed_interventions}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          item.students_needing_attention > 0
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {item.students_needing_attention}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
            Intervention command centre
          </p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">
            Students needing a confirmed response
          </h2>
          <div className="mt-5 space-y-3">
            {state.students_needing_attention.length ? (
              state.students_needing_attention.slice(0, 8).map((student) => (
                <div
                  key={student.student_id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-zinc-950">
                        {student.student_name}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                        {student.class_name ?? "Class not assigned"}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-950">
                      Action needed
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-700">
                    {student.growth_direction ??
                      student.concise_diagnosis ??
                      "A finalised diagnosis needs an intervention response."}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-medium leading-6 text-emerald-900">
                Every latest finalised diagnosis currently has a confirmed intervention response.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
            Subject intelligence
          </p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">
            Teaching, assessment and response signals by subject
          </h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.subject_health.map((subject) => (
            <article
              key={subject.subject_id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
            >
              <h3 className="font-bold text-zinc-950">{subject.subject_name}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-zinc-500">HQLS lessons</dt>
                  <dd className="font-bold text-zinc-900">{subject.lessons}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Assessments</dt>
                  <dd className="font-bold text-zinc-900">{subject.assessments}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Diagnoses</dt>
                  <dd className="font-bold text-zinc-900">
                    {subject.final_diagnoses}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Confirmed plans</dt>
                  <dd className="font-bold text-zinc-900">
                    {subject.confirmed_interventions}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
