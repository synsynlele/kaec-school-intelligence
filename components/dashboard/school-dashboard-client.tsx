"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  announceKsiWorkspaceChange,
  type KsiSchoolRole,
  resolveKsiRuntimeAccess,
} from "@/lib/supabase/runtime-access";

type Role = KsiSchoolRole;
type SchoolWorkspace = { id: string; name: string; role: Role };
type Metrics = { lessons: number; assessments: number; diagnoses: number; interventions: number };
type State = {
  displayName: string;
  email: string;
  activeWorkspaceId: string;
  schools: SchoolWorkspace[];
  metrics: Metrics;
};
type WorkspaceCard = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  emphasis?: "primary" | "neutral" | "blue";
};

const OPERATIONAL_ROLES = new Set(["owner", "admin", "leader", "teacher"]);

function roleLabel(role: Role) {
  if (role === "owner") return "School Owner";
  if (role === "admin") return "School Admin";
  if (role === "leader") return "School Leader";
  if (role === "teacher") return "Teacher";
  return "School member";
}

function WorkspaceCardView({ card }: { card: WorkspaceCard }) {
  const tone =
    card.emphasis === "primary"
      ? "border-emerald-900/15 bg-emerald-950 text-white"
      : card.emphasis === "blue"
        ? "border-blue-200 bg-blue-50 text-zinc-950"
        : "border-zinc-200 bg-white text-zinc-950";
  return (
    <Link href={card.href} className={`group rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${tone}`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${card.emphasis === "primary" ? "text-emerald-200" : "text-emerald-800"}`}>{card.eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">{card.title}</h3>
      <p className={`mt-3 text-sm leading-6 ${card.emphasis === "primary" ? "text-emerald-100" : "text-zinc-500"}`}>{card.description}</p>
      <p className={`mt-5 text-sm font-bold ${card.emphasis === "primary" ? "text-white" : "text-emerald-900"}`}>Open workspace →</p>
    </Link>
  );
}

export function SchoolDashboardClient() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const access = await resolveKsiRuntimeAccess(supabase, { force: true });
      if (!access) {
        router.replace("/sign-in");
        return;
      }
      if (!access.activeSchool) {
        router.replace("/auth/resolve");
        return;
      }

      const schools: SchoolWorkspace[] = access.memberships
        .filter(
          (membership) =>
            OPERATIONAL_ROLES.has(membership.member_role) &&
            membership.member_status === "active" &&
            membership.access_status === "active",
        )
        .map((membership) => ({
          id: membership.workspace_id,
          name: membership.workspace_name,
          role: membership.member_role as Role,
        }));

      const activeWorkspaceId = access.activeSchool.workspace_id;
      const [lessonResult, assessmentResult, diagnosisResult, interventionResult] = await Promise.all([
        supabase.from("lessons").select("id", { count: "exact", head: true }).eq("workspace_id", activeWorkspaceId).neq("status", "archived"),
        supabase.from("assessments").select("id", { count: "exact", head: true }).eq("workspace_id", activeWorkspaceId).neq("status", "archived"),
        supabase.from("diagnoses").select("id", { count: "exact", head: true }).eq("workspace_id", activeWorkspaceId).neq("status", "archived"),
        supabase.from("intervention_handoffs").select("id", { count: "exact", head: true }).eq("workspace_id", activeWorkspaceId).neq("status", "archived"),
      ]);
      const metricError = lessonResult.error ?? assessmentResult.error ?? diagnosisResult.error ?? interventionResult.error;
      if (metricError) throw metricError;

      setState({
        displayName: access.displayName,
        email: access.email,
        activeWorkspaceId,
        schools,
        metrics: {
          lessons: lessonResult.count ?? 0,
          assessments: assessmentResult.count ?? 0,
          diagnoses: diagnosisResult.count ?? 0,
          interventions: interventionResult.count ?? 0,
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The school dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const activeSchool = useMemo(() => state?.schools.find((school) => school.id === state.activeWorkspaceId) ?? null, [state]);

  async function switchSchool(workspaceId: string) {
    if (!state || workspaceId === state.activeWorkspaceId || !state.schools.some((school) => school.id === workspaceId)) return;
    setSwitching(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Sign in again.");
      const { error: updateError } = await supabase.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", user.id);
      if (updateError) throw updateError;
      announceKsiWorkspaceChange();
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "School workspace could not be changed.");
      setSwitching(false);
    }
  }

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center bg-stone-50 px-6 text-sm font-semibold text-zinc-500">Opening school intelligence workspace…</div>;
  if (!state || !activeSchool) {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
          <KaecBrand />
          <h1 className="mt-7 text-2xl font-semibold text-zinc-950">Dashboard check interrupted</h1>
          <p className="mt-3 text-sm leading-6 text-red-700">{error ?? "KSI could not finish loading this school workspace."}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-600">KSI will not interpret a dashboard-loading error as missing school membership or send you back to an access code.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Retry dashboard</button>
            <button type="button" onClick={() => void signOut()} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-900">Sign out</button>
          </div>
        </div>
      </main>
    );
  }

  const canManage = activeSchool.role === "owner" || activeSchool.role === "admin";
  const canLead = canManage || activeSchool.role === "leader";
  const isTeacher = activeSchool.role === "teacher";

  const teacherCards: WorkspaceCard[] = [
    { href: "/teacher/resources", eyebrow: "Start from curriculum", title: "Academic Resources", description: "Move from Class → Subject → Term → Week → Topic, then carry the teaching context directly into HQLS.", emphasis: "primary" },
    { href: "/hqls", eyebrow: "Plan the lesson", title: "HQLS Lesson Intelligence", description: "Generate, improve, save and download a complete seven-stage lesson with Full Illumination in normal lesson-teaching mode." },
    { href: "/assessment", eyebrow: "Check learning", title: "Assessment Intelligence", description: "Create validated assignments, quizzes, tests, examinations and projects grounded in lesson objectives." },
    { href: "/diagnosis", eyebrow: "Understand evidence", title: "Diagnosis & Intervention", description: "Turn evidence into a reviewed diagnosis, then follow the learner through a confirmed intervention plan.", emphasis: "blue" },
  ];
  const leadershipCards: WorkspaceCard[] = [
    { href: "/leadership", eyebrow: "School learning health", title: "Learning Intelligence", description: "See curriculum progress, delivery evidence, mastery signals and learning risks without ranking people.", emphasis: "primary" },
    { href: "/setup/curriculum", eyebrow: "Curriculum oversight", title: "Curriculum & Coverage", description: "Review the curriculum structure and coverage signals feeding leadership decisions." },
    { href: "/interventions", eyebrow: "Follow-through", title: "Intervention Continuity", description: "Track confirmed action plans and their connection to the next HQLS lesson.", emphasis: "blue" },
    { href: "/teacher/resources", eyebrow: "Teaching foundation", title: "Academic Resources", description: "Inspect the same scheme and learning-resource foundation teachers use before lessons are generated." },
  ];
  const cards = canLead && !isTeacher ? leadershipCards : teacherCards;

  return (
    <main className="min-h-screen bg-stone-50 px-4 pb-24 pt-5 sm:px-7 lg:pb-10 lg:pt-7">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <KaecBrand compact />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.17em] text-emerald-800">{isTeacher ? "Teacher workspace" : "Leadership workspace"}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{activeSchool.name}</h1>
              <p className="mt-2 text-sm text-zinc-500">{roleLabel(activeSchool.role)} · {state.displayName}{state.email ? ` · ${state.email}` : ""}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto] xl:w-[420px] xl:max-w-full">
              <label className="rounded-2xl border border-zinc-200 bg-stone-50 px-3 py-2">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Active school</span>
                <select value={state.activeWorkspaceId} disabled={switching} onChange={(event) => void switchSchool(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-bold text-zinc-900 outline-none">
                  {state.schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {roleLabel(school.role)}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void signOut()} className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:bg-stone-50">Sign out</button>
            </div>
          </div>
        </header>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["HQLS lessons", state.metrics.lessons], ["Assessments", state.metrics.assessments], ["Diagnoses", state.metrics.diagnoses], ["Interventions", state.metrics.interventions]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{value}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p>
            </div>
          ))}
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-800">{isTeacher ? "Teaching workflow" : "School learning intelligence"}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{isTeacher ? "Move from curriculum to evidence without losing the learning chain" : "See the school as a connected learning system"}</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-zinc-500">KSI keeps curriculum, lesson, assessment, diagnosis and intervention connected so each decision has visible provenance.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <WorkspaceCardView key={card.href} card={card} />)}</div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Continue work</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">Saved and downloadable teaching outputs</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">Open saved HQLS lessons and assessments, manage their lifecycle, or move directly to teacher-ready PDF exports.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/saved-work" className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white">Saved Work</Link>
              <Link href="/hqls/exports" className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-800">Lesson PDFs</Link>
            </div>
          </div>

          {canManage ? (
            <div className="rounded-3xl border border-emerald-900/15 bg-[#f5f8f4] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Administration</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">School setup & people</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">Manage academic structure and staff access only inside this school workspace.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/setup" className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Academic Setup</Link>
                <Link href="/setup/staff-access" className="rounded-xl border border-emerald-900/20 bg-white px-4 py-2.5 text-sm font-bold text-emerald-950">Staff Access</Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Permission boundary</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">Your role stays inside this school</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">Personal workspaces do not confer school administration rights. Your active role here is {roleLabel(activeSchool.role)}.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
