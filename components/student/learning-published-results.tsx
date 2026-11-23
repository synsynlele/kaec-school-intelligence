"use client";

import { useState } from "react";

import { resultScores, termReportTitle, type TermReport, type PublishedResult, type ReportDiagnosis, type ResultReport } from "@/lib/learning/result-report";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

function DiagnosisTables({ diagnosis }: { diagnosis: ReportDiagnosis }) {
  const findingRows = [
    ["Academics / Skills", diagnosis.academicSkillStrengths, diagnosis.academicSkillChallenges],
    ["Character", diagnosis.characterStrengths, diagnosis.characterChallenges],
  ] as const;
  const actionRows = [
    ["Academics / Skills", diagnosis.schoolAcademicActions, diagnosis.parentAcademicActions],
    ["Character", diagnosis.schoolCharacterActions, diagnosis.parentCharacterActions],
  ] as const;
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Approved diagnosis</h3>
      {diagnosis.conciseDiagnosis && <p>{diagnosis.conciseDiagnosis}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Diagnosis findings</caption>
          <thead className="bg-stone-100"><tr>{["Area", "Strengths", "Challenges"].map((label) =>
            <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
          <tbody>{findingRows.map(([label, strengths, challenges]) => (
            <tr key={label} className="border-b border-stone-200 align-top">
              <th scope="row" className="p-2">{label}</th>
              {[strengths, challenges].map((items, column) => (
                <td key={column} className="whitespace-pre-wrap p-2">{items.map(({ statement }) => statement).join("\n") || "—"}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Diagnosis action plan</caption>
          <thead className="bg-stone-100"><tr>{["Action plan", "School", "Parents"].map((label) =>
            <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
          <tbody>{actionRows.map(([label, school, parent]) => (
            <tr key={label} className="border-b border-stone-200 align-top">
              <th scope="row" className="p-2">{label}</th>
              {[school, parent].map((items, column) => (
                <td key={column} className="whitespace-pre-wrap p-2">
                  {items.map(({ action, timeframe }) => timeframe ? `${action} (${timeframe})` : action).join("\n") || "—"}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {diagnosis.builderGrowthDirection && <p><strong>Builder Growth Direction</strong><br />{diagnosis.builderGrowthDirection}</p>}
      {diagnosis.encouragementNote && <p><strong>Encouragement</strong><br />{diagnosis.encouragementNote}</p>}
    </section>
  );
}

function ReportCard({ report }: { report: ResultReport }) {
  const { rows, summary } = resultScores(report);
  const logo = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(report.school_logo ?? "") ? report.school_logo : null;
  const photo = /^[A-Za-z0-9+/]+={0,2}$/.test(report.passport_photo ?? "") ? report.passport_photo : null;
  return (
    <article className="space-y-5 rounded-xl border border-stone-200 bg-white p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4 border-t-4 border-emerald-900 pt-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- School logos are uploaded JPEG data URLs. */}
            {logo && <img src={logo} alt="" className="h-12 w-12 shrink-0 object-contain" />}
            <p className="break-words font-semibold text-emerald-950">{report.school_name}</p>
          </div>
          <h2 className="text-xl font-bold">{report.title}</h2>
          <p className="font-semibold">{report.learner_name}</p>
          <p className="text-sm text-zinc-600">{[report.class_name, report.academic_session, report.term].filter(Boolean).join(" · ")}</p>
          <p className="text-sm text-zinc-600">Published {new Date(report.published_at).toLocaleDateString()}</p>
        </div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- The authenticated report provides a private JPEG.
          <img src={`data:image/jpeg;base64,${photo}`} alt="Learner passport photo" className="h-24 w-20 shrink-0 rounded border object-cover" />
        ) : (
          <div className="grid h-24 w-20 shrink-0 place-items-center rounded border border-dashed border-zinc-400 px-2 text-center text-xs text-zinc-600">
            Passport photo
          </div>
        )}
      </header>
      <table className="w-full overflow-hidden rounded-lg text-left text-sm">
        <caption className="sr-only">Official scores</caption>
        <thead className="bg-emerald-900 text-white"><tr><th scope="col" className="p-3">Assessment component</th><th scope="col" className="p-3 text-right">Score</th></tr></thead>
        <tbody>{rows.map(({ label, score, maximum, excused }) => (
          <tr key={label} className="border-b border-stone-200"><th scope="row" className="p-3 font-medium">{label}</th><td className="p-3 text-right">{excused ? "Excused" : score == null ? "Pending" : `${score} / ${maximum}`}</td></tr>
        ))}</tbody>
        <tfoot className="bg-emerald-50 font-bold text-emerald-950"><tr><th scope="row" className="p-3">Total</th><td className="p-3 text-right">{summary}</td></tr></tfoot>
      </table>
      {report.administrative_comment && <div className="rounded-lg bg-stone-100 p-3">
        <h3 className="font-semibold">Administrative comment</h3>
        <p className="whitespace-pre-wrap break-words">{report.administrative_comment}</p>
      </div>}
      {report.diagnosis && <DiagnosisTables diagnosis={report.diagnosis} />}
    </article>
  );
}

export function LearningPublishedResults({ viewer = "learner" }: { viewer?: "learner" | "parent" }) {
  const [results, setResults] = useState<PublishedResult[] | null>(null);
  const [diagnoses, setDiagnoses] = useState<Pick<ResultReport, "id" | "title" | "learner_name" | "term" | "academic_session">[] | null>(null);
  const [termReports, setTermReports] = useState<TermReport[] | null>(null);
  const [learnerId, setLearnerId] = useState<string | undefined>();
  const [report, setReport] = useState<ResultReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadResults() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc(viewer === "parent" ? "get_my_parent_learning_results" : "get_my_published_learning_results");
      if (error) throw new Error(error.message);
      setResults(data as unknown as PublishedResult[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load published results.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDiagnoses() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("get_my_parent_learning_diagnoses", {});
      if (error) throw new Error("Could not load approved diagnoses.");
      setDiagnoses(data as unknown as NonNullable<typeof diagnoses>);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load approved diagnoses.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTermReports() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("get_my_parent_term_reports", {});
      if (error) throw new Error("Could not load published term reports.");
      setTermReports(data as unknown as TermReport[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load published term reports.");
    } finally {
      setBusy(false);
    }
  }

  async function openReport(assignmentId: string, targetLearner?: string) {
    setBusy(true);
    setError("");
    try {
      const client = getBrowserSupabaseClient();
      const { data, error } = targetLearner
        ? await client.rpc("get_my_parent_learning_report", { assignment_id: assignmentId, target_learner: targetLearner })
        : await client.rpc("get_my_learning_result_report", { assignment_id: assignmentId });
      if (error || !data) throw new Error("Published result unavailable.");
      setReport(data as unknown as ResultReport);
      setLearnerId(targetLearner);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the report.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport(query: URLSearchParams, diagnosisOnly = false, termReport = false) {
    setBusy(true);
    setError("");
    try {
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session) throw new Error("Sign in again to download your result.");
      if (diagnosisOnly) query.set("format", "diagnosis");
      const response = await fetch(`/api/learning/${termReport ? "term-report" : "result/pdf"}?${query}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not download the result.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = termReport ? "ksi-term-report.pdf" : diagnosisOnly ? "ksi-learner-diagnosis.pdf" : "ksi-assessment-result.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not download the result.");
    } finally {
      setBusy(false);
    }
  }

  function downloadAssessment(assignmentId: string, diagnosisOnly = false) {
    const query = new URLSearchParams({ assignment: assignmentId });
    if (learnerId) query.set("learner", learnerId);
    return downloadReport(query, diagnosisOnly);
  }

  return (
    <section aria-label="Official results" className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      {error && <p role="alert" className="text-red-900">{error}</p>}
      {report ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" disabled={busy} onClick={() => { setReport(null); setError(""); }}
              className="font-semibold text-emerald-900 underline">Back to results</button>
            <button type="button" disabled={busy} onClick={() => void downloadAssessment(report.id)}
              className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-60">
              {busy ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
          {report.diagnosis && (
            <button type="button" disabled={busy} onClick={() => void downloadAssessment(report.id, true)}
              className="rounded-lg border border-emerald-900 px-4 py-2 font-semibold text-emerald-900 disabled:opacity-60">
              Download diagnosis PDF
            </button>
          )}
          <ReportCard report={report} />
        </>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={() => void loadResults()}
            className="font-semibold text-emerald-900 underline">
            {busy ? "Loading…" : results ? "Refresh published results" : "View published results"}
          </button>
          {viewer === "parent" && (
            <section aria-label="Approved learner diagnoses" className="space-y-3 border-t border-stone-200 pt-3">
              <button type="button" disabled={busy} onClick={() => void loadDiagnoses()}
                className="font-semibold text-emerald-900 underline">
                {diagnoses ? "Refresh approved diagnoses" : "View approved diagnoses"}
              </button>
              {diagnoses?.length === 0 && <p>No approved diagnoses are available yet.</p>}
              {diagnoses?.map((diagnosis) => (
                <div key={diagnosis.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3">
                  <div>
                    <p className="font-semibold">{diagnosis.learner_name} · {diagnosis.title}</p>
                    <p className="text-sm text-zinc-600">{[diagnosis.academic_session, diagnosis.term].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button type="button" disabled={busy}
                    aria-label={`Download diagnosis PDF for ${diagnosis.learner_name}: ${diagnosis.title}`}
                    className="font-semibold text-emerald-900 underline"
                    onClick={() => void downloadReport(new URLSearchParams({ diagnosis: diagnosis.id }), true)}>
                    Download PDF
                  </button>
                </div>
              ))}
            </section>
          )}
          {viewer === "parent" && (
            <section aria-label="Term reports" className="space-y-3 border-t border-stone-200 pt-3">
              <button type="button" disabled={busy} onClick={() => void loadTermReports()} className="font-semibold text-emerald-900 underline">
                {termReports ? "Refresh term reports" : "View term reports"}
              </button>
              {termReports?.length === 0 && <p>No term reports have been published yet.</p>}
              {termReports?.map((item) => (
                <div key={item.id} className="space-y-2 rounded-lg border border-stone-200 p-3">
                  <p className="font-semibold">{item.learner_name} · {termReportTitle(item.kind)}</p>
                  <p className="text-sm text-zinc-600">{item.academic_session} · {item.term}</p>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={busy} className="font-semibold text-emerald-900 underline"
                      onClick={() => void downloadReport(new URLSearchParams({ report: item.id }), false, true)}>Download PDF</button>
                    <button type="button" disabled={busy} className="font-semibold text-emerald-900 underline"
                      onClick={() => void downloadReport(new URLSearchParams({ report: item.id, combined: "1" }), false, true)}>Download combined term PDF</button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {results?.length === 0 && <p>No official results have been published for you yet.</p>}
          {results?.map((result) => {
            const { summary } = resultScores(result);
            return (
              <button key={`${result.id}:${result.learner_id ?? ""}`} type="button" disabled={busy} onClick={() => void openReport(result.id, result.learner_id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200 p-3 text-left">
                <span className="font-semibold">{result.title}{result.learner_name && <small className="block font-normal">{result.learner_name}</small>}</span>
                <span className="shrink-0 text-emerald-900">{summary}</span>
              </button>
            );
          })}
        </>
      )}
    </section>
  );
}
