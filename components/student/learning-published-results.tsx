"use client";

import { useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const sections = [
  ["objective", "CBT"],
  ["subjective", "Subjective"],
  ["critical_thinking", "Critical Thinking"],
  ["project", "Project"],
] as const;
type Section = (typeof sections)[number][0];
type Result = {
  id: string;
  title: string;
  published_at: string;
  maxima: Record<Section, number>;
  scores: Record<Section, number | null>;
};

export function LearningPublishedResults() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadResults() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("get_my_published_learning_results");
      if (error) throw new Error(error.message);
      setResults(data as unknown as Result[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load published results.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Official results" className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <button type="button" disabled={busy} onClick={() => void loadResults()}
        className="font-semibold text-emerald-900 underline">
        {busy ? "Loading results…" : results ? "Refresh published results" : "View published results"}
      </button>
      {error && <p role="alert" className="text-red-900">{error}</p>}
      {results?.length === 0 && <p>No official results have been published for you yet.</p>}
      {results?.map((result) => {
        const included = sections.filter(([key]) => result.maxima[key] > 0);
        const total = included.reduce((sum, [key]) => sum + (result.scores[key] ?? 0), 0);
        const maximum = included.reduce((sum, [key]) => sum + result.maxima[key], 0);
        return (
          <article key={result.id} className="space-y-2 border-t border-zinc-200 pt-3">
            <h2 className="font-semibold">{result.title}</h2>
            <p className="text-sm text-zinc-600">Published {new Date(result.published_at).toLocaleDateString()}</p>
            <dl className="grid grid-cols-2 gap-2">
              {included.map(([key, label]) => (
                <div key={key}><dt>{label}</dt><dd>{result.scores[key]} / {result.maxima[key]}</dd></div>
              ))}
            </dl>
            <p className="font-semibold">Total {total} / {maximum}</p>
          </article>
        );
      })}
    </section>
  );
}
