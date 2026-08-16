"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type StudentHome = {
  workspaceName: string;
  studentName: string;
  className: string | null;
};

async function loadStudentHome(
  supabase: SupabaseClient,
): Promise<StudentHome | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: account, error: accountError } = await supabase
    .from("student_accounts")
    .select("workspace_id,student_id,active")
    .eq("user_id", session.user.id)
    .eq("active", true)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) throw new Error("This account is not linked to an active KSI student profile.");

  const [studentResult, workspaceResult] = await Promise.all([
    supabase
      .from("students")
      .select("display_name,class_id")
      .eq("id", account.student_id)
      .single(),
    supabase
      .from("workspaces")
      .select("name")
      .eq("id", account.workspace_id)
      .single(),
  ]);

  if (studentResult.error) throw studentResult.error;
  if (workspaceResult.error) throw workspaceResult.error;

  let className: string | null = null;
  if (studentResult.data.class_id) {
    const { data: classRow } = await supabase
      .from("classes")
      .select("name")
      .eq("id", studentResult.data.class_id)
      .maybeSingle();
    className = classRow?.name ?? null;
  }

  return {
    workspaceName: workspaceResult.data.name,
    studentName: studentResult.data.display_name,
    className,
  };
}

const MODULES = [
  ["What should I learn today?", "Your personalized learning priorities will appear here."],
  ["My Learning", "Curriculum-aligned resources, explanations, practice and revision."],
  ["My Learning Health", "See strengths, growth areas and progress over time."],
  ["My Diagnosis", "Understand what you did well and what needs attention."],
  ["My Interventions", "Follow the actions designed to help you improve."],
  ["Ask KSI", "Get curriculum-grounded help connected to your learning journey."],
] as const;

export function StudentHomeClient() {
  const router = useRouter();
  const [state, setState] = useState<StudentHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadStudentHome(supabase)
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
          setError(caught instanceof Error ? caught.message : "Student KSI could not be loaded.");
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
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading your learning space…</p></main>;
  }

  if (error || !state) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">{error ?? "Student profile unavailable."}</div></main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Student KSI</p>
        <h1 className="mt-2 text-3xl font-bold">Welcome, {state.studentName}</h1>
        <p className="mt-2 text-sm text-emerald-50/90">{state.workspaceName}{state.className ? ` · ${state.className}` : ""}</p>
        <div className="mt-6 rounded-2xl bg-white/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Your next move</p>
          <p className="mt-2 text-lg font-semibold">Your personalized “What should I learn today?” plan will live here.</p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(([title, description]) => (
          <article key={title} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Foundation ready</p>
          </article>
        ))}
      </section>
    </main>
  );
}
