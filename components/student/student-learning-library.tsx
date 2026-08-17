"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type LearningResource = {
  delivery_id: string | null;
  lesson_id: string;
  title: string;
  topic: string | null;
  objective: string | null;
  subject: string;
  teacher_name: string;
  duration_minutes: number | null;
  delivered_at: string | null;
  updated_at: string;
  is_taught: boolean;
  warm_up: string;
  explanation: string;
  practice: string;
  practice_actions: string[];
  transfer_task: string;
  reflection_prompt: string;
  work_status: "not_assigned" | "assigned" | "submitted" | "reviewed";
  reflection_response: string;
  assignment_response: string;
  submitted_at: string | null;
  teacher_feedback: string;
};

type LearningLibrary = {
  student_id: string;
  class_id: string | null;
  resources: LearningResource[];
};

async function loadLibrary(supabase: SupabaseClient): Promise<LearningLibrary | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data, error } = await supabase.rpc("get_my_learning_resources");
  if (error) throw error;
  return data as LearningLibrary;
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function StudentLearningLibrary() {
  const router = useRouter();
  const [library, setLibrary] = useState<LearningLibrary | null>(null);
  const [subject, setSubject] = useState("All subjects");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadLibrary(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setLibrary(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Your learning library could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const subjects = useMemo(() => {
    const values = new Set((library?.resources ?? []).map((item) => item.subject));
    return ["All subjects", ...Array.from(values).sort()];
  }, [library]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (library?.resources ?? []).filter((item) => {
      if (subject !== "All subjects" && item.subject !== subject) return false;
      if (!needle) return true;
      return [item.title, item.topic, item.objective, item.subject, item.teacher_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [library, query, subject]);

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Building your learning library…</p></main>;
  }

  if (error || !library) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Learning library unavailable."}</div></main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/student" className="text-sm font-semibold text-emerald-900">← Student KSI</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">My Learning</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">Your living learning library</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            All validated HQLS lessons for your class are available here for study. When your teacher marks a lesson taught, KSI also links that lesson to the teacher and unlocks its reflection and real-life assignment for your own learning record.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
          {library.resources.length} lesson{library.resources.length === 1 ? "" : "s"}
        </span>
      </div>

      <section className="mt-7 grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_220px]">
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Find a topic</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topic, teacher or subject"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-emerald-700"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Subject</span>
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700"
          >
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      {!library.class_id ? (
        <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">
          Your student profile is not assigned to a class yet. Ask your school administrator to assign your class so KSI can show the correct lessons.
        </section>
      ) : null}

      <section className="mt-7 space-y-5">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm leading-6 text-zinc-600">
            No validated lesson matches this view yet. New validated lessons for your class will appear here automatically.
          </div>
        ) : (
          filtered.map((resource) => <LearningResourceCard key={resource.lesson_id} resource={resource} />)
        )}
      </section>
    </main>
  );
}

function LearningResourceCard({ resource }: { resource: LearningResource }) {
  const explanation = cleanText(resource.explanation);
  const warmUp = cleanText(resource.warm_up);
  const practice = cleanText(resource.practice);
  const transfer = cleanText(resource.transfer_task);
  const reflection = cleanText(resource.reflection_prompt);
  const [reflectionResponse, setReflectionResponse] = useState(resource.reflection_response ?? "");
  const [assignmentResponse, setAssignmentResponse] = useState(resource.assignment_response ?? "");
  const [status, setStatus] = useState(resource.work_status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resource.delivery_id) {
      setError("This lesson has not yet been marked taught by your teacher.");
      return;
    }
    if (!reflectionResponse.trim() && !assignmentResponse.trim()) {
      setError("Write your reflection or real-life assignment response before submitting.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("submit_my_lesson_work", {
        target_delivery_id: resource.delivery_id,
        reflection_text: reflectionResponse.trim(),
        assignment_text: assignmentResponse.trim(),
      });
      if (rpcError) throw rpcError;
      setStatus("submitted");
      setMessage("Submitted. Your work remains linked to this lesson and your learning record.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your lesson work could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{resource.subject}</span>
          {resource.topic ? <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{resource.topic}</span> : null}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${resource.is_taught ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
            {resource.is_taught ? "Taught" : "Available to study"}
          </span>
          {resource.duration_minutes ? <span className="text-xs font-semibold text-zinc-400">{resource.duration_minutes} min lesson</span> : null}
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950">{resource.title}</h2>
        {resource.objective ? <p className="mt-3 text-sm leading-6 text-zinc-600"><strong>Goal:</strong> {resource.objective}</p> : null}
        {resource.is_taught && resource.delivered_at ? (
          <p className="mt-3 text-xs font-semibold text-zinc-400">
            Taught by {resource.teacher_name || "your teacher"} · {new Date(resource.delivered_at).toLocaleDateString()}
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold text-zinc-400">Validated learning resource for your class</p>
        )}
      </div>

      <div className="grid gap-4 p-6 sm:p-7 lg:grid-cols-2">
        {warmUp ? <ResourceBlock label="Start here" title="Warm up" text={warmUp} /> : null}
        {explanation ? <ResourceBlock label="Understand" title="Clear explanation" text={explanation} /> : null}
        {practice ? (
          <ResourceBlock label="Practise" title="Try it yourself" text={practice} items={resource.practice_actions} />
        ) : null}
      </div>

      {resource.is_taught && (transfer || reflection) ? (
        <form onSubmit={submitWork} className="border-t border-zinc-100 bg-stone-50 p-6 sm:p-7">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Complete the learning loop</p>
              <h3 className="mt-1 text-xl font-bold text-zinc-950">Reflect and use it in real life</h3>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-600">{status}</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {reflection ? (
              <label className="rounded-2xl border border-zinc-200 bg-white p-5">
                <span className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-800">Reflection</span>
                <span className="mt-2 block text-sm leading-6 text-zinc-700">{reflection}</span>
                <textarea
                  value={reflectionResponse}
                  onChange={(event) => setReflectionResponse(event.target.value)}
                  rows={5}
                  placeholder="Write what changed in your thinking…"
                  className="mt-4 w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-sm outline-none focus:border-emerald-700"
                />
              </label>
            ) : null}

            {transfer ? (
              <label className="rounded-2xl border border-zinc-200 bg-white p-5">
                <span className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-800">Real-life assignment</span>
                <span className="mt-2 block whitespace-pre-line text-sm leading-6 text-zinc-700">{transfer}</span>
                <textarea
                  value={assignmentResponse}
                  onChange={(event) => setAssignmentResponse(event.target.value)}
                  rows={5}
                  placeholder="Describe your work, result or what you discovered…"
                  className="mt-4 w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-sm outline-none focus:border-emerald-700"
                />
              </label>
            ) : null}
          </div>

          {resource.teacher_feedback ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              <strong>Teacher feedback:</strong> {resource.teacher_feedback}
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Submitting…" : status === "assigned" ? "Submit lesson work" : "Update submission"}
          </button>
        </form>
      ) : null}
    </article>
  );
}

function ResourceBlock({
  label,
  title,
  text,
  items = [],
}: {
  label: string;
  title: string;
  text: string;
  items?: string[];
}) {
  return (
    <section className="rounded-2xl bg-zinc-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-800">{label}</p>
      <h3 className="mt-1 text-lg font-bold text-zinc-950">{title}</h3>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-zinc-700">{text}</p>
      {items.length ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => <li key={item} className="rounded-xl bg-white px-3 py-2 text-sm leading-6 text-zinc-700">{item}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
