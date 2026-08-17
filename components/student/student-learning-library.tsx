"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type LearningResource = {
  lesson_id: string;
  title: string;
  topic: string | null;
  objective: string | null;
  subject: string;
  duration_minutes: number | null;
  updated_at: string;
  warm_up: string;
  explanation: string;
  practice: string;
  practice_actions: string[];
  transfer_task: string;
  reflection_prompt: string;
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
      return [item.title, item.topic, item.objective, item.subject]
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
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            These resources come from validated HQLS lessons for your class. KSI reshapes them for learning: understand, practise, transfer and reflect.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
          {library.resources.length} resource{library.resources.length === 1 ? "" : "s"}
        </span>
      </div>

      <section className="mt-7 grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_220px]">
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Find a topic</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topic, objective or subject"
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
          Your student profile is not assigned to a class yet. Ask your school administrator to assign your class so KSI can show the correct learning resources.
        </section>
      ) : null}

      <section className="mt-7 space-y-5">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
            No validated learning resource matches this view yet. As teachers validate more HQLS lessons for your class, they will appear here automatically.
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

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{resource.subject}</span>
          {resource.topic ? <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{resource.topic}</span> : null}
          {resource.duration_minutes ? <span className="text-xs font-semibold text-zinc-400">{resource.duration_minutes} min lesson</span> : null}
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950">{resource.title}</h2>
        {resource.objective ? <p className="mt-3 text-sm leading-6 text-zinc-600"><strong>Goal:</strong> {resource.objective}</p> : null}
      </div>

      <div className="grid gap-4 p-6 sm:p-7 lg:grid-cols-2">
        {warmUp ? <ResourceBlock label="Start here" title="Warm up" text={warmUp} /> : null}
        {explanation ? <ResourceBlock label="Understand" title="Clear explanation" text={explanation} /> : null}
        {practice ? (
          <ResourceBlock label="Practise" title="Try it yourself" text={practice} items={resource.practice_actions} />
        ) : null}
        {transfer ? <ResourceBlock label="Apply" title="Use it somewhere new" text={transfer} /> : null}
        {reflection ? <ResourceBlock label="Reflect" title="What changed in your thinking?" text={reflection} wide /> : null}
      </div>
    </article>
  );
}

function ResourceBlock({
  label,
  title,
  text,
  items = [],
  wide = false,
}: {
  label: string;
  title: string;
  text: string;
  items?: string[];
  wide?: boolean;
}) {
  return (
    <section className={`rounded-2xl bg-zinc-50 p-5 ${wide ? "lg:col-span-2" : ""}`}>
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
