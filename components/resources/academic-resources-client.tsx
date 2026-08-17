"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Role = "owner" | "admin" | "leader" | "teacher" | "student";
type DocumentSummary = {
  id: string;
  filename: string;
  subject: string;
  education_level: string;
  class_scope: string[];
  extraction_status: string;
  quarantined: boolean;
  entry_count: number;
  topics_present: number;
  objectives_present: number;
  activities_present: number;
  skills_present: number;
  resources_present: number;
};

type SchemeEntry = {
  id: string;
  document_id: string;
  filename: string;
  class_level: string;
  term: string;
  week_label: string;
  week_number: number | null;
  subject: string;
  component: string | null;
  topic: string;
  learning_objectives: string[];
  learning_activities: string[];
  embedded_core_skills: string[];
  learning_resources: string[];
  source_page: number | null;
  source_reference: string | null;
  review_status: string;
  promoted: boolean;
  provenance_status: string;
};

type Catalog = {
  provenance_notice: string;
  classes: string[];
  subjects: string[];
  documents: DocumentSummary[];
  entries: SchemeEntry[];
};

type WorkspaceResource = {
  id: string;
  title: string;
  resource_type: string;
  visibility: string;
  status: string;
  mime_type: string | null;
  created_at: string;
};

type Context = {
  workspaceId: string;
  workspaceName: string;
  role: Role;
  catalog: Catalog;
  schoolResources: WorkspaceResource[];
};

const DEFAULT_CLASS = "JSS1";
const DEFAULT_TERM = "First Term";
const TERMS = ["First Term", "Second Term", "Third Term"];

function asCatalog(value: unknown): Catalog {
  const item = (value ?? {}) as Partial<Catalog>;
  return {
    provenance_notice:
      typeof item.provenance_notice === "string"
        ? item.provenance_notice
        : "Supplied scheme reference.",
    classes: Array.isArray(item.classes) ? item.classes : [],
    subjects: Array.isArray(item.subjects) ? item.subjects : [],
    documents: Array.isArray(item.documents) ? item.documents : [],
    entries: Array.isArray(item.entries) ? item.entries : [],
  };
}

async function loadBaseContext(supabase: SupabaseClient): Promise<Context | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile.default_workspace_id) {
    throw new Error("Choose an active school workspace first.");
  }
  const workspaceId = profile.default_workspace_id as string;

  const [workspaceResult, membershipResult, indexResult, resourceResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name,workspace_type,access_status")
      .eq("id", workspaceId)
      .single(),
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single(),
    supabase.rpc("get_academic_resource_catalog", {
      target_workspace_id: workspaceId,
      target_class_level: DEFAULT_CLASS,
      target_subject: "__catalog_only__",
      target_term: DEFAULT_TERM,
    }),
    supabase
      .from("resources")
      .select("id,title,resource_type,visibility,status,mime_type,created_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["uploaded", "ready"])
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const firstError =
    workspaceResult.error ??
    membershipResult.error ??
    indexResult.error ??
    resourceResult.error;
  if (firstError) throw firstError;
  if (workspaceResult.data?.workspace_type !== "school") {
    throw new Error("Academic Resources is available in a school workspace.");
  }
  if (workspaceResult.data?.access_status !== "active") {
    throw new Error("This school is not currently active in KSI.");
  }
  if (!membershipResult.data || membershipResult.data.status !== "active") {
    throw new Error("Active school access is required.");
  }
  if (!["owner", "admin", "leader", "teacher"].includes(membershipResult.data.role)) {
    throw new Error("Academic Resources is available to Teachers and School Leadership.");
  }

  const indexCatalog = asCatalog(indexResult.data);
  const firstSubject = indexCatalog.subjects[0] ?? "";
  let initialCatalog = indexCatalog;

  if (firstSubject) {
    const { data, error } = await supabase.rpc("get_academic_resource_catalog", {
      target_workspace_id: workspaceId,
      target_class_level: DEFAULT_CLASS,
      target_subject: firstSubject,
      target_term: DEFAULT_TERM,
    });
    if (error) throw error;
    initialCatalog = asCatalog(data);
  }

  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role as Role,
    catalog: initialCatalog,
    schoolResources: (resourceResult.data ?? []) as WorkspaceResource[],
  };
}

function ListBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <span className="text-emerald-700">•</span><span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-amber-700">{empty}</p>
      )}
    </div>
  );
}

function completeness(document: DocumentSummary | undefined) {
  if (!document || document.entry_count === 0) return 0;
  const fields = [
    document.objectives_present,
    document.activities_present,
    document.skills_present,
    document.resources_present,
  ];
  const total = fields.reduce(
    (sum, count) => sum + Math.min(count / document.entry_count, 1),
    0,
  );
  return Math.round((total / fields.length) * 100);
}

