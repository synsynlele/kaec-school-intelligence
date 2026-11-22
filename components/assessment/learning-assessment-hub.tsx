"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatCbtTime } from "@/lib/learning/cbt-time";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Assessment = {
  id: string;
  title: string;
  status: string;
  class_id: string | null;
  class_name: string | null;
  assigned: boolean;
  opens_at: string | null;
  closes_at: string | null;
  review_status: "submitted" | "returned" | "published" | null;
};

const pageSize = 20;

export function LearningAssessmentHub() {
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
      const { data, error } = await client.rpc("list_learning_assessments", {
        school_id: profile.default_workspace_id, search_text: filters.search, page_offset: filters.page * pageSize,
      });
      if (error) throw new Error(error.message);
      if (active) setRows(data as unknown as Assessment[]);
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
      <p className="text-sm text-zinc-700">Generate an assessment for a class, review or edit its objective questions, then schedule the CBT.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        showPage(query.trim(), 0);
      }}>
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">
          Find an assessment
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or class" className="rounded-xl border border-zinc-300 bg-white p-2.5 font-normal" />
        </label>
        <button className={action}>Search</button>
      </form>
      {loading ? <p role="status">Loading assessments…</p> : error ? <p role="alert">{error}</p> : (
        <>
          {rows.length === 0 && <p>{filters.search ? "No assessments match this search." : "Generate a class assessment to schedule your first CBT."}</p>}
          <ul className="space-y-3">
            {rows.slice(0, pageSize).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
                <div className="min-w-0 break-words">
                  <h2 className="font-semibold">{row.title}</h2>
                  <p className="text-sm text-zinc-700">{row.class_name ?? "Class required"} · {
                    row.review_status === "published" ? "Published" : row.review_status === "submitted" ? "Awaiting review" :
                    row.review_status === "returned" ? "Returned for correction" : row.opens_at && row.closes_at ?
                    `${formatCbtTime(row.opens_at)} to ${formatCbtTime(row.closes_at)} WAT` :
                    row.assigned ? "CBT assigned" : row.status === "validated" ? "Validated" : "Draft"
                  }</p>
                </div>
                <Link className={action} href={`/assessment/${row.assigned ? "score-sheet" : row.status === "validated" && !row.class_id ? "edit" : "result"}?assessment=${encodeURIComponent(row.id)}`}>
                  {row.assigned ? "Open score sheet" : row.status !== "validated" ? "Open assessment" : row.class_id ? "Schedule CBT" : "Select class"}
                </Link>
              </li>
            ))}
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
