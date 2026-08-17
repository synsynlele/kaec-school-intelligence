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

type Membership = {
  workspace_id: string;
  role: "owner" | "admin" | "leader" | "teacher" | "student";
  status: string;
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
  memberships: Membership[];
  counts: WorkspaceCounts;
  isPlatformAdmin: boolean;
};

type NavItem = {
  href: string;
  title: string;
  description: string;
  badge?: string;
};

type NavSection = {
  eyebrow: string;
  title: string;
  description: string;
  items: NavItem[];
};

const EMPTY_COUNTS: WorkspaceCounts = { lessons: 0, assessments: 0, diagnoses: 0 };

const ACCESS_LABEL: Record<Workspace["access_status"], string> = {
  active: "Active",
  paused: "Paused",
  blocked: "Blocked",
  disabled: "Disabled",
};

function messageFrom(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (
    caught &&
    typeof caught === "object" &&
    "message" in caught &&
    typeof (caught as { message?: unknown }).message === "string"
  ) {
    return (caught as { message: string }).message;
  }
  return fallback;
}

async function fetchCounts(
  supabase: SupabaseClient,
  workspace: Workspace | null,
): Promise<WorkspaceCounts> {
  if (!workspace) return EMPTY_COUNTS;
  if (workspace.workspace_type === "school" && workspace.access_status !== "active") {
    return EMPTY_COUNTS;
  }

  const [lessonResult, assessmentResult, diagnosisResult] = await Promise.all([
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);

  const firstError = lessonResult.error ?? assessmentResult.error ?? diagnosisResult.error;
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

  const [profileResult, workspaceResult, membershipResult, platformAdminResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,email,default_workspace_id")
      .eq("id", session.user.id)
      .single(),
    supabase
      .from("workspaces")
      .select("id,name,workspace_type,access_status,created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_members")
      .select("workspace_id,role,status")
      .eq("user_id", session.user.id)
      .eq("status", "active"),
    supabase
      .from("platform_access_admins")
      .select("user_id,active")
      .eq("user_id", session.user.id)
      .maybeSingle(),
  ]);

  const firstError =
    profileResult.error ?? workspaceResult.error ?? membershipResult.error ?? platformAdminResult.error;
  if (firstError) throw firstError;

  const profile = profileResult.data as Profile;
  const workspaces = (workspaceResult.data ?? []) as Workspace[];
  const memberships = (membershipResult.data ?? []) as Membership[];
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === profile.default_workspace_id) ?? workspaces[0] ?? null;
  const counts = await fetchCounts(supabase, activeWorkspace);

  return {
    user: session.user,
    profile,
    workspaces,
    memberships,
    counts,
    isPlatformAdmin: Boolean(platformAdminResult.data?.active),
  };
}

