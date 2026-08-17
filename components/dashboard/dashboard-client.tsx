"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { KaecBrand } from "@/components/branding/kaec-brand";
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
  access_status: "active" | "paused" | "blocked" | "disabled";
  created_at: string;
};

type Role = "owner" | "admin" | "leader" | "teacher" | "student";
type Membership = { workspace_id: string; role: Role; status: string };
type Counts = { lessons: number; assessments: number; diagnoses: number };
type DashboardState = {
  user: User;
  profile: Profile;
  workspaces: Workspace[];
  memberships: Membership[];
  counts: Counts;
  isPlatformAdmin: boolean;
};

type Action = {
  href: string;
  title: string;
  description: string;
  step?: string;
  primary?: boolean;
};

const EMPTY_COUNTS: Counts = { lessons: 0, assessments: 0, diagnoses: 0 };

function messageFrom(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function fetchCounts(supabase: SupabaseClient, workspace: Workspace | null): Promise<Counts> {
  if (!workspace) return EMPTY_COUNTS;
  if (workspace.workspace_type === "school" && workspace.access_status !== "active") return EMPTY_COUNTS;

  const [lessons, assessments, diagnoses] = await Promise.all([
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);
  const firstError = lessons.error ?? assessments.error ?? diagnoses.error;
  if (firstError) throw firstError;
  return {
    lessons: lessons.count ?? 0,
    assessments: assessments.count ?? 0,
    diagnoses: diagnoses.count ?? 0,
  };
}

async function fetchDashboardState(supabase: SupabaseClient): Promise<DashboardState | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const [profileResult, workspaceResult, membershipResult, platformAdminResult] = await Promise.all([
    supabase.from("profiles").select("display_name,email,default_workspace_id").eq("id", session.user.id).single(),
    supabase.from("workspaces").select("id,name,workspace_type,access_status,created_at").order("created_at", { ascending: true }),
    supabase.from("workspace_members").select("workspace_id,role,status").eq("user_id", session.user.id).eq("status", "active"),
    supabase.from("platform_access_admins").select("user_id,active").eq("user_id", session.user.id).maybeSingle(),
  ]);
  const firstError = profileResult.error ?? workspaceResult.error ?? membershipResult.error ?? platformAdminResult.error;
  if (firstError) throw firstError;

  const profile = profileResult.data as Profile;
  const workspaces = (workspaceResult.data ?? []) as Workspace[];
  const memberships = (membershipResult.data ?? []) as Membership[];
  const activeWorkspace = workspaces.find((item) => item.id === profile.default_workspace_id) ?? workspaces[0] ?? null;

  return {
    user: session.user,
    profile,
    workspaces,
    memberships,
    counts: await fetchCounts(supabase, activeWorkspace),
    isPlatformAdmin: Boolean(platformAdminResult.data?.active),
  };
}

function roleLabel(role: Role | null) {
  if (role === "owner") return "School Owner";
  if (role === "admin") return "School Admin";
  if (role === "leader") return "School Leader";
  if (role === "teacher") return "Teacher";
  if (role === "student") return "Student account";
  return "Private workspace";
}

function ActionCard({ action }: { action: Action }) {
  return (
    <Link
      href={action.href}
      className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${
        action.primary
          ? "border-emerald-900 bg-emerald-950 text-white"
          : "border-zinc-200 bg-white text-zinc-950 hover:border-emerald-300"
      }`}
    >
      {action.step ? (
        <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${action.primary ? "text-emerald-200" : "text-emerald-800"}`}>
          {action.step}
        </p>
      ) : null}
      <h3 className="mt-2 text-lg font-bold">{action.title}</h3>
      <p className={`mt-2 text-sm leading-6 ${action.primary ? "text-emerald-50/85" : "text-zinc-600"}`}>
        {action.description}
      </p>
      <span className={`mt-4 inline-flex text-sm font-bold ${action.primary ? "text-white" : "text-emerald-900"}`}>
        Open →
      </span>
    </Link>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWorkspace = useMemo(() => {
    if (!state) return null;
    return state.workspaces.find((item) => item.id === state.profile.default_workspace_id) ?? state.workspaces[0] ?? null;
  }, [state]);

  const activeRole = useMemo<Role | null>(() => {
    if (!state || !activeWorkspace) return null;
    return state.memberships.find((item) => item.workspace_id === activeWorkspace.id)?.role ?? null;
  }, [state, activeWorkspace]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();
    void fetchDashboardState(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setState(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(messageFrom(caught, "Your KSI workspace could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/sign-in");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  async function switchWorkspace(workspaceId: string) {
    if (!state || workspaceId === activeWorkspace?.id) return;
    setSwitching(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error: updateError } = await supabase.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", state.user.id);
      if (updateError) throw updateError;
      const nextWorkspace = state.workspaces.find((item) => item.id === workspaceId) ?? null;
      const counts = await fetchCounts(supabase, nextWorkspace);
      setState((current) => current ? { ...current, profile: { ...current.profile, default_workspace_id: workspaceId }, counts } : current);
    } catch (caught) {
      setError(messageFrom(caught, "Workspace could not be switched."));
    } finally {
      setSwitching(false);
    }
  }

  async function signOut() {
    await getBrowserSupabaseClient().auth.signOut();
    window.location.assign("/sign-in");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6"><p className="text-sm font-semibold text-zinc-600">Opening your KSI workspace…</p></main>;
  }

  if (!state || !activeWorkspace) {
    return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6"><div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">{error ?? "Your KSI workspace could not be loaded."}</div></main>;
  }

  const isSchool = activeWorkspace.workspace_type === "school";
  const isLockedSchool = isSchool && activeWorkspace.access_status !== "active";
  const isTeacher = activeRole === "teacher";
  const isLeader = activeRole === "leader";
  const canManage = activeRole === "owner" || activeRole === "admin";
  const canLead = canManage || isLeader;
  const canTeach = canManage || isTeacher;
  const name = state.profile.display_name?.trim() || state.user.user_metadata?.full_name || "KSI user";

  const teacherActions: Action[] = [
    { href: "/teacher/resources", title: "Academic Resources", description: "Start from your class, subject, term and weekly scheme. See objectives, activities, skills and resources before planning.", step: "Start here", primary: true },
    { href: "/hqls", title: "HQLS Lessons", description: "Create or continue a high-quality learning experience grounded in curriculum and class context.", step: "Plan" },
    { href: "/assessment", title: "Assessments", description: "Build aligned assessment evidence from what learners were actually taught.", step: "Assess" },
    { href: "/diagnosis", title: "Diagnosis & Intervention", description: "Understand learner evidence, generate a professional diagnosis and move directly into intervention.", step: "Understand" },
    { href: "/interventions", title: "Interventions", description: "Review confirmed actions and close the loop into the next lesson.", step: "Improve" },
    { href: "/saved-work", title: "Saved Work", description: "Return to lessons, assessments and diagnoses you already created.", step: "Continue" },
  ];

  const leadershipActions: Action[] = [
    { href: "/leadership", title: "Learning Health", description: "See what is happening across classes, subjects, delivery, mastery and intervention — from the same learning evidence teachers use.", step: "School overview", primary: true },
    { href: "/setup/curriculum", title: "Curriculum & Coverage", description: "Understand curriculum readiness, sequencing and coverage without mixing supplied schemes with canonical curriculum.", step: "Curriculum" },
    { href: "/interventions", title: "Intervention Follow-through", description: "See the improvement actions being carried forward from diagnosis into teaching.", step: "Improvement" },
    { href: "/teacher/resources", title: "Academic Resources", description: "Inspect the schemes and school learning resources teachers are working from.", step: "Teaching context" },
  ];

  const adminActions: Action[] = [
    { href: "/setup", title: "Classes, Subjects & Students", description: "Maintain the learning records KSI needs. Students remain learning records, not KSI app users." },
    { href: "/setup/teaching-map", title: "Teaching Assignments", description: "Connect teachers to the correct classes and subjects." },
    { href: "/setup/staff-access", title: "Staff Access", description: "Invite Teachers, Leaders and Admins with secure email-bound access codes." },
  ];

  return (
    <main className="min-h-screen bg-stone-50 pb-24 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2"><KaecBrand compact /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">KAEC School Intelligence</p>
              <p className="mt-1 text-sm text-zinc-500">Teacher & Leadership learning intelligence</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.workspaces.length > 1 ? (
              <select
                aria-label="Active workspace"
                value={activeWorkspace.id}
                disabled={switching}
                onChange={(event) => void switchWorkspace(event.target.value)}
                className="max-w-[260px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
              >
                {state.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
              </select>
            ) : null}
            <button type="button" onClick={() => void signOut()} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div> : null}

        <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">{roleLabel(activeRole)}</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {name}.</h1>
              <p className="mt-3 text-sm leading-6 text-emerald-50/90">
                {isTeacher
                  ? "Your workspace follows the teaching loop: start with what should be taught, design the lesson, gather evidence, diagnose what happened and improve the next lesson."
                  : canLead
                    ? "Your workspace focuses on learning health and the actions that improve it — not a long list of disconnected modules."
                    : "Use your private KSI workspace for the core learning-intelligence tools available to this account."}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              <p className="font-bold">{activeWorkspace.name}</p>
              <p className="mt-1 text-xs text-emerald-100">{isSchool ? `School · ${activeWorkspace.access_status}` : "Private workspace"}</p>
            </div>
          </div>
        </section>

        {isLockedSchool ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-bold text-amber-950">School access is {activeWorkspace.access_status}.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">Learning tools remain unavailable until KAEC restores the school to Active status.</p>
            {activeRole === "owner" ? <a href="/owner/access" className="mt-4 inline-flex rounded-xl bg-amber-950 px-4 py-2.5 text-sm font-bold text-white">View school access</a> : null}
          </section>
        ) : activeRole === "student" ? (
          <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-7">
            <h2 className="text-2xl font-bold">Student-facing KSI has been retired.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Your school keeps the authorised learner record for teacher diagnosis and learning support, but students no longer use KSI as an app. Contact your school if you need learning information.</p>
          </section>
        ) : (
          <>
            {canTeach ? (
              <section className="mt-8">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Teacher workspace</p>
                  <h2 className="mt-2 text-2xl font-bold">Teach → Assess → Understand → Improve</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">Everything needed for the teacher learning loop is now in one place.</p>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teacherActions.map((action) => <ActionCard key={action.href} action={action} />)}</div>
              </section>
            ) : null}

            {canLead ? (
              <section className="mt-10 border-t border-zinc-200 pt-8">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Leadership workspace</p>
                  <h2 className="mt-2 text-2xl font-bold">See what needs attention, then act.</h2>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{leadershipActions.map((action) => <ActionCard key={action.href} action={action} />)}</div>
              </section>
            ) : null}

            {canManage ? (
              <section className="mt-10 border-t border-zinc-200 pt-8">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">School administration</p>
                  <h2 className="mt-2 text-xl font-bold">People & learning setup</h2>
                  <p className="mt-2 text-sm text-zinc-600">Administrative setup stays separate from the daily learning workflow.</p>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">{adminActions.map((action) => <ActionCard key={action.href} action={action} />)}</div>
              </section>
            ) : null}

            {!isSchool ? (
              <section className="mt-8 grid gap-4 md:grid-cols-3">
                <ActionCard action={{ href: "/hqls", title: "HQLS Lessons", description: "Design high-quality learning experiences.", primary: true }} />
                <ActionCard action={{ href: "/assessment", title: "Assessments", description: "Create aligned learning evidence." }} />
                <ActionCard action={{ href: "/diagnosis", title: "Diagnosis", description: "Turn reviewed evidence into professional learning diagnosis." }} />
              </section>
            ) : null}
          </>
        )}

        {!isLockedSchool && activeRole !== "student" ? (
          <section className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Lessons</p><p className="mt-2 text-3xl font-bold">{state.counts.lessons}</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Assessments</p><p className="mt-2 text-3xl font-bold">{state.counts.assessments}</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Diagnoses</p><p className="mt-2 text-3xl font-bold">{state.counts.diagnoses}</p></div>
          </section>
        ) : null}

        {state.isPlatformAdmin ? (
          <section className="mt-10 rounded-3xl border border-zinc-300 bg-zinc-950 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">KAEC platform administration</p>
            <h2 className="mt-2 text-xl font-bold">Governance controls</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/admin/schools" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-950">School Access</Link>
              <Link href="/curriculum/review" className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold">Curriculum Review</Link>
              <Link href="/setup/curriculum/schemes" className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold">Scheme Source Review</Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
