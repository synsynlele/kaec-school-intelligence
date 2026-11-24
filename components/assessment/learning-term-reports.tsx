"use client";

import { useState, type FormEvent } from "react";

import { resultScores, termReportTitle, type TermReport } from "@/lib/learning/result-report";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };
type Learner = { id: string; display_name: string; class_id: string | null };

type ReportPreview = Omit<TermReport, "assessments"> & {
  assessments: (TermReport["assessments"][number] & { subject_id?: string })[];
  enrolled_subject_ids?: string[] | null;
  published_reports?: Partial<Record<TermReport["kind"], string>>;
  withdrawal_history?: { id: string; kind: TermReport["kind"]; withdrawn_at: string; reason: string }[];
};

export function LearningTermReports({ schoolId, classes }: { schoolId: string; classes: Option[] }) {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [classId, setClassId] = useState("");
  const [report, setReport] = useState<ReportPreview | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [period, setPeriod] = useState<{ school_id: string; target_learner: string; school_session: string; school_term: string } | null>(null);
  const [kind, setKind] = useState<TermReport["kind"]>("midterm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const publishedId = report?.published_reports?.[kind];
  const history = report?.withdrawal_history?.filter((entry) => entry.kind === kind) ?? [];
  const missingSubjects = report?.enrolled_subject_ids?.filter(
    (id) => !report.assessments.some((item) => item.subject_id === id && selection.includes(item.id)),
  ).length ?? 0;
  const field = "w-full rounded-lg border border-zinc-300 bg-white p-2.5";

  async function chooseClass(id: string) {
    setClassId(id);
    setLearners([]);
    setReport(null);
    setMessage("");
    setError("");
    if (!id) return;
    setBusy(true);
    try {
      const { data, error } = await getBrowserSupabaseClient().from("students")
        .select("id,display_name,class_id").eq("workspace_id", schoolId).eq("class_id", id).eq("active", true).order("display_name");
      if (error) throw new Error(error.message);
      setLearners(data ?? []);
    } catch {
      setError("Could not load learners for this class.");
    } finally {
      setBusy(false);
    }
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextPeriod = {
      school_id: schoolId, target_learner: String(form.get("learner")),
      school_session: String(form.get("session")), school_term: String(form.get("term")),
    };
    setBusy(true);
    setError("");
    setMessage("");
    setReport(null);
    setSelection([]);
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("learning_term_report_preview", nextPeriod);
      if (error || !data) throw new Error(error?.message ?? "Report unavailable.");
      setPeriod(nextPeriod);
      setKind(form.get("kind") === "term" ? "term" : "midterm");
      setReport(data as unknown as ReportPreview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the report.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!period || !selection.length) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await getBrowserSupabaseClient().rpc("publish_learning_term_report", {
        ...period, report_kind: kind, selected_ids: selection,
      });
      if (error) throw new Error(error.message);
      setReport(null);
      setMessage("Report published for the learner’s linked parents.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish the report.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publishedId) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await getBrowserSupabaseClient().rpc("withdraw_learning_term_report", {
        school_id: schoolId, report_id: publishedId, reason,
      });
      if (error) throw new Error(error.message);
      setReport(null);
      setMessage("Report unpublished. Preview again to prepare a replacement.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unpublish the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl border border-emerald-900/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold text-emerald-950">Midterm and end-of-term reports</summary>
      <form onSubmit={preview} onChange={() => { setReport(null); setMessage(""); }} className="mt-4 space-y-4">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">Class
            <select className={field} value={classId} onChange={(event) => void chooseClass(event.target.value)} required>
              <option value="">Select class</option>
              {classes.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Learner
            <select key={classId} name="learner" className={field} required>
              <option value="">Select learner</option>
              {learners.map(({ id, display_name }) => <option key={id} value={id}>{display_name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Academic session
            <input name="session" className={field} required placeholder="2026/2027" pattern="[0-9]{4}/[0-9]{4}" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Term
            <select className={field} name="term">{["First Term", "Second Term", "Third Term"].map((term) => <option key={term}>{term}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Report type
            <select name="kind" className={field}><option value="midterm">Midterm</option><option value="term">End of term</option></select>
          </label>
        </fieldset>
        <button disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-60">Preview report</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      {report && (
        <section className="mt-4 space-y-3 border-t pt-4">
          <h3 className="font-semibold">{termReportTitle(kind)} · {report.learner_name}</h3>
          {publishedId ? (
            <form onSubmit={withdraw} className="space-y-3">
              <p className="text-sm">Unpublishing removes this report from the family portal and disables its download.</p>
              <label className="grid gap-1 text-sm font-semibold">Reason for unpublishing
                <textarea className={field} name="reason" required maxLength={500} disabled={busy} />
              </label>
              <button disabled={busy} className="rounded-lg border border-red-800 px-4 py-2 font-semibold text-red-800">
                Unpublish report
              </button>
            </form>
          ) : report.assessments.length === 0 ? <p>No published assessments for this period.</p> : (
            <fieldset disabled={busy} className="space-y-2">
              <legend className="mb-2 text-sm">Select the assessments to include.</legend>
              {missingSubjects > 0 && <p className="text-sm text-amber-900">{missingSubjects} enrolled subject(s) still need a selected result.</p>}
              {report.assessments.map((item) => {
                const { summary } = resultScores(item);
                return <label key={item.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <input type="checkbox" checked={selection.includes(item.id)}
                    onChange={(event) => setSelection(event.target.checked ? [...selection, item.id] : selection.filter((id) => id !== item.id))} />
                  <span className="flex-1">{[item.subject, item.title].filter(Boolean).join(" · ")}</span>
                  <span>{summary}</span>
                </label>;
              })}
              <button type="button" disabled={selection.length === 0 || missingSubjects > 0} onClick={() => void publish()}
                className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-60">
                Approve and publish report
              </button>
            </fieldset>
          )}
          {history.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Withdrawal history ({history.length})</summary>
              <ul className="mt-2 space-y-2">
                {history.map((entry) => (
                  <li key={entry.id} className="break-words">
                    <time dateTime={entry.withdrawn_at}>{new Date(entry.withdrawn_at).toLocaleDateString()}</time>
                    {" · "}{entry.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </details>
  );
}