function roleLabel(role: Membership["role"] | null) {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function DashboardClient() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWorkspace = useMemo(() => {
    if (!state) return null;
    return (
      state.workspaces.find((workspace) => workspace.id === state.profile.default_workspace_id) ??
      state.workspaces[0] ??
      null
    );
  }, [state]);

  const activeRole = useMemo(() => {
    if (!state || !activeWorkspace) return null;
    return (
      state.memberships.find((membership) => membership.workspace_id === activeWorkspace.id)?.role ?? null
    );
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
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
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ default_workspace_id: workspaceId })
        .eq("id", state.user.id);
      if (updateError) throw updateError;

      const nextWorkspace = state.workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
      const nextCounts = await fetchCounts(supabase, nextWorkspace);
      setState((current) =>
        current
          ? {
              ...current,
              profile: { ...current.profile, default_workspace_id: workspaceId },
              counts: nextCounts,
            }
          : current,
      );
    } catch (caught) {
      setError(messageFrom(caught, "Workspace could not be switched."));
    } finally {
      setSwitching(false);
    }
  }

  async function signOut() {
    await getBrowserSupabaseClient().auth.signOut();
    router.replace("/sign-in");
  }

  const navSections = useMemo<NavSection[]>(() => {
    if (!state || !activeWorkspace) return [];

    const sections: NavSection[] = [];
    const isSchool = activeWorkspace.workspace_type === "school";
    const schoolActive = !isSchool || activeWorkspace.access_status === "active";
    const canTeach = ["owner", "admin", "teacher"].includes(activeRole ?? "");
    const canLead = ["owner", "admin", "leader"].includes(activeRole ?? "");
    const canManage = ["owner", "admin"].includes(activeRole ?? "");

    if (!isSchool) {
      sections.push({
        eyebrow: "Personal workspace",
        title: "Core learning intelligence",
        description: "Use KSI privately while school-level access remains separately governed.",
        items: [
          { href: "/hqls", title: "HQLS Lessons", description: "Design and validate seven-stage learning experiences." },
          { href: "/assessment", title: "Assessments", description: "Create aligned assessments and marking evidence." },
          { href: "/diagnosis", title: "Diagnosis", description: "Turn reviewed evidence into actionable learning diagnosis." },
          { href: "/resources", title: "Resource Library", description: "Manage private teaching and curriculum references." },
          { href: "/saved-work", title: "Saved Work", description: "Return to your saved KSI artifacts." },
        ],
      });
    }

    if (isSchool && schoolActive && activeRole === "student") {
      sections.push({
        eyebrow: "Student KSI",
        title: "Your learning command centre",
        description: "Everything here is connected to your own governed learning record.",
        items: [
          { href: "/student", title: "My Student KSI", description: "See today’s priority, strengths, growth areas and diagnosis." },
          { href: "/student/learning", title: "My Learning", description: "Open validated lessons and approved learning resources." },
          { href: "/student/plan", title: "My Plan", description: "Follow your persistent personalized learning steps." },
          { href: "/student/mastery", title: "My Mastery", description: "See objective-level mastery and evidence confidence." },
          { href: "/student/ask", title: "Ask KSI", description: "Get bounded, personalized tutoring from your approved learning context." },
        ],
      });
    }

    if (isSchool && schoolActive && canTeach) {
      sections.push({
        eyebrow: "Teaching & learning",
        title: "Run the HQLS learning loop",
        description: "Plan, deliver, review evidence, assess, diagnose and intervene without losing context.",
        items: [
          { href: "/hqls", title: "HQLS Lessons", description: "Generate and validate HQLS learning experiences." },
          { href: "/hqls/deliver", title: "Lesson Delivery", description: "Deliver validated lessons through the teaching map." },
          { href: "/hqls/review", title: "Review Student Work", description: "Review reflections and real-life evidence." },
          { href: "/assessment", title: "Assessments", description: "Build aligned academic and reasoning assessments." },
          { href: "/diagnosis", title: "Diagnosis", description: "Turn evidence into reviewed growth diagnosis." },
          { href: "/interventions", title: "Interventions", description: "Confirm actions and close the loop into the next lesson." },
        ],
      });
    }

    if (isSchool && schoolActive && canLead) {
      sections.push({
        eyebrow: "School intelligence",
        title: "See learning health, not just activity",
        description: "Leadership intelligence is derived from the same delivery, evidence, intervention and mastery records.",
        items: [
          { href: "/leadership", title: "Leadership KSI", description: "Monitor class, subject, intervention, mastery and learning-risk signals." },
          { href: "/setup/curriculum", title: "Curriculum Intelligence", description: "Track curriculum readiness, alignment and coverage." },
        ],
      });
    }

    if (isSchool && schoolActive && canManage) {
      sections.push({
        eyebrow: "School setup",
        title: "People, classes and learning infrastructure",
        description: "Configure the governed school record that Teacher, Student and Leadership KSI share.",
        items: [
          { href: "/setup", title: "Academic Setup", description: "Manage classes, subjects and student records." },
          { href: "/setup/teaching-map", title: "Teaching Map", description: "Assign teachers to the right classes and subjects." },
          { href: "/setup/student-access", title: "Student Access", description: "Issue one-time codes to existing learner records." },
          { href: "/resources", title: "Resource Library", description: "Manage private school learning references." },
        ],
      });
    }

    if (state.isPlatformAdmin) {
      sections.push({
        eyebrow: "KAEC platform administration",
        title: "Govern access and curriculum publication",
        description: "These controls are platform-level and are not available to ordinary school owners.",
        items: [
          { href: "/admin/schools", title: "School Access Control", description: "Provision, activate, pause, block or disable schools.", badge: "Platform admin" },
          { href: "/curriculum/review", title: "Curriculum Review", description: "Human-review scheme entries before promotion.", badge: "Platform admin" },
          { href: "/curriculum/resources", title: "Curriculum Resource Factory", description: "Generate drafts, review them and publish approved student resources.", badge: "Platform admin" },
        ],
      });
    }

    return sections;
  }, [state, activeWorkspace, activeRole]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6"><p className="text-sm font-semibold text-zinc-600">Loading KSI…</p></main>;
  }

  if (!state || !activeWorkspace) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">{error ?? "Your KSI workspace could not be loaded."}</div>
      </main>
    );
  }

  const isLockedSchool =
    activeWorkspace.workspace_type === "school" && activeWorkspace.access_status !== "active";

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2"><KaecBrand compact /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">KAEC School Intelligence</p>
              <p className="mt-1 text-sm text-zinc-500">One governed learning system for Teacher, Student and Leadership KSI.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.workspaces.length > 1 ? (
              <select
                aria-label="Active workspace"
                value={activeWorkspace.id}
                disabled={switching}
                onChange={(event) => void switchWorkspace(event.target.value)}
                className="max-w-[280px] rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-700"
              >
                {state.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}{workspace.workspace_type === "school" && workspace.access_status !== "active" ? ` · ${ACCESS_LABEL[workspace.access_status]}` : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={() => void signOut()} className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">
                  {activeWorkspace.workspace_type === "school" ? "School workspace" : "Private workspace"}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">{roleLabel(activeRole)}</span>
                {activeWorkspace.workspace_type === "school" ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">{ACCESS_LABEL[activeWorkspace.access_status]}</span>
                ) : null}
              </div>
              <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{activeWorkspace.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">
                Welcome, {state.profile.display_name || state.profile.email || "Builder"}. Use the sections below for the work your role is authorised to perform.
              </p>
            </div>

            {!isLockedSchool ? (
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/10 p-4 text-center">
                <Metric label="Lessons" value={state.counts.lessons} />
                <Metric label="Assessments" value={state.counts.assessments} />
                <Metric label="Diagnoses" value={state.counts.diagnoses} />
              </div>
            ) : null}
          </div>
        </section>

        {activeWorkspace.workspace_type === "individual" ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Controlled school access</p>
            <h2 className="mt-2 text-xl font-bold text-amber-950">Signing up does not create or activate a school.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-900">
              This private workspace is available to your account. A subscribed school appears only after a KAEC platform administrator provisions it, and school-level KSI becomes available only after that school is explicitly activated.
            </p>
          </section>
        ) : null}

        {isLockedSchool ? (
          <section className="mt-6 rounded-3xl border border-amber-300 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">School access {ACCESS_LABEL[activeWorkspace.access_status]}</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Protected school KSI is currently locked.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Your membership and school data remain preserved, but Teacher, Student and Leadership school features are unavailable until KAEC changes this school back to Active.
            </p>
            {state.isPlatformAdmin ? (
              <Link href="/admin/schools" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Open School Access Control</Link>
            ) : null}
          </section>
        ) : (
          <div className="mt-8 space-y-8">
            {navSections.map((section) => (
              <section key={section.title}>
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">{section.eyebrow}</p>
                  <h2 className="mt-2 text-2xl font-bold text-zinc-950">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{section.description}</p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((item) => <NavigationCard key={item.href} item={item} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">{label}</p>
    </div>
  );
}

function NavigationCard({ item }: { item: NavItem }) {
  return (
    <Link href={item.href} className="group rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-zinc-950 group-hover:text-emerald-950">{item.title}</h3>
        {item.badge ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-800">{item.badge}</span> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{item.description}</p>
      <p className="mt-5 text-sm font-bold text-emerald-900">Open →</p>
    </Link>
  );
}