export function AcademicResourcesClient() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classLevel, setClassLevel] = useState(DEFAULT_CLASS);
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [tab, setTab] = useState<"scheme" | "school">("scheme");

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();
    void loadBaseContext(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setContext(next);
        setSubject(next.catalog.subjects[0] ?? "");
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Academic Resources could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [router]);

  const loadScheme = useCallback(
    async (nextClass: string, nextSubject: string, nextTerm: string) => {
      if (!context || !nextSubject) return;
      setFiltering(true);
      setError(null);
      try {
        const { data, error: rpcError } = await getBrowserSupabaseClient().rpc(
          "get_academic_resource_catalog",
          {
            target_workspace_id: context.workspaceId,
            target_class_level: nextClass,
            target_subject: nextSubject,
            target_term: nextTerm,
          },
        );
        if (rpcError) throw rpcError;
        setContext((current) =>
          current ? { ...current, catalog: asCatalog(data) } : current,
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The selected scheme could not be loaded.",
        );
      } finally {
        setFiltering(false);
      }
    },
    [context],
  );

  function chooseClass(nextClass: string) {
    setClassLevel(nextClass);
    void loadScheme(nextClass, subject, term);
  }

  function chooseSubject(nextSubject: string) {
    setSubject(nextSubject);
    void loadScheme(classLevel, nextSubject, term);
  }

  function chooseTerm(nextTerm: string) {
    setTerm(nextTerm);
    void loadScheme(classLevel, subject, nextTerm);
  }

  const selectedDocument = useMemo(
    () =>
      context?.catalog.documents.find(
        (item) =>
          item.subject.toLowerCase() === subject.toLowerCase() &&
          item.class_scope.includes(classLevel),
      ),
    [context?.catalog.documents, subject, classLevel],
  );
  const sourceCompleteness = completeness(selectedDocument);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm font-semibold text-zinc-600">Opening Academic Resources…</p>
      </main>
    );
  }
  if (!context) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          {error ?? "Academic Resources is unavailable."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-24 text-zinc-950">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
              Teacher KSI · {context.workspaceName}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Academic Resources
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Start with what should be taught. Move from the weekly scheme directly into lesson planning instead of searching through setup screens.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700"
          >
            Home
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-7 grid grid-cols-2 rounded-2xl bg-zinc-100 p-1 text-sm font-bold sm:max-w-md">
          <button
            type="button"
            onClick={() => setTab("scheme")}
            className={`rounded-xl px-4 py-3 ${tab === "scheme" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"}`}
          >
            Scheme of Work
          </button>
          <button
            type="button"
            onClick={() => setTab("school")}
            className={`rounded-xl px-4 py-3 ${tab === "school" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"}`}
          >
            School Resources
          </button>
        </div>

        {tab === "scheme" ? (
          <>
            <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Class</span>
                  <select
                    value={classLevel}
                    disabled={filtering}
                    onChange={(event) => chooseClass(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm font-semibold"
                  >
                    {context.catalog.classes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Subject</span>
                  <select
                    value={subject}
                    disabled={filtering}
                    onChange={(event) => chooseSubject(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm font-semibold"
                  >
                    {context.catalog.subjects.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Term</span>
                  <select
                    value={term}
                    disabled={filtering}
                    onChange={(event) => chooseTerm(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm font-semibold"
                  >
                    {TERMS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-3xl text-xs leading-5 text-zinc-500">
                  {context.catalog.provenance_notice}
                </p>
                {selectedDocument ? (
                  <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${sourceCompleteness >= 90 ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                    {sourceCompleteness}% rich extraction
                  </span>
                ) : null}
              </div>

              {selectedDocument && sourceCompleteness < 90 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  This source has weekly topics, but some objectives, activities, skills or resources have not yet been recovered from the original PDF. KSI shows what is genuinely available instead of inventing missing content.
                </div>
              ) : null}
            </section>

            <section className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Weekly sequence</p>
                  <h2 className="mt-1 text-2xl font-bold">{classLevel} · {subject} · {term}</h2>
                </div>
                <span className="text-sm text-zinc-500">
                  {filtering ? "Loading…" : `${context.catalog.entries.length} rows`}
                </span>
              </div>

              {!filtering && context.catalog.entries.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
                  No extracted scheme rows are available for this selection yet.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {context.catalog.entries.map((entry) => {
                    const objective = entry.learning_objectives.join(" ");
                    const hqlsHref = `/hqls?from=scheme&subject=${encodeURIComponent(entry.subject)}&classLevel=${encodeURIComponent(entry.class_level)}&topic=${encodeURIComponent(entry.topic)}&objective=${encodeURIComponent(objective)}&schemeEntry=${encodeURIComponent(entry.id)}`;
                    return (
                      <article key={entry.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{entry.week_label}</span>
                              {entry.component ? (
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{entry.component}</span>
                              ) : null}
                            </div>
                            <h3 className="mt-3 text-xl font-bold leading-7">{entry.topic}</h3>
                            <p className="mt-2 text-xs text-zinc-400">
                              {entry.filename}{entry.source_page ? ` · source page ${entry.source_page}` : ""}
                            </p>
                          </div>
                          <a
                            href={hqlsHref}
                            className="shrink-0 rounded-xl bg-emerald-950 px-4 py-3 text-center text-sm font-bold text-white"
                          >
                            Create HQLS lesson →
                          </a>
                        </div>
                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                          <ListBlock title="Learning objectives" items={entry.learning_objectives} empty="Objectives are pending source repair." />
                          <ListBlock title="Learning activities" items={entry.learning_activities} empty="Activities are pending source repair." />
                          <ListBlock title="Embedded core skills" items={entry.embedded_core_skills} empty="Core skills are pending source repair." />
                          <ListBlock title="Learning resources" items={entry.learning_resources} empty="Learning resources are pending source repair." />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">School library</p>
                <h2 className="mt-1 text-2xl font-bold">Uploaded curriculum, notes & references</h2>
              </div>
              <Link href="/resources" className="w-fit rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-700">
                Manage library
              </Link>
            </div>
            {context.schoolResources.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {context.schoolResources.map((resource) => (
                  <article key={resource.id} className="rounded-2xl border border-zinc-200 bg-stone-50 p-4">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800">{resource.resource_type.replaceAll("_", " ")}</span>
                    <h3 className="mt-3 font-bold">{resource.title}</h3>
                    <p className="mt-2 text-xs text-zinc-500">{resource.visibility === "private" ? "Private" : "School workspace"} · {resource.status}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-stone-50 p-6 text-sm text-zinc-600">
                No school resources have been uploaded yet. Owners and authorised staff can add trusted source material in the Resource Library.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
