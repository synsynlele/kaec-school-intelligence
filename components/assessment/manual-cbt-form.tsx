"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Question = { id: number; prompt: string; options: string[]; correctIndex: number; marks: number };
type Choice = { id: string; name: string };

function newQuestion(id: number): Question {
  return { id, prompt: "", options: ["", "", "", ""], correctIndex: 0, marks: 1 };
}

const field = "w-full rounded-lg border border-zinc-300 bg-white p-2.5";
const button = "rounded-xl bg-emerald-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50";

export function ManualCbtForm() {
  const router = useRouter();
  const [school, setSchool] = useState("");
  const [classes, setClasses] = useState<Choice[]>([]);
  const [subjects, setSubjects] = useState<Choice[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState(() => [newQuestion(1)]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const client = getBrowserSupabaseClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (!user) {
        if (active) router.replace("/sign-in");
        return;
      }
      if (authError) throw new Error(authError.message);
      const { data: profile, error } = await client.from("profiles").select("default_workspace_id").eq("id", user.id).single();
      if (error) throw new Error(error.message);
      if (!profile.default_workspace_id) throw new Error("Choose a school workspace first.");
      const school = profile.default_workspace_id;
      const [classRows, subjectRows] = await Promise.all([
        client.from("classes").select("id,name").eq("workspace_id", school).order("name"),
        client.from("subjects").select("id,name").eq("workspace_id", school).order("name"),
      ]);
      const failure = classRows.error ?? subjectRows.error;
      if (failure) throw new Error(failure.message);
      if (!active) return;
      setClasses(classRows.data ?? []);
      setSubjects(subjectRows.data ?? []);
      setSchool(school);
    }
    void load().catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load classes."); });
    return () => { active = false; };
  }, [router]);

  function updateQuestion(id: number, changes: Partial<Question>) {
    setQuestions((previous) => previous.map((question) => question.id === id ? { ...question, ...changes } : question));
    setConfirmed(false);
  }

  async function save() {
    setError("");
    setBusy(true);
    try {
      const items = questions.map((question) => ({
        prompt: question.prompt.trim(),
        options: question.options.map((option) => option.trim()),
        correct: question.options[question.correctIndex].trim(),
        marks: question.marks,
      }));
      const { data, error } = await getBrowserSupabaseClient().rpc("create_manual_learning_assessment", {
        school_id: school, target_class: classId, target_subject: subjectId, assessment_title: title, items,
      });
      if (error) throw new Error(error.message);
      router.push(`/assessment/result?assessment=${encodeURIComponent(data)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the CBT.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-8">
      <Link className="text-sm font-semibold text-emerald-900 underline" href="/assessment/cbt">Back to CBT &amp; Score Sheets</Link>
      <h1 className="text-3xl font-bold">Write CBT questions</h1>
      <p className="text-sm">Create an objective-only CBT. For a test with written sections or a project, use <Link className="underline" href="/assessment">Assess</Link>.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{error}</p>}
      {school && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label className="block text-sm font-semibold">Title<input className={field} value={title} required maxLength={160}
          onChange={(event) => { setTitle(event.target.value); setConfirmed(false); }} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Class<select className={field} value={classId} required
            onChange={(event) => { setClassId(event.target.value); setConfirmed(false); }}>
            <option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label className="text-sm font-semibold">Subject<select className={field} value={subjectId} required
            onChange={(event) => { setSubjectId(event.target.value); setConfirmed(false); }}>
            <option value="">Select subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
        </div>
        {questions.map((question, index) => (
          <fieldset key={question.id} className="space-y-3 rounded-xl border bg-white p-4">
            <legend className="px-1 font-semibold">Question {index + 1}</legend>
            <label className="block text-sm">Question text<textarea className={field} value={question.prompt} required maxLength={2000}
              onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} /></label>
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-end gap-3">
                <label className="min-w-0 flex-1 text-sm">Choice {optionIndex + 1}<input className={field} value={option} required maxLength={500}
                  onChange={(event) => updateQuestion(question.id, {
                    options: question.options.map((value, i) => i === optionIndex ? event.target.value : value),
                  })} /></label>
                <label className="flex items-center gap-1 pb-3 text-sm"><input type="radio" name={`answer-${question.id}`}
                  aria-label={`Choice ${optionIndex + 1} is correct for question ${index + 1}`}
                  checked={question.correctIndex === optionIndex}
                  onChange={() => updateQuestion(question.id, { correctIndex: optionIndex })} /> Correct</label>
              </div>
            ))}
            <label className="block max-w-28 text-sm">Marks<input type="number" className={field} value={question.marks || ""}
              required min={1} max={100} onChange={(event) => updateQuestion(question.id, { marks: Number(event.target.value) })} /></label>
            {questions.length > 1 && <button type="button" className="text-sm text-red-800 underline" onClick={() => {
              setQuestions((previous) => previous.filter((item) => item.id !== question.id));
              setConfirmed(false);
            }}>Remove question {index + 1}</button>}
          </fieldset>
        ))}
        <button type="button" disabled={questions.length >= 100} className="font-semibold text-emerald-900 underline disabled:opacity-40"
          onClick={() => { setQuestions((previous) => [...previous, newQuestion(previous.at(-1)!.id + 1)]); setConfirmed(false); }}>
          Add question
        </button>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)} /> I reviewed the questions, correct answers and marks.</label>
        <button className={button} disabled={busy || !confirmed}>{busy ? "Saving…" : "Save and set schedule"}</button>
      </form>}
    </main>
  );
}
