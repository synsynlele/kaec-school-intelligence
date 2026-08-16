"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type LeadershipState = {
  workspaceName: string;
  role: string;
  students: number;
  lessons: number;
  assessments: number;
  diagnoses: number;
  interventions: number;
  confirmedInterventions: number;
};

async function loadLeadershipState(
  supabase: SupabaseClient,
): Promise<LeadershipState | null> {
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
  const [workspaceResult, membershipResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name,workspace_type")
      .eq("id", workspaceId)
      .single(),
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", session.user.id)
      .single(),
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (workspaceResult.data.workspace_type !== "school") {
    throw new Error("Leadership KSI is available inside a school workspace.");
  }
  if (
    !membershipResult.data ||
    !["owner", "admin", "leader"].includes(membershipResult.data.role)
  ) {
    throw new Error(
      "You do not have Leadership KSI permission for this school.",
    );
  }

  const [
    studentsResult,
    lessonsResult,
    assessmentsResult,
    diagnosesResult,
    interventionsResult,
    confirmedResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("intervention_handoffs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("intervention_handoffs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "confirmed"),
  ]);

  const firstError =
    studentsResult.error ??
    lessonsResult.error ??
    assessmentsResult.error ??
    diagnosesResult.error ??
    interventionsResult.error ??
    confirmedResult.error;
  if (firstError) throw firstError;

  return {
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role,
    students: studentsResult.count ?? 0,
    lessons: lessonsResult.count ?? 0,
    assessments: assessmentsResult.count ?? 0,
    diagnoses: diagnosesResult.count ?? 0,
    interventions: interventionsResult.count ?? 0,
    confirmedInterventions: confirmedResult.count ?? 0,
  };
}

export function LeadershipHomeClient() {
  const router = useRouter();
  const [state, setState] = useState<LeadershipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadLeadershipState(supabase)
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

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <p className="text-sm font-semibold text-zinc-600">
          Loading school learning health…
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

  const interventionCoverage =
    state.diagnoses > 0
      ? Math.round((state.confirmedInterventions / state.diagnoses) * 100)
      : 0;

  const metrics = [
    ["Students", state.students],
    ["HQLS Lessons", state.lessons],
    ["Assessments", state.assessments],
    ["Diagnoses", state.diagnoses],
    ["Interventions", state.interventions],
    ["Confirmed intervention coverage", `${interventionCoverage}%`],
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
          Leadership KSI
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {state.workspaceName} Learning Health
        </h1>
        <p className="mt-2 text-sm text-emerald-50/90">
          Role: {state.role}. This surface reads the same KSI learning records
          used by teachers.
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-950">
            Learning intelligence coming next
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Class and subject learning health, curriculum coverage, students
            needing attention, intervention effectiveness and improvement trends
            will build on these live shared records.
          </p>
        </article>
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-950">
            Synchronization rule
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Teacher lessons, assessments, diagnoses and interventions feed this
            surface directly. Leadership does not maintain a separate reporting
            database.
          </p>
        </article>
      </section>
    </main>
  );
}
