"use client";

import { useState, type FormEvent } from "react";
import { resultScores, type TermReportAssessment } from "@/lib/learning/result-report";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };
type Assessment = TermReportAssessment & { subject_id: string };
type Learner = Option & { subjects: string[] | null; assessments: Assessment[] };
type Broadsheet = { subjects: Option[]; learners: Learner[]; selected: Record<string, string>; reserved: string[] };
type Period = { school_id: string; target_class: string; school_session: string; school_term: string; report_kind: string };
const field = "w-full rounded-lg border border-zinc-300 bg-white p-2.5";
const button = "rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-60";

function subjectCell(learner: Learner, subjectId: string, assessmentId: string | undefined, hasCandidates: boolean) {
  if (!learner.subjects) return "Confirm enrolment";
  if (!learner.subjects.includes(subjectId)) return "Not enrolled";
  if (!assessmentId) return hasCandidates ? "Choose assessment" : "Missing";
  const result = learner.assessments.find(({ id }) => id === assessmentId);
  return result ? resultScores(result).summary : "Missing";
}

export function LearningClassBroadsheet({ schoolId, classes }: { schoolId: string; classes: Option[] }) {
  const [sheet, setSheet] = useState<Broadsheet | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState<Period | null>(null);
  const [batch, setBatch] = useState<{ period: Period; classes: Record<string, Record<string, string>> } | null>(null);
  const [notice, setNotice] = useState("");
  const [masteryCutoff, setMasteryCutoff] = useState(60);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    setReason("");
    setSheet(null);
    setSelected({});
    try {
      const scope = {
        school_id: schoolId,
        target_class: String(form.get("class")),
        school_session: String(form.get("session")),
        school_term: String(form.get("term")),
        report_kind: String(form.get("kind")),
      };
      const { data, error } = await getBrowserSupabaseClient().rpc("get_learning_broadsheet_period", scope);
      if (error) throw new Error(error.message);
      const loaded = data as unknown as Broadsheet;
      setSheet(loaded);
      setPeriod(scope);
      setSelected(loaded.selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the class broadsheet.");
    } finally {
      setBusy(false);
    }
  }

  const sources = Object.fromEntries(Object.entries(selected).filter(([, id]) => id));
  const saved = Object.keys(sources).length === Object.keys(sheet?.selected ?? {}).length
    && Object.entries(sheet?.selected ?? {}).every(([id, source]) => sources[id] === source);

  async function update(action: "save" | "publish" | "withdraw" | "download") {
    if (!sheet || !period) return;
    setBusy(true);
    setError("");
    setNotice("");
    const client = getBrowserSupabaseClient();
    try {
      if (action === "download") {
        const { data: { session } } = await client.auth.getSession();
        if (!session) throw new Error("Sign in again to download reports.");
        const query = new URLSearchParams(period);
        const response = await fetch(`/api/learning/term-report?${query}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = `ksi-class-${period.report_kind}-reports.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (action === "save") {
        const { error } = await client.rpc("save_learning_broadsheet_period", {
          ...period, selected_sources: sources, previous_sources: sheet.selected,
        });
        if (error) throw new Error(error.message);
        setSheet({ ...sheet, selected: sources });
        setNotice("Selections saved for this reporting period.");
        return;
      }
      const { data, error } = action === "publish"
        ? await client.rpc("publish_learning_class_reports", { ...period, expected_sources: sheet.selected, mastery_cutoff: masteryCutoff })
        : await client.rpc("withdraw_learning_class_reports", { ...period, reason });
      if (error) throw new Error(error.message);
      setNotice(`${data} reports ${action === "publish" ? "published" : "withdrawn"}.`);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update class reports.");
    } finally {
      setBusy(false);
    }
  }

  function addToBatch() {
    if (!period || !sheet || !saved) return;
    const samePeriod = batch && batch.period.school_id === period.school_id
      && batch.period.school_session === period.school_session && batch.period.school_term === period.school_term
      && batch.period.report_kind === period.report_kind;
    setBatch({ period, classes: { ...(samePeriod ? batch.classes : {}), [period.target_class]: sheet.selected } });
    setNotice("Class added to the release batch.");
  }

  async function publishBatch() {
    if (!batch) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { school_id, school_session, school_term, report_kind } = batch.period;
      const { data, error } = await getBrowserSupabaseClient().rpc("publish_learning_class_batch", {
        school_id, school_session, school_term, report_kind, reviewed_classes: batch.classes, mastery_cutoff: masteryCutoff,
      });
      if (error) throw new Error(error.message);
      setBatch(null);
      setNotice(`${data} reports published across the reviewed classes.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish the class batch.");
    } finally {
      setBusy(false);
    }
  }

  const candidates = new Map<string, Map<string, string>>();
  for (const learner of sheet?.learners ?? []) {
    for (const assessment of learner.assessments) {
      if (sheet?.reserved.includes(assessment.id)) continue;
      const subjectAssessments = candidates.get(assessment.subject_id) ?? new Map<string, string>();
      subjectAssessments.set(assessment.id, assessment.title);
      candidates.set(assessment.subject_id, subjectAssessments);
    }
  }

  const validCutoff = Number.isInteger(masteryCutoff) && masteryCutoff >= 1 && masteryCutoff <= 99;
  const ready = Boolean(sheet?.learners.length) && sheet?.learners.every((learner) =>
    learner.subjects?.length && learner.subjects.every((id) => {
      const cell = subjectCell(learner, id, selected[id], candidates.has(id));
      return cell === "Excused" || cell.includes(" / ");
    }),
  );

  return (
    <details className="rounded-2xl border border-emerald-900/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold text-emerald-950">Class broadsheet preview</summary>
      <form onSubmit={preview} onChange={() => { setSheet(null); setError(""); }} className="mt-4 space-y-3">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">Class
            <select name="class" className={field} required>
              <option value="">Select class</option>
              {classes.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Academic session
            <input name="session" className={field} required placeholder="2026/2027" pattern="[0-9]{4}/[0-9]{4}" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Term
            <select name="term" className={field}>
              {["First Term", "Second Term", "Third Term"].map((term) => <option key={term}>{term}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Reporting period
            <select name="kind" className={field}>
              <option value="midterm">Mid-Term</option>
              <option value="term">Terminal</option>
            </select>
          </label>
        </fieldset>
        <button disabled={busy} className={button}>{busy ? "Loading…" : "Preview class broadsheet"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
      {sheet && (
        <section className="mt-4 space-y-3 border-t pt-4">
          <p className="text-sm">Save the published assessment for each subject in this reporting period.</p>
          <p className="text-sm" role="status">{sheet.learners.filter(({ subjects }) => !subjects).length} of {sheet.learners.length} learners need subject enrolment.</p>
          {sheet.subjects.length === 0 && <p className="text-sm">There are no teaching assignments for this class.</p>}
          {sheet.learners.length > 0 && sheet.subjects.length > 0 && (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Class marks">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Class broadsheet by learner and subject</caption>
                <thead>
                  <tr className="bg-emerald-50">
                    <th scope="col" className="p-3">Learner</th>
                    {sheet.subjects.map(({ id, name }) => (
                      <th key={id} scope="col" className="min-w-44 p-3">
                        <label className="grid gap-2">
                          {name}
                          <select className={field} value={selected[id] ?? ""} disabled={busy || (!candidates.has(id) && !selected[id])}
                            onChange={(event) => setSelected({ ...selected, [id]: event.target.value })}>
                            <option value="">{candidates.has(id) ? "Choose assessment" : "No published assessment"}</option>
                            {selected[id] && !candidates.get(id)?.has(selected[id]) && <option value={selected[id]}>Saved assessment unavailable</option>}
                            {[...(candidates.get(id) ?? [])].map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                          </select>
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.learners.map((learner) => (
                    <tr key={learner.id} className="border-b">
                      <th scope="row" className="p-3 font-semibold">{learner.name}</th>
                      {sheet.subjects.map(({ id }) => <td key={id} className="p-3">{subjectCell(learner, id, selected[id], candidates.has(id))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <label className="grid max-w-xs gap-1 text-sm font-semibold">Progressing starts at (%)
            <input type="number" className={field} min={1} max={99} value={masteryCutoff}
              onChange={(event) => setMasteryCutoff(Number(event.target.value))} disabled={busy} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || saved} onClick={() => void update("save")}>Save selections</button>
            <button type="button" className={button} disabled={busy || !saved || !ready || !validCutoff} onClick={() => void update("publish")}>Approve and publish class reports</button>
            <button type="button" className={button} disabled={busy || !saved || !ready} onClick={addToBatch}>Add reviewed class to batch</button>
            <button type="button" className={button} disabled={busy} onClick={() => void update("download")}>Download published class PDF</button>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Reason for withdrawing class reports
            <input className={field} value={reason} maxLength={500} disabled={busy} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => void update("withdraw")}
            className="rounded-lg border border-red-800 px-4 py-2 font-semibold text-red-800 disabled:opacity-60">Withdraw class reports</button>
        </section>
      )}
      {batch && (
        <section className="mt-4 space-y-3 border-t pt-4">
          <h3 className="font-semibold">Class release batch</h3>
          <p className="text-sm">{batch.period.school_session} · {batch.period.school_term} · {batch.period.report_kind === "midterm" ? "Mid-Term" : "Terminal"} · Progressing from {masteryCutoff}%</p>
          <ul className="space-y-1 text-sm">
            {Object.keys(batch.classes).map((id) => <li key={id}>{classes.find((item) => item.id === id)?.name ?? id}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || !validCutoff} onClick={() => void publishBatch()}>Approve and publish reviewed classes</button>
            <button type="button" className="rounded-lg border px-4 py-2" disabled={busy} onClick={() => setBatch(null)}>Clear batch</button>
          </div>
        </section>
      )}
    </details>
  );
}
