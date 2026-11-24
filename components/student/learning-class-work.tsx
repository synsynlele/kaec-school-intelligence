"use client";

import { useEffect, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCalendar, FiClipboard, FiLayers } from "react-icons/fi";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type ClassWork = {
  id: string;
  kind: "assignment" | "project";
  title: string;
  subject: string | null;
  due_on: string | null;
  instructions: string | null;
  tasks: {
    id: string;
    prompt: string;
    marks: number | null;
    options: string[] | null;
    deliverable: string | null;
    constraints: string[] | null;
  }[] | null;
};

const dateLabel = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" });
const workLabels = { assignment: "Assignment", project: "Project" };

export function LearningClassWork() {
  const [items, setItems] = useState<ClassWork[] | null>(null);
  const [selected, setSelected] = useState<ClassWork | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getBrowserSupabaseClient().rpc("get_my_learning_class_work", {}).then(({ data, error }) => {
      if (!active) return;
      if (error) setError("Could not load class work. Refresh to try again.");
      else setItems(data as unknown as ClassWork[]);
    });
    return () => { active = false; };
  }, []);

  async function open(id: string) {
    setOpening(true);
    setError("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("get_my_learning_class_work", { target_id: id });
      if (error) throw error;
      const [item] = data as unknown as ClassWork[];
      if (!item) {
        setItems(current => current?.filter(work => work.id !== id) ?? []);
        setError("This work is no longer available.");
        return;
      }
      setSelected(item);
      document.getElementById("class-work-heading")?.focus();
    } catch {
      setError("Could not open this work. Try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <section id="class-work" aria-labelledby="class-work-heading" className="scroll-mt-5 space-y-4 rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6">
      <h2 id="class-work-heading" tabIndex={-1} className="text-xl font-bold tracking-tight">Assignments and projects</h2>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {opening && <p role="status" className="text-sm text-slate-600">Opening class work…</p>}
      {selected ? (
        <article className="space-y-4">
          <button type="button" onClick={() => {
            setSelected(null);
            document.getElementById("class-work-heading")?.focus();
          }} className="inline-flex min-h-11 items-center gap-2 font-semibold text-indigo-900"><FiArrowLeft aria-hidden="true" /> Back to class work</button>
          <header className="space-y-2 rounded-2xl bg-indigo-50 p-4 sm:p-5">
            <p className="text-sm font-semibold text-indigo-900">{workLabels[selected.kind]}{selected.subject && ` · ${selected.subject}`}</p>
            <h3 className="text-xl font-bold">{selected.title}</h3>
            {selected.due_on && <p className="text-sm">Due {dateLabel.format(new Date(selected.due_on))}</p>}
            {selected.instructions && <p className="whitespace-pre-wrap leading-relaxed">{selected.instructions}</p>}
          </header>
          <ol className="space-y-3">
            {selected.tasks?.map((task, index) => (
              <li key={task.id} className="space-y-2 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-indigo-900">Task {index + 1}{task.marks != null && ` · ${task.marks} marks`}</p>
                <p className="whitespace-pre-wrap leading-relaxed">{task.prompt}</p>
                {task.options?.length ? <ul className="list-disc space-y-1 pl-5">{task.options.map((option, i) => <li key={i}>{option}</li>)}</ul> : null}
                {task.deliverable && <p className="whitespace-pre-wrap"><strong>What to submit</strong><br />{task.deliverable}</p>}
                {task.constraints?.length ? <ul aria-label="Task requirements" className="list-disc space-y-1 pl-5">{task.constraints.map((item, i) => <li key={i}>{item}</li>)}</ul> : null}
              </li>
            ))}
          </ol>
        </article>
      ) : (
        <>
          {!items && !error && <p role="status" className="text-sm text-slate-600">Loading class work…</p>}
          {items?.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Your teachers have yet to publish class work.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {items?.map(item => {
              const Icon = item.kind === "project" ? FiLayers : FiClipboard;
              return (
                <button key={item.id} disabled={opening} type="button" onClick={() => void open(item.id)}
                  className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.kind === "project" ? "bg-teal-100 text-teal-900" : "bg-indigo-100 text-indigo-900"}`}><Icon aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium text-slate-600">{workLabels[item.kind]}{item.subject && ` · ${item.subject}`}</span>
                    <span className="block font-bold [overflow-wrap:anywhere]">{item.title}</span>
                    {item.due_on && <span className="flex items-center gap-1.5 text-sm text-slate-600"><FiCalendar aria-hidden="true" /> Due {dateLabel.format(new Date(item.due_on))}</span>}
                  </span>
                  <FiArrowRight aria-hidden="true" className="mt-1 shrink-0 text-indigo-800" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
