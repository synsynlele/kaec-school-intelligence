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
};

function LearnerScores({ row, maxima, writable, assessmentId }: {
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await getBrowserSupabaseClient().rpc("get_learning_score_sheet", {
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
  }, [assessmentId]);

  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>;
  if (!sheet) return <p role="status">Loading scores…</p>;

  const { maxima } = sheet;
  const totalMaximum = maxima.objective + paperSections.reduce((sum, { key }) => sum + maxima[key], 0);

  return (
    <>
      <h2 className="text-xl font-semibold">{sheet.title}</h2>
      <p className="text-sm text-zinc-700">CBT scores appear after submission. Enter the marked totals for Subjective, Critical Thinking and Project. These scores are internal.</p>
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
                  <LearnerScores row={row} maxima={maxima} writable={sheet.writable} assessmentId={assessmentId} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
