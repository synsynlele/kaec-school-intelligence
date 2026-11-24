"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LearningPortalHeader } from "@/components/student/learning-portal-header";
import { LearningImprovementPlan } from "@/components/student/learning-improvement-plan";
import { LearningPublishedResults } from "@/components/student/learning-published-results";
import { formatCbtTime } from "@/lib/learning/cbt-time";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  prompt: string;
  type: string;
  marks: number;
  options: string[] | null;
};

type Feedback = {
  earned: number;
  possible: number;
  awaitingMarking: number;
  review?: (Question & { correct: string | null; answer: string | null; earned: number | null })[];
};

type Cbt = {
  id: string;
  title: string;
  feedback: Feedback | null;
  questions: Question[] | null;
  opensAt: string | null;
  closesAt: string | null;
  availability: "scheduled" | "open" | "closed";
};

export function LearningCbtClient() {
  const focusAssessmentHeading = useCallback((heading: HTMLHeadingElement | null) => {
    heading?.focus();
  }, []);
  const learnerId = useRef<string | null>(null);

  function draftKey(assessmentId: string) {
    return `ksi:cbt-draft:${learnerId.current}:${assessmentId}`;
  }

  function restoreAnswers(cbt: Cbt): Record<string, string> {
    if (!learnerId.current || !cbt.questions) return {};
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey(cbt.id)) ?? "{}");
      return Object.fromEntries(cbt.questions.flatMap(({ id }) =>
        typeof saved?.[id] === "string" ? [[id, saved[id]]] : []));
    } catch {
      return {};
    }
  }

  function saveAnswers(assessmentId: string, next: Record<string, string>) {
    if (!learnerId.current) return;
    try {
      if (Object.keys(next).length) sessionStorage.setItem(draftKey(assessmentId), JSON.stringify(next));
      else sessionStorage.removeItem(draftKey(assessmentId));
    } catch {
      // Keep the live form usable when browser storage is unavailable.
    }
  }

  function answerQuestion(questionId: string, value: string) {
    if (!current) return;
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    saveAnswers(current.id, next);
  }

  const [list, setList] = useState<Cbt[]>([]);
  const [current, setCurrent] = useState<Cbt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = getBrowserSupabaseClient();
        const { data: { session }, error: authError } = await client.auth.getSession();
        if (authError) throw new Error(authError.message);
        if (!active) return;
        if (!session) {
          window.location.replace("/learner-sign-in");
          return;
        }
        learnerId.current = session.user.id;
        const { data, error: failure } = await client.rpc("get_learning_cbts");
        if (!active) return;
        if (failure?.message === "An active learner account is required.") {
          setNeedsCode(true);
          return;
        }
        if (failure) throw new Error(failure.message);
        setList(data as unknown as Cbt[]);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load assessments.");
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      const { data, error: failure } = await getBrowserSupabaseClient().rpc("get_learning_cbts", { target_id: id });
      if (failure) throw new Error(failure.message);
      const [cbt] = data as unknown as Cbt[];
      if (!cbt) throw new Error("This assessment is unavailable.");
      if (!cbt.questions) saveAnswers(cbt.id, {});
      setAnswers(restoreAnswers(cbt));
      setCurrent(cbt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open the assessment.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(cbt: Cbt) {
    if (!window.confirm("Submit your answers? Your objective score is available immediately.")) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: failure } = await getBrowserSupabaseClient().rpc("submit_learning_cbt", {
        target_id: cbt.id,
        responses: answers,
      });
      if (failure) throw new Error(failure.message);
      const submitted = { ...cbt, feedback: data as unknown as Feedback, questions: null };
      setCurrent(submitted);
      setList((previous) => previous.map((item) => item.id === cbt.id ? submitted : item));
      setAnswers({});
      saveAnswers(cbt.id, {});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const button = "rounded-xl bg-emerald-900 px-4 py-3 font-semibold text-white disabled:opacity-60";
  const available = list.filter((item) => item.availability === "open" && !item.feedback).length;
  const submitted = list.filter((item) => item.feedback !== null).length;
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 bg-slate-50 px-4 py-6 text-slate-950 sm:px-8">
      {!current && <LearningPortalHeader viewer="learner" onSignOut={async () => {
        await getBrowserSupabaseClient().auth.signOut({ scope: "local" });
        window.location.replace("/learner-sign-in");
      }} />}
      {current && <h1 tabIndex={-1} ref={focusAssessmentHeading} className="text-3xl font-bold tracking-tight">{current.title}</h1>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
      {needsCode && <Link className={button} href="/learning/join">Enter your school access code</Link>}
      {busy && <p role="status" className="text-sm font-medium text-slate-600">Loading…</p>}
      {!current && !needsCode && (!busy || list.length > 0) && (!error || list.length > 0) && (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
              <dt className="text-sm font-semibold text-slate-600">Open to take</dt>
              <dd className="mt-1 text-3xl font-bold text-indigo-900">{available}</dd>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
              <dt className="text-sm font-semibold text-slate-600">Submitted</dt>
              <dd className="mt-1 text-3xl font-bold text-indigo-900">{submitted}</dd>
            </div>
          </dl>
          <section id="assessments" className="scroll-mt-5 space-y-3 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-xl font-bold tracking-tight">Assessments</h2>
            {list.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No assessments assigned yet.</p>}
            {list.map((item) => (
              <button key={item.id} disabled={busy} onClick={() => void open(item.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-4 text-left hover:bg-indigo-50 disabled:opacity-60">
                <span className="min-w-0 break-words font-semibold">{item.title}</span>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-950">
                  {item.feedback ? "View feedback" : item.availability === "scheduled" ? "Scheduled" : item.availability === "closed" ? "Closed" : "Open assessment"}
                </span>
              </button>
            ))}
          </section>
          <LearningImprovementPlan viewer="learner" />
          <LearningPublishedResults />
        </>
      )}
      {current && <button type="button" disabled={busy} onClick={() => {
        if (Object.keys(answers).length > 0 && !window.confirm("Leave this assessment? Your unsubmitted answers will be cleared.")) return;
        saveAnswers(current.id, {});
        setCurrent(null);
        setError("");
      }} className="font-semibold text-emerald-900 underline">Back to assessments</button>}
      {current?.opensAt && current.closesAt && (
        <p className="text-sm">CBT window {formatCbtTime(current.opensAt)} to {formatCbtTime(current.closesAt)} WAT.</p>
      )}
      {current && !current.feedback && !current.questions && (
        <p>{current.availability === "scheduled" ? "This CBT has not opened yet." : "This CBT is closed."}</p>
      )}
      {current?.feedback && (
        <section className="space-y-4">
          {current.feedback.possible > 0 && (
            <p className="rounded-xl bg-emerald-50 p-4 text-xl font-semibold">
              Objective score {current.feedback.earned} / {current.feedback.possible}
            </p>
          )}
          {current.feedback.awaitingMarking > 0 && <p>Written responses are awaiting marking.</p>}
          {!current.feedback.review && <p>Correct answers will be available here after the CBT closes.</p>}
          {current.feedback.review?.map((question, index) => (
            <article key={question.id} className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="font-semibold">{index + 1}. {question.prompt}</h2>
              <p className="whitespace-pre-wrap break-words">Your answer: {question.answer || "Unanswered"}</p>
              {question.type === "objective" && (
                <>
                  <p>Correct answer: {question.correct}</p>
                  <p>{question.earned} / {question.marks} marks</p>
                </>
              )}
            </article>
          ))}
        </section>
      )}
      {current?.questions && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(current); }}>
          {current.questions.map((question, index) => (
            <fieldset key={question.id} disabled={busy} className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
              <legend className="px-1 font-semibold">{index + 1}. {question.prompt} ({question.marks} marks)</legend>
              {question.options ? question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
                  <input type="radio" name={question.id} checked={answers[question.id] === option}
                    onChange={() => answerQuestion(question.id, option)} />
                  {option}
                </label>
              )) : (
                <textarea aria-label={`Answer for question ${index + 1}`} rows={4} maxLength={8000}
                  className="w-full rounded-lg border border-zinc-300 p-3" value={answers[question.id] ?? ""}
                  onChange={(event) => answerQuestion(question.id, event.target.value)} />
              )}
            </fieldset>
          ))}
          <button type="submit" className={button} disabled={busy}>Submit assessment</button>
        </form>
      )}
    </main>
  );
}
