"use client";

import { useEffect, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const paperSections = [
  { key: "subjective", label: "Subjective" },
  { key: "critical_thinking", label: "Critical Thinking" },
  { key: "project", label: "Project" },
] as const;

type PaperSection = (typeof paperSections)[number]["key"];
type PaperScores = Record<PaperSection, number | null>;
type ScoreRow = PaperScores & {
  id: string;
  name: string;
  objective: number | null;
  revision: number;
  editable: boolean;
};
type ScoreSheet = {
  title: string;
  maxima: Record<PaperSection | "objective", number>;
  writable: boolean;
  roster: ScoreRow[];
  status: "draft" | "submitted" | "returned" | "published";
  revision: number;
  note: string | null;
  recorded_at: string | null;
  can_review: boolean;
  administrative_comments?: Record<string, string>;
};

function LearnerScores({ row, maxima, writable, assessmentId, onDirty }: {
  onDirty: (id: string, dirty: boolean) => void;
  assessmentId: string;
  row: ScoreRow;
  maxima: ScoreSheet["maxima"];
  writable: boolean;
}) {
  const [scores, setScores] = useState<PaperScores>({
    subjective: row.subjective,
    critical_thinking: row.critical_thinking,
    project: row.project,
  });
  const [revision, setRevision] = useState(row.revision);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sections = paperSections.filter(({ key }) => maxima[key] > 0);
  const complete = row.objective !== null && sections.every(({ key }) => scores[key] !== null);
  const total = complete
    ? sections.reduce((sum, { key }) => sum + (scores[key] ?? 0), row.objective ?? 0)
    : null;
  const valid = sections.every(({ key }) => {
    const score = scores[key];
    return score === null || (Number.isFinite(score) && score >= 0 && score <= maxima[key]);
  });

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("save_learning_paper_scores", {
        source_id: assessmentId,
        learner_id: row.id,
        expected_revision: revision,
        subjective_score: scores.subjective,
        critical_thinking_score: scores.critical_thinking,
        project_score: scores.project,
      });
      if (error) throw new Error(error.message);
      setRevision(data);
      setDirty(false);
      onDirty(row.id, false);
      setMessage("Saved");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save scores.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <th scope="row" className="px-3 py-3 text-left font-semibold">{row.name}</th>
      <td className="px-3 py-3">{row.objective ?? "Pending"}</td>
      {paperSections.map(({ key, label }) => (
        <td key={key} className="px-3 py-3">
          {maxima[key] === 0 ? "—" : writable && row.editable ? (
            <input
              aria-label={`${label} score for ${row.name}`}
              aria-invalid={scores[key] !== null && (scores[key] < 0 || scores[key] > maxima[key])}
              className="w-24 rounded-lg border border-zinc-300 px-2 py-2"
              type="number"
              inputMode="decimal"
              min={0}
              max={maxima[key]}
              step="any"
              value={scores[key] ?? ""}
              disabled={busy}
              onChange={(event) => {
                const input = event.currentTarget;
                setScores((previous) => ({ ...previous, [key]: input.value === "" ? null : input.valueAsNumber }));
                setDirty(true);
                onDirty(row.id, true);
                setMessage("");
              }}
            />
          ) : scores[key] ?? "Pending"}
        </td>
      ))}
      <td className="px-3 py-3 font-semibold">{valid ? total ?? "Pending" : "—"}</td>
      {writable && <td className="px-3 py-3">
        {row.editable && sections.length > 0 && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || !valid || busy}
            aria-label={`Save scores for ${row.name}`}
            className="rounded-lg bg-emerald-900 px-3 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        )}
        {message && <p role="status" className="mt-1 text-sm">{message}</p>}
      </td>}
    </>
  );
}

