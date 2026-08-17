"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type WorkedExample = { title?: string; steps?: string[]; answer?: string };
type PracticeItem = { question?: string; hint?: string; answer?: string };
type ResourceContent = {
  overview?: string;
  explanation?: string;
  worked_examples?: WorkedExample[];
  practice?: PracticeItem[];
  real_life_application?: string;
  reflection_prompt?: string;
  summary?: string[];
};

type CurriculumResource = {
  resource_id: string;
  curriculum_objective_node_id: string;
  framework_id: string;
  class_level: string | null;
  term: string | null;
  subject_name: string | null;
  topic: string;
  objective: string | null;
  source_reference: string | null;
  title: string;
  content: ResourceContent;
  resource_version: number;
  published_at: string | null;
};

type Payload = {
  class_name: string | null;
  readiness: {
    canonical_objectives: number;
    published_resources: number;
    coverage_percent: number;
    curriculum_promoted: boolean;
    resource_library_live: boolean;
  };
  resources: CurriculumResource[];
};

async function loadCurriculumResources(supabase: SupabaseClient): Promise<Payload> {
  const { data, error } = await supabase.rpc("get_my_curriculum_learning_resources");
  if (error) throw error;
  return data as Payload;
}

export function StudentCurriculumLibraryPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadCurriculumResources(supabase)
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Curriculum learning resources could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="mx-auto mt-8 max-w-6xl px-5 pb-10 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
      </section>
    );
  }
  if (!payload) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Curriculum Learning Library</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Your approved self-study resources</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              These resources come only from canonical curriculum objectives that passed KSI review/promotion and from learning material that was separately human-reviewed and published.
            </p>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-900">
            {payload.readiness.published_resources}/{payload.readiness.canonical_objectives} published
          </span>
        </div>

        {!payload.readiness.curriculum_promoted ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            Your school curriculum library is not live yet because no canonical objectives have completed the human promotion gate. KSI will not invent or auto-promote curriculum content.
          </div>
        ) : !payload.readiness.resource_library_live ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            Approved curriculum objectives are available, but their student learning resources are still being drafted and human-reviewed. Your validated HQLS class lessons above remain available meanwhile.
          </div>
        ) : null}
      </div>

      {payload.resources.length ? (
        <div className="mt-6 space-y-5">
          {payload.resources.map((resource) => <CurriculumResourceCard key={resource.resource_id} resource={resource} />)}
        </div>
      ) : null}
    </section>
  );
}

function CurriculumResourceCard({ resource }: { resource: CurriculumResource }) {
  const content = resource.content ?? {};
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        {resource.subject_name ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{resource.subject_name}</span> : null}
        {resource.term ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{resource.term}</span> : null}
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">Published v{resource.resource_version}</span>
      </div>
      <h3 className="mt-3 text-2xl font-bold text-zinc-950">{resource.title}</h3>
      {resource.objective ? <p className="mt-2 text-sm leading-6 text-zinc-600"><strong>Learning goal:</strong> {resource.objective}</p> : null}

      {content.overview ? <StudyBlock label="Start here" text={content.overview} /> : null}
      {content.explanation ? <StudyBlock label="Understand" text={content.explanation} /> : null}

      {content.worked_examples?.length ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Worked examples</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {content.worked_examples.map((example, index) => (
              <div key={`${resource.resource_id}-example-${index}`} className="rounded-2xl bg-zinc-50 p-4">
                <h4 className="font-bold text-zinc-900">{example.title || `Example ${index + 1}`}</h4>
                {example.steps?.length ? <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">{example.steps.map((step, stepIndex) => <li key={step}>{stepIndex + 1}. {step}</li>)}</ol> : null}
                {example.answer ? <p className="mt-3 text-sm font-semibold text-emerald-900">Answer: {example.answer}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {content.practice?.length ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Practice</p>
          <div className="mt-3 space-y-3">
            {content.practice.map((item, index) => (
              <details key={`${resource.resource_id}-practice-${index}`} className="rounded-2xl border border-zinc-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold leading-6 text-zinc-900">{index + 1}. {item.question}</summary>
                {item.hint ? <p className="mt-3 text-sm leading-6 text-amber-900"><strong>Hint:</strong> {item.hint}</p> : null}
                {item.answer ? <p className="mt-2 text-sm leading-6 text-emerald-900"><strong>Check:</strong> {item.answer}</p> : null}
              </details>
            ))}
          </div>
        </div>
      ) : null}

      {content.real_life_application ? <StudyBlock label="Use it in real life" text={content.real_life_application} /> : null}
      {content.reflection_prompt ? <StudyBlock label="Reflect" text={content.reflection_prompt} /> : null}

      {content.summary?.length ? (
        <div className="mt-5 rounded-2xl bg-emerald-950 p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">Remember</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-50">{content.summary.map((point) => <li key={point}>• {point}</li>)}</ul>
        </div>
      ) : null}

      {resource.source_reference ? <p className="mt-4 text-xs leading-5 text-zinc-400">Curriculum provenance: {resource.source_reference}</p> : null}
    </article>
  );
}

function StudyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-zinc-700">{text}</p>
    </div>
  );
}
