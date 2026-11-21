"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  review: (Question & { correct: string | null; answer: string | null; earned: number | null })[];
};

type Cbt = { id: string; title: string; feedback: Feedback | null; questions: Question[] | null };

export function LearningCbtClient() {
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
          window.location.replace("/sign-in");
          return;
        }
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
      setAnswers({});
      setCurrent(cbt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open the assessment.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(cbt: Cbt) {
    if (!window.confirm("Submit your answers? You can review your score and correct answers after submission.")) return;
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const button = "rounded-xl bg-emerald-900 px-4 py-3 font-semibold text-white disabled:opacity-60";
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-8 text-zinc-950">
      <h1 className="text-3xl font-bold">{current?.title ?? "My assessments"}</h1>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
      {needsCode && <Link className={button} href="/learning/join">Enter your school access code</Link>}
      {busy && <p role="status">Please wait…</p>}
      {!current && !busy && !needsCode && !error && list.length === 0 && <p>No assessments assigned yet.</p>}
      {!current && list.map((item) => (
        <button key={item.id} disabled={busy} onClick={() => void open(item.id)}
          className="flex w-full justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left">
          <span className="font-semibold">{item.title}</span>
          <span className="text-emerald-900">{item.feedback ? "View feedback" : "Open CBT"}</span>
        </button>
      ))}
      {current && <button type="button" disabled={busy} onClick={() => {
        if (Object.keys(answers).length > 0 && !window.confirm("Leave this assessment? Your unsubmitted answers will be cleared.")) return;
        setCurrent(null);
        setError("");
      }} className="font-semibold text-emerald-900 underline">Back to assessments</button>}
      {current?.feedback && (
        <section className="space-y-4">
          {current.feedback.review.some((question) => question.type === "objective") && (
            <p className="rounded-xl bg-emerald-50 p-4 text-xl font-semibold">
              Objective score {current.feedback.earned} / {current.feedback.possible}
            </p>
          )}
          {current.feedback.awaitingMarking > 0 && <p>Written responses are awaiting marking.</p>}
          {current.feedback.review.map((question, index) => (
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
                    onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: option }))} />
                  {option}
                </label>
              )) : (
                <textarea aria-label={`Answer for question ${index + 1}`} rows={4} maxLength={8000}
                  className="w-full rounded-lg border border-zinc-300 p-3" value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))} />
              )}
            </fieldset>
          ))}
          <button type="submit" className={button} disabled={busy}>Submit assessment</button>
        </form>
      )}
    </main>
  );
}