export function LearningScoreSheet({ assessmentId }: { assessmentId: string }) {
  const [sheet, setSheet] = useState<ScoreSheet | null>(null);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [note, setNote] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("");

  async function draftComment(learnerId: string) {
    if (drafting || reviewBusy) return;
    setDrafting(learnerId);
    setDraftStatus("");
    try {
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session) throw new Error("Sign in again to draft a comment.");
      const response = await fetch("/api/assessment/result-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ assessmentId, learnerId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not draft a comment.");
      setComments((previous) => ({ ...previous, [learnerId]: result.comment }));
      setDraftStatus(result.generatedBy === "ai" ? "AI draft ready for review." : "Score-based suggestion ready for review.");
    } catch (caught) {
      setDraftStatus(caught instanceof Error ? caught.message : "Could not draft a comment.");
    } finally {
      setDrafting(null);
    }
  }
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [refresh, setRefresh] = useState(0);

  function trackDirty(id: string, dirty: boolean) {
    setDirtyRows((previous) => {
      const next = new Set(previous);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function changeReview(action: "submitted" | "returned" | "published") {
    if (!sheet || reviewBusy || drafting || dirtyRows.size) return;
    if (action === "published" && !window.confirm("Publish these official results to the learners?")) return;
    setReviewBusy(true);
    setReviewError("");
    try {
      const client = getBrowserSupabaseClient();
      const request = { source_id: assessmentId, expected_revision: sheet.revision };
      const { error } = action === "published"
        ? await client.rpc("publish_learning_result_with_comments", {
          ...request,
          comments: Object.fromEntries(Object.entries(comments)
            .map(([id, comment]) => [id, comment.trim()]).filter(([, comment]) => comment)),
        })
        : await client.rpc("change_learning_result_review", {
          ...request, next_action: action, correction_note: note,
        });
      if (error) throw new Error(error.message);
      setSheet(null);
      setNote("");
      setComments({});
      setDraftStatus("");
      setRefresh((previous) => previous + 1);
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : "Could not update the review.");
    } finally {
      setReviewBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await getBrowserSupabaseClient().rpc("get_learning_result_review", {
          source_id: assessmentId,
        });
        if (error) throw new Error(error.message);
        if (!cancelled) setSheet(data as unknown as ScoreSheet);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load the score sheet.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [assessmentId, refresh]);

  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>;
  if (!sheet) return <p role="status">Loading scores…</p>;

  const { maxima } = sheet;
  const statusLabel = { draft: "Draft", submitted: "Awaiting review", returned: "Returned for correction", published: "Published" }[sheet.status];
  const totalMaximum = maxima.objective + paperSections.reduce((sum, { key }) => sum + maxima[key], 0);

  return (
    <>
      <h2 className="text-xl font-semibold">{sheet.title}</h2>
      <p className="text-sm text-zinc-700">CBT scores appear after submission. Enter the marked totals for Subjective, Critical Thinking and Project. Official results appear for learners after school approval.</p>
      <section aria-label="Result publication" className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <p role="status" className="font-semibold">{statusLabel}
          {sheet.recorded_at && <span className="ml-2 text-sm font-normal">{new Date(sheet.recorded_at).toLocaleString()}</span>}
        </p>
        {sheet.note && <p className="whitespace-pre-wrap text-sm">{sheet.note}</p>}
        {sheet.writable && sheet.roster.length > 0 && (
          <button type="button" disabled={reviewBusy || dirtyRows.size > 0} onClick={() => void changeReview("submitted")}
            className="rounded-lg bg-emerald-900 px-3 py-2 font-semibold text-white disabled:opacity-50">
            Submit for review
          </button>
        )}
        {dirtyRows.size > 0 && <p className="text-sm">Save all edited rows before submitting.</p>}
        {sheet.status === "submitted" && sheet.can_review && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold" htmlFor="result-correction-note">Correction note</label>
            <textarea id="result-correction-note" rows={2} maxLength={1000} value={note}
              onChange={(event) => setNote(event.target.value)} className="w-full rounded-lg border border-zinc-300 p-2" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={reviewBusy || Boolean(drafting) || !note.trim()} onClick={() => void changeReview("returned")}
                className="rounded-lg border border-zinc-300 px-3 py-2 font-semibold disabled:opacity-50">Return for correction</button>
              <button type="button" disabled={reviewBusy || Boolean(drafting)} onClick={() => void changeReview("published")}
                className="rounded-lg bg-emerald-900 px-3 py-2 font-semibold text-white disabled:opacity-50">Approve and publish</button>
            </div>
          </div>
        )}
        {reviewError && <p role="alert" className="text-sm text-red-900">{reviewError}</p>}
      </section>
      {sheet.status === "submitted" && sheet.can_review && (
        <details className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">Administrative comments</summary>
          <p className="text-sm">Optional. Review each comment before publishing it with the learner’s result.</p>
          <p role="status" className="text-sm">{draftStatus}</p>
          {sheet.roster.map((row) => (
            <div key={row.id} className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor={`comment-${row.id}`}>{row.name}</label>
              <textarea id={`comment-${row.id}`} maxLength={500} rows={2}
                value={comments[row.id] ?? ""} disabled={reviewBusy || drafting === row.id}
                onChange={(event) => {
                  const comment = event.target.value;
                  setComments((previous) => ({ ...previous, [row.id]: comment }));
                }}
                className="w-full rounded-lg border border-zinc-300 p-2" />
              <button type="button" disabled={reviewBusy || Boolean(drafting) || Boolean(comments[row.id]?.trim())}
                onClick={() => void draftComment(row.id)} className="text-sm font-semibold text-emerald-900 underline disabled:opacity-50">
                {drafting === row.id ? "Drafting…" : "Suggest a comment"}
              </button>
            </div>
          ))}
        </details>
      )}
      {sheet.roster.length === 0 ? <p>No learners are listed for this class.</p> : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-stone-100 text-left">
              <tr>
                <th scope="col" className="p-3">Learner</th>
                <th scope="col" className="p-3">CBT / {maxima.objective}</th>
                {paperSections.map(({ key, label }) => (
                  <th key={key} scope="col" className="p-3">{label} / {maxima[key]}</th>
                ))}
                <th scope="col" className="p-3">Total / {totalMaximum}</th>
                {sheet.writable && <th scope="col" className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sheet.roster.map((row) => (
                <tr key={row.id} className="border-t border-zinc-200 align-top">
                  <LearnerScores row={row} maxima={maxima} writable={sheet.writable && !reviewBusy} assessmentId={assessmentId} onDirty={trackDirty} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
