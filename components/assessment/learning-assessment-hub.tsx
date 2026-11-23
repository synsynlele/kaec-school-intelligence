"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ManualProjectForm } from "@/components/assessment/manual-project-form";
import { formatCbtTime } from "@/lib/learning/cbt-time";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Assessment = {
  id: string;
  title: string;
  status: string;
  class_id: string | null;
  class_name: string | null;
  assigned: boolean;
  subject_name: string | null;
  marked: number;
  learners: number;
  opens_at: string | null;
  closes_at: string | null;
  review_status: "submitted" | "returned" | "published" | null;
};

const pageSize = 20;

export function LearningAssessmentHub() {
  const [projectSetup, setProjectSetup] = useState<{
    schoolId: string;
    classes: { id: string; name: string }[];
    subjects: { id: string; name: string }[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ search: "", page: 0 });
  const [rows, setRows] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const client = getBrowserSupabaseClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (!user) {
        if (active) window.location.replace("/sign-in");
        return;
      }
      if (authError) throw new Error(authError.message);
      const { data: profile, error: profileError } = await client.from("profiles")
        .select("default_workspace_id").eq("id", user.id).single();
      if (profileError) throw new Error(profileError.message);
      if (!profile.default_workspace_id) throw new Error("Choose your school workspace to open CBT & Score Sheets.");
      const schoolId = profile.default_workspace_id;
      const [{ data, error }, membership, classes, subjects] = await Promise.all([
        client.rpc("list_learning_assessments", {
          school_id: schoolId, search_text: filters.search, page_offset: filters.page * pageSize,
        }),
        client.from("workspace_members").select("role").eq("workspace_id", schoolId)
          .eq("user_id", user.id).eq("status", "active").maybeSingle(),
        client.from("classes").select("id,name").eq("workspace_id", schoolId).order("name"),
        client.from("subjects").select("id,name").eq("workspace_id", schoolId).order("name"),
      ]);
      if (error) throw new Error(error.message);
      if (!active) return;
      setRows(data as unknown as Assessment[]);
      if (membership.data && ["owner", "admin", "teacher"].includes(membership.data.role)
        && !classes.error && !subjects.error) {
        setProjectSetup({ schoolId, classes: classes.data ?? [], subjects: subjects.data ?? [] });
      } else {
        setProjectSetup(null);
      }
    }
    void load().catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Unable to load assessments.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  function showPage(search: string, page: number) {
    setLoading(true);
    setError("");
    setFilters({ search, page });
  }

  const action = "inline-flex justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white";
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <Link href="/assessment" className="text-sm font-semibold text-emerald-900 underline">Back to Assess</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">CBT &amp; Score Sheets</h1>
        <Link href="/assessment" className={action}>Generate assessment</Link>
      </header>
      <p className="text-sm text-zinc-700">Open a class assessment to enter marks or schedule its CBT.</p>
      {projectSetup && <ManualProjectForm {...projectSetup} />}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        showPage(query.trim(), 0);
      }}>
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">
          Find an assessment
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, class or subject" className="rounded-xl border border-zinc-300 bg-white p-2.5 font-normal" />
        </label>
        <button className={action}>Search</button>
      </form>
      {loading ? <p role="status">Loading assessments…</p> : error ? <p role="alert">{error}</p> : (
        <>
          {rows.length === 0 && <p>{filters.search ? "No assessments match this search." : "Generate a class assessment to begin mark entry."}</p>}
          <ul className="space-y-3">
            {rows.slice(0, pageSize).map((row) => {
              const eligible = row.status === "validated" && row.class_id;
              const percent = row.learners ? Math.round(row.marked / row.learners * 100) : 0;
              const query = `?assessment=${encodeURIComponent(row.id)}`;
              return (
                <li key={row.id} className="space-y-3 rounded-2xl border border-emerald-900/15 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-600">{[row.class_name ?? "Class required", row.subject_name].filter(Boolean).join(" · ")}</p>
                      <h2 className="break-words font-semibold">{row.title}</h2>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">{
                      row.review_status === "published" ? "Published" :
                      row.review_status === "submitted" ? "Awaiting review" :
                      row.review_status === "returned" ? "Returned for correction" :
                      !eligible ? (row.class_id ? "Draft" : "Class required") :
                      row.marked === 0 ? "Not started" : row.marked === row.learners ? "Mark entry complete" : "In progress"
                    }</span>
                  </div>
                  {eligible && (
                    <div className="space-y-1">
                      <p className="flex justify-between gap-2 text-sm text-zinc-700"><span>Mark entry</span><span>{row.marked}/{row.learners} learners · {percent}%</span></p>
                      <progress className="block h-2 w-full accent-emerald-700" value={row.marked} max={row.learners || 1}
                        aria-label={`Mark entry for ${row.title}`} />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {eligible && <Link className={action} href={`/assessment/score-sheet${query}`}>
                      {row.review_status === "published" ? "View marks" : row.review_status === "submitted" ? "Open for review" : "Enter marks"}
                    </Link>}
                    <Link className={eligible ? "text-sm font-semibold text-emerald-900 underline" : action}
                      href={`/assessment/${!row.class_id && row.status === "validated" ? "edit" : "result"}${query}`}>
                      {!row.class_id && row.status === "validated" ? "Select class" : "View assessment"}
                    </Link>
                    {eligible && <span className="text-xs text-zinc-600">{row.opens_at && row.closes_at ?
                      `CBT ${formatCbtTime(row.opens_at)} to ${formatCbtTime(row.closes_at)} WAT` :
                      row.assigned ? "CBT assigned" : "CBT not scheduled"}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {(filters.page > 0 || rows.length > pageSize) && <nav aria-label="Assessment pages" className="flex gap-4">
            <button disabled={filters.page === 0} onClick={() => showPage(filters.search, filters.page - 1)} className="disabled:opacity-40">Previous</button>
            <span>Page {filters.page + 1}</span>
            <button disabled={rows.length <= pageSize} onClick={() => showPage(filters.search, filters.page + 1)} className="disabled:opacity-40">Next</button>
          </nav>}
        </>
      )}
    </main>
  );
}
