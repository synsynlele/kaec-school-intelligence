"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type LearningStatement = { statement?: string };

type ReviewedLessonEvidence = {
  evidence_id: string;
  lesson_id: string;
  lesson_title: string;
  subject_name: string;
  teacher_name: string;
  reflection_response: string;
  assignment_response: string;
  teacher_feedback: string;
  reviewed_at: string | null;
};

type StudentLearningIntelligence = {
  student: { id: string; name: string; class_id: string | null; class_name: string | null };
  school: { id: string; name: string };
  today_priority: { source: "intervention" | "diagnosis" | "baseline"; title: string; action: string; why: string };
  latest_diagnosis: {
    id: string;
    assessment_id: string | null;
    assessment_title: string | null;
    concise_diagnosis: string | null;
    academic_strengths: LearningStatement[];
    academic_challenges: LearningStatement[];
    builder_growth_direction: string | null;
    encouragement_note: string | null;
    academic_session: string | null;
    term: string | null;
    finalised_at: string | null;
  } | null;
  latest_intervention: {
    id: string;
    diagnosis_id: string;
    priority_growth_target: string | null;
    timeframe: string | null;
    success_indicator: string | null;
    review_date: string | null;
    next_learning_adjustment: string | null;
    confirmed_at: string | null;
  } | null;
  learning_health: {
    final_diagnoses: number;
    confirmed_interventions: number;
    has_current_diagnosis: boolean;
    has_current_intervention: boolean;
  };
  reviewed_lesson_evidence: ReviewedLessonEvidence[];
};

async function loadStudentLearningIntelligence(
  supabase: SupabaseClient,
): Promise<StudentLearningIntelligence | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const [intelligenceResult, evidenceResult] = await Promise.all([
    supabase.rpc("get_my_learning_intelligence"),
    supabase.rpc("get_my_reviewed_lesson_evidence"),
  ]);
  const firstError = intelligenceResult.error ?? evidenceResult.error;
  if (firstError) throw firstError;

  const evidencePayload = evidenceResult.data as { evidence?: ReviewedLessonEvidence[] } | null;
  return {
    ...(intelligenceResult.data as Omit<StudentLearningIntelligence, "reviewed_lesson_evidence">),
    reviewed_lesson_evidence: evidencePayload?.evidence ?? [],
  };
}

function statementList(items: LearningStatement[] | null | undefined) {
  return (items ?? [])
    .map((item) => item?.statement?.trim())
    .filter((statement): statement is string => Boolean(statement));
}

