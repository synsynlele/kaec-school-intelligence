"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Source = { id: string; authority: string; name: string; url: string; status: string; accessed_on: string | null };
type Framework = { id: string; name: string; version_label: string; status: string; node_count: number };
type Adoption = { framework_id: string; status: string; adopted_at: string };
type Alignment = { ksi_objectives: number; verified_links: number; proposed_links: number; unmapped_objectives: number };
type Payload = { sources: Source[]; frameworks: Framework[]; school_adoptions: Adoption[]; alignment: Alignment };
type Context = { workspaceName: string; role: string; payload: Payload };

async function loadContext(supabase: SupabaseClient): Promise<Context | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", session.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) throw new Error("Choose a school workspace before opening Curriculum Intelligence.");

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult, curriculumResult] = await Promise.all([
    supabase.from("workspaces").select("name,workspace_type").eq("id", workspaceId).single(),
    supabase.from("workspace_members").select("role,status").eq("workspace_id", workspaceId).eq("user_id", session.user.id).single(),
    supabase.rpc("get_curriculum_intelligence", { target_workspace_id: workspaceId }),
  ]);
  const firstError = workspaceResult.error ?? membershipResult.error ?? curriculumResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data || workspaceResult.data.workspace_type !== "school") throw new Error("Curriculum Intelligence is available only in a school workspace.");

  return {
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role,
    payload: curriculumResult.data as Payload,
  };
}

export function CurriculumIntelligenceClient() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadContext(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) { router.replace("/sign-in"); return; }
        setContext(next);
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Curriculum Intelligence could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router]);

  if (loading) return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Curriculum Intelligence…</p></main>;
  if (error || !context) return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Curriculum Intelligence unavailable."}</div></main>;

  const { payload } = context;
  const alignmentRate = payload.alignment.ksi_objectives > 0
    ? Math.round((payload.alignment.verified_links / payload.alignment.ksi_objectives) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-900">← Dashboard</Link>
      <section className="mt-5 rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Curriculum Intelligence</p>
        <h1 className="mt-2 text-3xl font-bold">{context.workspaceName}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">
          One versioned curriculum backbone for lessons, assessments, mastery and next-learning decisions. KSI-generated objectives remain distinct from official curriculum objectives until alignment is explicitly verified.
        </p>
        <div className="mt-5">
          <Link href="/setup/curriculum/schemes" className="inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50">
            Open Scheme Ingestion →
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="KSI objectives" value={payload.alignment.ksi_objectives} />
        <Metric label="Verified curriculum links" value={payload.alignment.verified_links} />
        <Metric label="Proposed links" value={payload.alignment.proposed_links} />
        <Metric label="Verified alignment" value={`${alignmentRate}%`} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Authoritative sources</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">Source registry</h2>
          <div className="mt-5 space-y-4">
            {payload.sources.map((source) => (
              <div key={source.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">{source.status}</span>
                  {source.accessed_on ? <span className="text-xs font-semibold text-zinc-500">Checked {source.accessed_on}</span> : null}
                </div>
                <h3 className="mt-3 font-bold text-zinc-950">{source.name}</h3>
                <p className="mt-1 text-sm text-zinc-600">{source.authority}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Official source registered. Curriculum content is not marked ingested until KSI has a verifiable authoritative copy.</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Framework readiness</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-950">Versioned curriculum</h2>
          <div className="mt-5 space-y-4">
            {payload.frameworks.map((framework) => (
              <div key={framework.id} className="rounded-2xl border border-zinc-200 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{framework.status}</span>
                  <span className="text-xs font-semibold text-zinc-500">{framework.node_count} curriculum nodes</span>
                </div>
                <h3 className="mt-3 font-bold text-zinc-950">{framework.name}</h3>
                <p className="mt-2 text-xs text-zinc-500">Version: {framework.version_label}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Alignment queue</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-950">{payload.alignment.unmapped_objectives} KSI objective{payload.alignment.unmapped_objectives === 1 ? "" : "s"} awaiting curriculum mapping</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">This is intentional. KSI will not invent an official curriculum mapping. Once verified NERDC/Lagos source content is ingested, mappings can be proposed, reviewed and then verified without rewriting learner evidence.</p>
          </div>
          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600">Role: {context.role}</span>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p><p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p></article>;
}
