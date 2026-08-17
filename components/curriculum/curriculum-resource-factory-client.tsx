"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type ResourceSummary = {
  id: string;
  resource_version: number;
  title: string;
  status: "draft" | "reviewed" | "published" | "retired";
  provider: string | null;
  model: string | null;
  generated_at: string;
  reviewed_at: string | null;
  published_at: string | null;
};

type FactoryItem = {
  curriculum_objective_node_id: string;
  framework_id: string;
  framework_name: string;
  framework_status: string;
  class_level: string | null;
  term: string | null;
  subject_name: string | null;
  title: string;
  objective_text: string | null;
  source_reference: string | null;
  position: number | null;
  latest_resource: ResourceSummary | null;
};

type FactoryPayload = {
  summary: {
    eligible_objectives: number;
    published_resources: number;
    draft_resources: number;
    reviewed_resources: number;
    coverage_percent: number;
    curriculum_ready: boolean;
  };
  total: number;
  limit: number;
  offset: number;
  items: FactoryItem[];
};

type ResourceDetail = {
  resource: ResourceSummary & {
    content: Record<string, unknown>;
    engine_version: string;
    prompt_version: string;
  };
  objective: {
    id: string;
    class_level: string | null;
    term: string | null;
    subject_name: string | null;
    title: string;
    objective_text: string | null;
    source_reference: string | null;
  };
  framework: { id: string; name: string; version_label: string };
};

async function sessionOrNull(supabase: SupabaseClient) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

async function loadFactory(
  supabase: SupabaseClient,
  classLevel: string,
  subjectName: string,
): Promise<FactoryPayload | null> {
  const session = await sessionOrNull(supabase);
  if (!session?.user) return null;

  const { data, error } = await supabase.rpc("get_curriculum_resource_factory_page", {
    target_framework_id: null,
    target_class_level: classLevel.trim() || null,
    target_subject_name: subjectName.trim() || null,
    target_limit: 50,
    target_offset: 0,
  });
  if (error) throw error;
  return data as FactoryPayload;
}

export function CurriculumResourceFactoryClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<FactoryPayload | null>(null);
  const [classLevel, setClassLevel] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editJson, setEditJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    const next = await loadFactory(supabase, classLevel, subjectName);
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setPayload(next);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadFactory(supabase, "", "")
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setPayload(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Curriculum Resource Factory could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const availableClasses = useMemo(
    () => Array.from(new Set((payload?.items ?? []).map((item) => item.class_level).filter(Boolean))).sort(),
    [payload],
  );
  const availableSubjects = useMemo(
    () => Array.from(new Set((payload?.items ?? []).map((item) => item.subject_name).filter(Boolean))).sort(),
    [payload],
  );

  async function openResource(resourceId: string) {
    setBusyId(resourceId);
    setError(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("get_curriculum_learning_resource_detail", {
        target_resource_id: resourceId,
      });
      if (rpcError) throw rpcError;
      const next = data as ResourceDetail;
      setDetail(next);
      setEditTitle(next.resource.title);
      setEditJson(JSON.stringify(next.resource.content, null, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The resource detail could not be opened.");
    } finally {
      setBusyId(null);
    }
  }

  async function generate(item: FactoryItem) {
    setBusyId(item.curriculum_objective_node_id);
    setError(null);
    setMessage(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const session = await sessionOrNull(supabase);
      if (!session?.access_token) {
        router.replace("/sign-in");
        return;
      }
      const response = await fetch("/api/curriculum/resource", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ curriculumObjectiveNodeId: item.curriculum_objective_node_id }),
      });
      const result = (await response.json()) as { resource_id?: string; error?: string };
      if (!response.ok || !result.resource_id) {
        throw new Error(result.error || "The resource draft could not be generated.");
      }
      setMessage("Draft generated. It is not visible to students until you review and explicitly publish it.");
      await refresh();
      await openResource(result.resource_id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The resource draft could not be generated.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdits() {
    if (!detail) return;
    setBusyId(detail.resource.id);
    setError(null);
    setMessage(null);
    try {
      const parsed = JSON.parse(editJson) as Record<string, unknown>;
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("update_curriculum_learning_resource_draft", {
        target_resource_id: detail.resource.id,
        target_title: editTitle.trim(),
        target_content: parsed,
      });
      if (rpcError) throw rpcError;
      setMessage("Edits saved. Review status has been reset to draft so the edited content must be reviewed again.");
      await refresh();
      await openResource(detail.resource.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The resource edits could not be saved.");
    } finally {
      setBusyId(null);
    }
  }

  async function act(action: "review" | "publish" | "retire") {
    if (!detail) return;
    setBusyId(detail.resource.id);
    setError(null);
    setMessage(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("review_curriculum_learning_resource", {
        target_resource_id: detail.resource.id,
        target_action: action,
      });
      if (rpcError) throw rpcError;
      setMessage(
        action === "publish"
          ? "Published. Students can now see this resource only through schools using the matching approved curriculum."
          : action === "review"
            ? "Human review recorded. Publication is still a separate explicit action."
            : "Resource retired and removed from student publication.",
      );
      await refresh();
      await openResource(detail.resource.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The curriculum-resource action could not be completed.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Curriculum Resource Factory…</p></main>;
  }

  if (error && !payload) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div></main>;
  }

  if (!payload) return null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link href="/setup/curriculum" className="text-sm font-semibold text-emerald-900">← Curriculum Intelligence</Link>

      <section className="mt-5 rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Curriculum Resource Factory</p>
        <h1 className="mt-2 text-3xl font-bold">Build the student learning library from approved curriculum</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">
          Only canonical objectives created through human scheme review and explicit promotion can enter this factory.
          AI creates a draft; a platform reviewer must inspect it, mark it reviewed, then separately publish it before any student can see it.
        </p>
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Canonical objectives" value={payload.summary.eligible_objectives} />
        <Metric label="Draft" value={payload.summary.draft_resources} />
        <Metric label="Reviewed" value={payload.summary.reviewed_resources} />
        <Metric label="Published" value={payload.summary.published_resources} />
        <Metric label="Published coverage" value={`${payload.summary.coverage_percent}%`} />
      </section>

      {!payload.summary.curriculum_ready ? (
        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
          <strong>The factory is correctly locked.</strong> There are currently no promoted canonical curriculum objectives.
          Complete the Stage 12 human review and explicit promotion workflow first. KSI will not auto-promote the 2,957 staged scheme rows simply to populate this library.
        </section>
      ) : null}

      <section className="mt-6 grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Class</span>
          <input
            list="ksi-resource-classes"
            value={classLevel}
            onChange={(event) => setClassLevel(event.target.value)}
            placeholder="All classes"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-emerald-700"
          />
          <datalist id="ksi-resource-classes">{availableClasses.map((item) => <option key={item} value={item ?? ""} />)}</datalist>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Subject</span>
          <input
            list="ksi-resource-subjects"
            value={subjectName}
            onChange={(event) => setSubjectName(event.target.value)}
            placeholder="All subjects"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-emerald-700"
          />
          <datalist id="ksi-resource-subjects">{availableSubjects.map((item) => <option key={item} value={item ?? ""} />)}</datalist>
        </label>
        <button type="button" onClick={() => void refresh()} className="self-end rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">Filter</button>
      </section>

      {message ? <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
      {error ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <section className="mt-6 space-y-4">
        {payload.items.map((item) => (
          <article key={item.curriculum_objective_node_id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  {item.class_level ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{item.class_level}</span> : null}
                  {item.term ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{item.term}</span> : null}
                  {item.subject_name ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{item.subject_name}</span> : null}
                </div>
                <h2 className="mt-3 text-lg font-bold text-zinc-950">{item.objective_text ?? item.title}</h2>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{item.source_reference ?? item.framework_name}</p>
                {item.latest_resource ? (
                  <p className="mt-3 text-sm font-semibold text-zinc-700">
                    Resource v{item.latest_resource.resource_version}: {item.latest_resource.title} · {item.latest_resource.status}
                  </p>
                ) : <p className="mt-3 text-sm text-zinc-500">No student resource drafted yet.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.latest_resource ? (
                  <button
                    type="button"
                    disabled={busyId === item.latest_resource.id}
                    onClick={() => void openResource(item.latest_resource!.id)}
                    className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-800 disabled:opacity-50"
                  >
                    Open latest
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === item.curriculum_objective_node_id}
                  onClick={() => void generate(item)}
                  className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busyId === item.curriculum_objective_node_id ? "Generating…" : item.latest_resource ? "Generate new version" : "Generate draft"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {detail ? (
        <section className="mt-8 rounded-3xl border-2 border-emerald-900/20 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Human review</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-950">{detail.objective.subject_name}: {detail.objective.objective_text ?? detail.objective.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">Version {detail.resource.resource_version} · {detail.resource.status}</p>
            </div>
            <button type="button" onClick={() => setDetail(null)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700">Close</button>
          </div>

          <label className="mt-6 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Student-facing title</span>
            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={detail.resource.status === "published" || detail.resource.status === "retired"} className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-emerald-700 disabled:bg-zinc-100" />
          </label>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Structured resource content</span>
            <textarea value={editJson} onChange={(event) => setEditJson(event.target.value)} rows={22} disabled={detail.resource.status === "published" || detail.resource.status === "retired"} className="w-full rounded-2xl border border-zinc-300 bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-100 outline-none focus:border-emerald-700 disabled:opacity-60" />
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            {detail.resource.status === "draft" || detail.resource.status === "reviewed" ? (
              <button type="button" disabled={busyId === detail.resource.id} onClick={() => void saveEdits()} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-800 disabled:opacity-50">Save edits</button>
            ) : null}
            {detail.resource.status === "draft" ? (
              <button type="button" disabled={busyId === detail.resource.id} onClick={() => void act("review")} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Mark human-reviewed</button>
            ) : null}
            {detail.resource.status === "reviewed" ? (
              <button type="button" disabled={busyId === detail.resource.id} onClick={() => void act("publish")} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Publish to students</button>
            ) : null}
            {detail.resource.status !== "retired" ? (
              <button type="button" disabled={busyId === detail.resource.id} onClick={() => void act("retire")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">Retire</button>
            ) : null}
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Publication is intentionally separate from AI generation and human review. Published content is immutable; revisions create a new version.</p>
        </section>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.11em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
    </article>
  );
}