export function StudentHomeClient() {
  const router = useRouter();
  const [state, setState] = useState<StudentLearningIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadStudentLearningIntelligence(supabase)
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

    return () => { cancelled = true; };
  }, [router]);

  const strengths = useMemo(
    () => statementList(state?.latest_diagnosis?.academic_strengths),
    [state],
  );
  const growthAreas = useMemo(
    () => statementList(state?.latest_diagnosis?.academic_challenges),
    [state],
  );

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Building your learning picture…</p></main>;
  }

  if (error || !state) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">{error ?? "Student profile unavailable."}</div></main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Student KSI</p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {state.student.name}</h1>
            <p className="mt-2 text-sm text-emerald-50/90">
              {state.school.name}{state.student.class_name ? ` · ${state.student.class_name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-emerald-100">
            <span className="rounded-full bg-white/10 px-3 py-1.5">{state.learning_health.final_diagnoses} learning diagnosis{state.learning_health.final_diagnoses === 1 ? "" : "es"}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{state.learning_health.confirmed_interventions} confirmed plan{state.learning_health.confirmed_interventions === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{state.reviewed_lesson_evidence.length} reviewed real-life evidence</span>
          </div>
        </div>

        <div className="mt-7 rounded-3xl bg-white p-6 text-zinc-950 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">What should I work on today?</p>
          <h2 className="mt-2 text-2xl font-bold">{state.today_priority.title}</h2>
          <p className="mt-3 text-base leading-7 text-zinc-700">{state.today_priority.action}</p>
          <p className="mt-4 text-sm font-medium text-zinc-500">Why this: {state.today_priority.why}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/student/plan" className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Open My Plan</Link>
            <Link href="/student/ask" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-950">Ask KSI about this</Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">My strengths</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">What is already working</h2>
          {strengths.length ? (
            <ul className="mt-4 space-y-3">{strengths.map((strength) => <li key={strength} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-zinc-700">{strength}</li>)}</ul>
          ) : <p className="mt-4 text-sm leading-6 text-zinc-600">Your strengths will become clearer as KSI receives more reviewed learning evidence.</p>}
        </article>

        <article className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">My growth areas</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">Where focused practice can help</h2>
          {growthAreas.length ? (
            <ul className="mt-4 space-y-3">{growthAreas.map((area) => <li key={area} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-zinc-700">{area}</li>)}</ul>
          ) : <p className="mt-4 text-sm leading-6 text-zinc-600">No reviewed growth area is available yet. Keep building evidence through learning and assessment.</p>}
        </article>
      </section>

      <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">My real-life learning evidence</p>
            <h2 className="mt-2 text-xl font-bold text-zinc-950">Learning you have applied and reviewed</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">These are qualitative learning records, not test scores. They come from lesson reflections and real-life assignments that a teacher has reviewed.</p>
          </div>
          <Link href="/student/learning" className="w-fit rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Open My Learning</Link>
        </div>
        {state.reviewed_lesson_evidence.length ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {state.reviewed_lesson_evidence.slice(0, 4).map((evidence) => (
              <article key={evidence.evidence_id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{evidence.subject_name}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-zinc-600">Reviewed</span>
                </div>
                <h3 className="mt-3 font-bold text-zinc-950">{evidence.lesson_title}</h3>
                {evidence.teacher_feedback ? <p className="mt-3 text-sm leading-6 text-zinc-700"><strong>Teacher feedback:</strong> {evidence.teacher_feedback}</p> : null}
                <p className="mt-3 text-xs font-semibold text-zinc-400">Reviewed by {evidence.teacher_name}{evidence.reviewed_at ? ` · ${new Date(evidence.reviewed_at).toLocaleDateString()}` : ""}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">No reviewed lesson reflection or real-life assignment has entered your learning evidence yet.</p>
        )}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">My diagnosis</p>
          {state.latest_diagnosis ? (
            <>
              <h2 className="mt-2 text-xl font-bold text-zinc-950">{state.latest_diagnosis.assessment_title ?? "Latest learning diagnosis"}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-700">{state.latest_diagnosis.concise_diagnosis ?? "Your latest reviewed learning picture is available."}</p>
              {state.latest_diagnosis.builder_growth_direction ? <div className="mt-5 rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Growth direction</p><p className="mt-2 text-sm leading-6 text-zinc-700">{state.latest_diagnosis.builder_growth_direction}</p></div> : null}
              {state.latest_diagnosis.encouragement_note ? <p className="mt-5 text-sm leading-7 text-emerald-900">{state.latest_diagnosis.encouragement_note}</p> : null}
            </>
          ) : <p className="mt-3 text-sm leading-6 text-zinc-600">No finalised diagnosis is available yet. KSI will show only learning evidence that has completed the teacher review process.</p>}
        </article>

        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">My intervention</p>
          {state.latest_intervention ? (
            <>
              <h2 className="mt-2 text-xl font-bold text-zinc-950">{state.latest_intervention.priority_growth_target ?? "Current improvement plan"}</h2>
              {state.latest_intervention.next_learning_adjustment ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Your next action</p><p className="mt-2 text-sm leading-6 text-zinc-700">{state.latest_intervention.next_learning_adjustment}</p></div> : null}
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Timeframe</dt><dd className="mt-1 text-sm font-semibold text-zinc-800">{state.latest_intervention.timeframe ?? "In progress"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Success looks like</dt><dd className="mt-1 text-sm font-semibold leading-6 text-zinc-800">{state.latest_intervention.success_indicator ?? "Your teacher will review your progress."}</dd></div>
              </dl>
            </>
          ) : <p className="mt-3 text-sm leading-6 text-zinc-600">You do not have a confirmed intervention yet. When one is approved, KSI will turn it into a clear next action here.</p>}
        </article>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">My Plan</p>
          <h2 className="mt-2 text-lg font-bold text-zinc-950">Know what to do next</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Follow a versioned plan built from your confirmed intervention, mastery evidence and approved curriculum.</p>
          <Link href="/student/plan" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Open My Plan</Link>
        </article>
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">My Learning</p>
          <h2 className="mt-2 text-lg font-bold text-zinc-950">Study from governed resources</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Use validated HQLS class lessons and, when published, approved curriculum self-study resources.</p>
          <Link href="/student/learning" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Open My Learning</Link>
        </article>
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Ask KSI</p>
          <h2 className="mt-2 text-lg font-bold text-zinc-950">Get help understanding your learning</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Ask for explanations, examples, hints and practice grounded in your student-safe KSI learning state without exposing private teacher notes.</p>
          <Link href="/student/ask" className="mt-5 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-950">Ask KSI</Link>
        </article>
      </section>
    </main>
  );
}
