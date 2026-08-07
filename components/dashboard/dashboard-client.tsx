"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Profile = {
  display_name: string | null;
  email: string | null;
  default_workspace_id: string | null;
};

type Workspace = {
  id: string;
  name: string;
  workspace_type: "individual" | "school";
  created_at: string;
};

type WorkspaceCounts = {
  lessons: number;
  assessments: number;
  diagnoses: number;
};

type DashboardState = {
  user: User;
  profile: Profile;
  workspaces: Workspace[];
  counts: WorkspaceCounts;
};

const EMPTY_COUNTS: WorkspaceCounts = {
  lessons: 0,
  assessments: 0,
  diagnoses: 0,
};

async function fetchCounts(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceCounts> {
  const [lessonResult, assessmentResult, diagnosisResult] = await Promise.all([
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
  ]);

  const firstError =
    lessonResult.error ?? assessmentResult.error ?? diagnosisResult.error;

  if (firstError) throw firstError;

  return {
    lessons: lessonResult.count ?? 0,
    assessments: assessmentResult.count ?? 0,
    diagnoses: diagnosisResult.count ?? 0,
  };
}

async function fetchDashboardState(
  supabase: SupabaseClient,
): Promise<DashboardState | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const [profileResult, workspaceResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,email,default_workspace_id")
      .eq("id", session.user.id)
      .single(),
    supabase
      .from("workspaces")
      .select("id,name,workspace_type,created_at")
      .order("created_at", { ascending: true }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (workspaceResult.error) throw workspaceResult.error;

  const profile = profileResult.data as Profile;
  const workspaces = (workspaceResult.data ?? []) as Workspace[];
  const activeWorkspaceId =
    profile.default_workspace_id ?? workspaces[0]?.id ?? null;
  const counts = activeWorkspaceId
    ? await fetchCounts(supabase, activeWorkspaceId)
    : EMPTY_COUNTS;

  return {
    user: session.user,
    profile,
    workspaces,
    counts,
  };
}

export function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [counts, setCounts] = useState<WorkspaceCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWorkspace = profile?.default_workspace_id
    ? (workspaces.find(
        (workspace) => workspace.id === profile.default_workspace_id,
      ) ??
      workspaces[0] ??
      null)
    : (workspaces[0] ?? null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();

    void fetchDashboardState(supabase)
      .then((state) => {
        if (cancelled) return;

        if (!state) {
          router.replace("/sign-in");
          return;
        }

        setUser(state.user);
        setProfile(state.profile);
        setWorkspaces(state.workspaces);
        setCounts(state.counts);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Your workspace could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/sign-in");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  async function switchWorkspace(workspaceId: string) {
    if (!user || workspaceId === activeWorkspace?.id) return;

    setSwitching(true);
    setError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ default_workspace_id: workspaceId })
        .eq("id", user.id);

      if (updateError) throw updateError;

      const nextCounts = await fetchCounts(supabase, workspaceId);
      setProfile((current) =>
        current ? { ...current, default_workspace_id: workspaceId } : current,
      );
      setCounts(nextCounts);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Workspace could not be switched.",
      );
    } finally {
      setSwitching(false);
    }
  }

  async function createSchoolWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !schoolName.trim()) return;

    setCreatingSchool(true);
    setError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name: schoolName.trim(),
          workspace_type: "school",
          created_by: user.id,
        })
        .select("id,name,workspace_type,created_at")
        .single();

      if (workspaceError) throw workspaceError;

      const created = workspace as Workspace;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ default_workspace_id: created.id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setWorkspaces((current) => [...current, created]);
      setProfile((current) =>
        current ? { ...current, default_workspace_id: created.id } : current,
      );
      setCounts(EMPTY_COUNTS);
      setSchoolName("");
      setShowSchoolForm(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "School workspace could not be created.",
      );
    } finally {
      setCreatingSchool(false);
    }
  }

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm font-medium text-zinc-500">Loading your workspace…</p>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          {error ?? "Your authenticated workspace could not be loaded."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
              KAEC School Intelligence
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              HQLS Lesson → Assessment → Diagnosis → Improvement
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {workspaces.length > 1 ? (
              <select
                aria-label="Active workspace"
                value={activeWorkspace?.id ?? ""}
                disabled={switching}
                onChange={(event) => void switchWorkspace(event.target.value)}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => setShowSchoolForm((current) => !current)}
              className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              Add school workspace
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {showSchoolForm ? (
          <form
            onSubmit={createSchoolWorkspace}
            className="mb-7 flex max-w-2xl flex-col gap-3 rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-4 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className="mb-1.5 block text-sm font-medium text-zinc-800">
                School name
              </span>
              <input
                required
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="e.g. Greenfield Academy"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 outline-none focus:border-emerald-700"
              />
            </label>
            <button
              type="submit"
              disabled={creatingSchool}
              className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingSchool ? "Creating…" : "Create school workspace"}
            </button>
          </form>
        ) : null}

        <section className="flex flex-col gap-5 border-b border-zinc-200 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-zinc-500">
              {activeWorkspace?.workspace_type === "school"
                ? "School workspace"
                : "Private workspace"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {activeWorkspace?.name ?? "Your workspace"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Welcome, {profile.display_name || profile.email || "Builder"}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5 text-right">
            <Metric label="Lessons" value={counts.lessons} />
            <Metric label="Assessments" value={counts.assessments} />
            <Metric label="Diagnoses" value={counts.diagnoses} />
          </div>
        </section>

        <section className="grid gap-5 py-8 md:grid-cols-3">
          <EngineCard
            eyebrow="01"
            title="HQLS Lesson Intelligence"
            description="Design seven-stage learning experiences that protect struggle, learner voice and reflection."
            status="Engine build follows Stage 1"
          />
          <EngineCard
            eyebrow="02"
            title="Assessment Intelligence"
            description="Create assessments aligned to taught content, reasoning and meaningful evidence of learning."
            status="Engine build follows Stage 1"
          />
          <EngineCard
            eyebrow="03"
            title="Student Diagnosis Intelligence"
            description="Turn assessment evidence and structured observations into reviewed, actionable growth plans."
            status="Engine build follows Stage 1"
          />
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-800">Stage 1 foundation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              The workspace is the security boundary.
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Lessons, assessments, student evidence, diagnoses and future school
              resources remain attached to the active workspace. This foundation is
              intentionally being proven before the final AI engines are connected.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function EngineCard({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-emerald-800">{eyebrow}</p>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
      <p className="mt-7 border-t border-zinc-100 pt-4 text-xs font-medium text-zinc-400">
        {status}
      </p>
    </article>
  );
}
