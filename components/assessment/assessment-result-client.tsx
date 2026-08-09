"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Assessment = {
  id: string;
  workspace_id: string;
  title: string;
  assessment_mode: string;
  status: "draft" | "validated" | "archived";
  source_lesson_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  blueprint: unknown;
  source_context: unknown;
  updated_at: string;
};

type Item = {
  id: string;
  position: number;
  item_type: string;
  critical_thinking_type: string | null;
  topic: string | null;
  objective: string | null;
  difficulty: string | null;
  marks: number | null;
  content: unknown;
  answer_key: unknown;
  marking_guide: unknown;
};

type ResultState = {
  workspaceName: string;
  assessment: Assessment;
  items: Item[];
  className: string;
  subjectName: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function AssessmentResultClient({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile.default_workspace_id) throw new Error("Choose an active workspace before opening this assessment.");
      const workspaceId = profile.default_workspace_id;

      const [workspaceResult, assessmentResult, itemResult] = await Promise.all([
        supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
        supabase
          .from("assessments")
          .select("id,workspace_id,title,assessment_mode,status,source_lesson_id,class_id,subject_id,blueprint,source_context,updated_at")
          .eq("workspace_id", workspaceId)
          .eq("id", assessmentId)
          .single(),
        supabase
          .from("assessment_items")
          .select("id,position,item_type,critical_thinking_type,topic,objective,difficulty,marks,content,answer_key,marking_guide")
          .eq("assessment_id", assessmentId)
          .order("position"),
      ]);
      const firstError = workspaceResult.error ?? assessmentResult.error ?? itemResult.error;
      if (firstError) throw firstError;
      if (!workspaceResult.data || !assessmentResult.data || !itemResult.data) {
        throw new Error("This assessment is unavailable in the active workspace.");
      }

      let className = "Class not linked";
      let subjectName = "Subject not linked";
      if (assessmentResult.data.class_id) {
        const { data } = await supabase.from("classes").select("name").eq("workspace_id", workspaceId).eq("id", assessmentResult.data.class_id).maybeSingle();
        if (data?.name) className = data.name;
      }
      if (assessmentResult.data.subject_id) {
        const { data } = await supabase.from("subjects").select("name").eq("workspace_id", workspaceId).eq("id", assessmentResult.data.subject_id).maybeSingle();
        if (data?.name) subjectName = data.name;
      }

      if (!cancelled) {
        setState({
          workspaceName: workspaceResult.data.name,
          assessment: assessmentResult.data as Assessment,
          items: itemResult.data as Item[],
          className,
          subjectName,
        });
      }
    }

    void load()
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The assessment could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assessmentId, router]);

  async function downloadPdf() {
    if (!state) return;
    setDownloading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch(`/api/assessment/pdf?assessmentId=${encodeURIComponent(state.assessment.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(typeof payload.error === "string" ? payload.error : "The assessment PDF could not be prepared.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "kaec-assessment.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assessment PDF could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center px-5 text-sm text-zinc-500">Opening assessment…</div>;
  if (!state) return <main className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Assessment unavailable."}</div></main>;

  const blueprint = record(state.assessment.blueprint);
  const kind = typeof blueprint.assessmentKind === "string" ? blueprint.assessmentKind : "assessment";
  const difficulty = typeof blueprint.overallDifficulty === "string" ? blueprint.overallDifficulty : "not specified";
  const studentInstructions = typeof blueprint.studentInstructions === "string" ? blueprint.studentInstructions : "Answer all questions as instructed.";
  const totalMarks = typeof blueprint.totalMarks === "number"
    ? blueprint.totalMarks
    : state.items.reduce((sum, item) => sum + Number(item.marks ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-900">{state.assessment.status}</span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Assessment Result</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{state.assessment.title}</h1>
            <p className="mt-3 text-sm capitalize text-zinc-600">{kind} · {difficulty} · {state.items.length} items · {totalMarks} marks</p>
            <p className="mt-1 text-xs text-zinc-500">{state.subjectName} · {state.className} · {state.workspaceName}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap md:justify-end">
            {state.assessment.source_lesson_id ? (
              <Link href={`/hqls/result?lesson=${encodeURIComponent(state.assessment.source_lesson_id)}`} className="min-h-11 rounded-xl border border-emerald-900/20 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-950">Open Source HQLS Lesson</Link>
            ) : null}
            {state.assessment.status !== "archived" ? (
              <Link href={`/diagnosis?assessment=${encodeURIComponent(state.assessment.id)}`} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white">Use in Diagnosis</Link>
            ) : null}
            {state.assessment.status !== "archived" ? (
              <Link href={`/assessment?assessment=${encodeURIComponent(state.assessment.id)}&edit=1`} className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-800">Edit Assessment</Link>
            ) : null}
            <button type="button" onClick={() => void downloadPdf()} disabled={downloading} className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50">{downloading ? "Preparing PDF…" : "Download PDF"}</button>
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-stone-50 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Student instructions</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{studentInstructions}</p>
        </div>
      </section>

      <section className="mt-5 grid gap-4">
        {state.items.map((item) => {
          const content = record(item.content);
          const answer = record(item.answer_key);
          const guide = record(item.marking_guide);
          const prompt = typeof content.prompt === "string" ? content.prompt : `Assessment item ${item.position}`;
          const options = strings(content.options);
          const expected = strings(content.expectedEvidence);
          const criteria = strings(guide.criteria);
          const correctAnswer = typeof answer.correctAnswer === "string" ? answer.correctAnswer : "";
          const rationale = typeof content.answerRationale === "string"
            ? content.answerRationale
            : typeof answer.rationale === "string"
              ? answer.rationale
              : "";
          return (
            <article key={item.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Item {item.position} · {item.item_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.topic || "Topic not labelled"} · {item.difficulty || "moderate"}</p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-zinc-700">{Number(item.marks ?? 0)} marks</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-base font-medium leading-7 text-zinc-950">{prompt}</p>
              {options.length ? <ol className="mt-4 grid gap-2 text-sm text-zinc-700">{options.map((option, index) => <li key={index}>{String.fromCharCode(65 + index)}. {option}</li>)}</ol> : null}
              <details className="mt-5 rounded-2xl border border-zinc-200 bg-stone-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Answer & marking guidance</summary>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
                  {correctAnswer ? <p><strong>Answer:</strong> {correctAnswer}</p> : null}
                  {rationale ? <p><strong>Rationale:</strong> {rationale}</p> : null}
                  {expected.length ? <div><strong>Expected evidence</strong><ul className="mt-1 grid gap-1">{expected.map((entry, index) => <li key={index}>• {entry}</li>)}</ul></div> : null}
                  {criteria.length ? <div><strong>Marking guide</strong><ul className="mt-1 grid gap-1">{criteria.map((entry, index) => <li key={index}>• {entry}</li>)}</ul></div> : null}
                </div>
              </details>
            </article>
          );
        })}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/assessment" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">New Assessment</Link>
        <Link href="/saved-work" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Manage Saved Work</Link>
        <Link href="/dashboard" className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">Dashboard</Link>
      </div>
    </main>
  );
}
