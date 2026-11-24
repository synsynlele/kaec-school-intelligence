"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LearningSubjectEnrolment } from "@/components/assessment/learning-subject-enrolment";
import { resultSections } from "@/lib/learning/result-report";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SubjectGradebookScope } from "@/lib/supabase/database";

type Marks = Partial<Record<(typeof resultSections)[number][0], number | null>>;
type Scores = { maxima: Marks; marks: Record<string, Marks> };
type Subject = { id: string; name: string; sheet: Scores | null };
type Learner = { id: string; name: string; subjects: string[] | null };
type Roster = { can_publish: boolean; subjects: Subject[]; learners: Learner[] };
type Class = { id: string; name: string; academic_session: string | null };

const field = "rounded-lg border border-zinc-300 bg-white px-3 py-2";
const button = "rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-50";
const enrolled = (learner: Learner, subject: Subject) => learner.subjects?.includes(subject.id) === true;
function result(learner: Learner, subject: Subject) {
  if (!learner.subjects) return "Enrolment needed";
  if (!enrolled(learner, subject)) return "Not enrolled";
  if (!subject.sheet) return "Missing";
  const { maxima, marks } = subject.sheet;
  const scores = marks[learner.id];
  if (resultSections.some(([key]) => (maxima[key] ?? 0) > 0 && scores?.[key] == null)) return "Missing";
  return resultSections.reduce((total, [key]) => total + (scores?.[key] ?? 0), 0);
}

export function SubjectGradebook() {
  const router = useRouter();
  const [school, setSchool] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [scope, setScope] = useState<SubjectGradebookScope | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [scores, setScores] = useState<Scores>({ maxima: {}, marks: {} });
  const [resumptionDate, setResumptionDate] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const client = getBrowserSupabaseClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) { router.replace("/sign-in"); return; }
      const { data: profile } = await client.from("profiles").select("default_workspace_id").eq("id", user.id).single();
      if (!profile?.default_workspace_id) throw new Error("Choose your school workspace first.");
      const id = profile.default_workspace_id;
      const { data, error } = await client.from("classes").select("id,name,academic_session").eq("workspace_id", id).order("name");
      if (error) throw new Error(error.message);
      setSchool(id);
      setClasses(data ?? []);
    }
    void load().catch((error: Error) => setFeedback({ error: true, text: error.message }));
  }, [router]);

  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setFeedback(null);
    try { await task(); }
    catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "The action failed." }); }
    finally { setBusy(false); }
  }

  async function open(next: SubjectGradebookScope) {
    const { data, error } = await getBrowserSupabaseClient().rpc("get_learning_subject_gradebook", next);
    if (error) throw new Error(error.message);
    const loaded = data as unknown as Roster;
    setRoster(loaded);
    setScope(next);
    return loaded;
  }

  function select(item: Subject | null) {
    setSubject(item);
    setScores(item?.sheet ?? { maxima: {}, marks: {} });
    setDirty(false);
  }

  function loadClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty && !window.confirm("Discard unsaved marks?")) return;
    const form = new FormData(event.currentTarget);
    const selected = classes.find(({ id }) => id === form.get("class"));
    if (!selected?.academic_session) {
      setFeedback({ error: true, text: "Set the academic session for this class in Academic Setup first." });
      return;
    }
    void perform(async () => {
      await open({ school_id: school, target_class: selected.id, school_session: selected.academic_session!,
        school_term: String(form.get("term")), report_period: String(form.get("period")) });
      setResumptionDate("");
      select(null);
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scope || !subject || !roster) return;
    const marks = Object.fromEntries(roster.learners.filter(item => enrolled(item, subject) && scores.marks[item.id])
      .map(item => [item.id, scores.marks[item.id]]));
    void perform(async () => {
      const { error } = await getBrowserSupabaseClient().rpc("save_learning_subject_gradebook", {
        ...scope, target_subject: subject.id, new_sheet: { maxima: scores.maxima, marks }, previous_sheet: subject.sheet,
      });
      if (error) throw new Error(error.message);
      const updated = await open(scope);
      select(updated.subjects.find(({ id }) => id === subject.id) ?? null);
      setFeedback({ error: false, text: "Subject marks saved." });
    });
  }

  function publish() {
    if (!scope || !roster || !window.confirm("Approve and publish the whole class for this period? Previously published reports for these learners will be replaced.")) return;
    void perform(async () => {
      const { data, error } = await getBrowserSupabaseClient().rpc("approve_learning_subject_gradebook_with_resumption", { ...scope, next_resumption_date: resumptionDate || null, reviewed_sheet: { ...roster, subjects: roster.subjects.map(item => ({ ...item })), learners: roster.learners.map(item => ({ ...item })) } });
      if (error) throw new Error(error.message);
      setFeedback({ error: false, text: `${data} class reports published.` });
    });
  }

  function withdraw() {
    if (!scope || !roster?.can_publish) return;
    const reason = window.prompt("Unpublish this class report from both portals? Enter the reason for withdrawal.")?.trim();
    if (!reason) return;
    void perform(async () => {
      const { report_period, ...period } = scope;
      const { data, error } = await getBrowserSupabaseClient().rpc("withdraw_learning_class_reports", {
        ...period, report_kind: report_period, reason,
      });
      if (error) throw new Error(error.message);
      setFeedback({ error: false, text: data ? `${data} reports unpublished from both portals.` : "No published reports to withdraw for this class and period." });
    });
  }

  function download() {
    if (!scope) return;
    void perform(async () => {
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session) throw new Error("Sign in again to download reports.");
      const query = new URLSearchParams({ ...scope, report_kind: scope.report_period });
      const response = await fetch(`/api/learning/term-report?${query}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error("No published class report is available.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "ksi-class-results.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  const ready = Boolean(roster?.learners.length) && roster?.learners.every(learner =>
    roster.subjects.some(item => enrolled(learner, item)) && roster.subjects.every(item => result(learner, item) !== "Missing"));

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
      <nav className="flex gap-4 text-sm font-semibold text-emerald-900"><Link href="/assessment">Assess</Link><Link href="/assessment/cbt">Manage CBT</Link><Link href="/setup/teaching-map">Class subjects and enrolment</Link></nav>
      <h1 className="text-3xl font-bold">Class scores and results</h1>
      <form onSubmit={loadClass} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Class<select name="class" required className={field}><option value="">Choose a class</option>{classes.map(item =>
          <option key={item.id} value={item.id}>{item.name}{item.academic_session ? ` · ${item.academic_session}` : ""}</option>)}</select></label>
        <label className="grid gap-1">Term<select name="term" className={field}>{["First Term", "Second Term", "Third Term"].map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-1">Period<select name="period" className={field}><option value="midterm">Mid-Term</option><option value="term">Terminal</option></select></label>
        <button className={button} disabled={!school || busy}>Open class</button>
      </form>
      {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      {roster && scope && <>
        <h2 className="text-xl font-semibold">{classes.find(({ id }) => id === scope.target_class)?.name} · {scope.school_term} · {scope.report_period === "midterm" ? "Mid-Term" : "Terminal"}</h2>
        {roster.can_publish && <>
          <Link href={`/setup/teaching-map?class=${encodeURIComponent(scope.target_class)}`} className="font-semibold text-emerald-900 underline">Assign subjects and teachers</Link>
          <LearningSubjectEnrolment key={scope.target_class} schoolId={school} classes={classes.filter(item => item.id === scope.target_class)} />
        </>}
        {!roster.subjects.length && <p>No teaching assignments are available for this class.</p>}
        <div className="flex flex-wrap gap-2">{roster.subjects.map(item => <button type="button" key={item.id}
          disabled={busy} aria-pressed={subject?.id === item.id} className={subject?.id === item.id ? button : field}
          onClick={() => { if (!dirty || window.confirm("Discard unsaved marks?")) select(item); }}>{item.name}</button>)}</div>
        {subject && <form onSubmit={save} className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">{subject.name} score sheet</h3>
          {!roster.learners.some(item => enrolled(item, subject)) && <p className="text-sm">No learners are enrolled in this subject. Set their subject enrolment first.</p>}
          <p className="text-sm">Set maxima that total 100. Use 0 for an unused component. Leave missing marks blank.</p>
          <fieldset disabled={busy} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <legend className="sr-only">Component maxima</legend>
            {resultSections.map(([key, label]) => <label className="grid gap-1 text-sm" key={key}>{label} maximum
              <input className={field} type="number" min={0} max={100} step="any" required value={scores.maxima[key] ?? ""}
                onChange={(e) => { setScores({ ...scores, maxima: { ...scores.maxima, [key]: e.target.value === "" ? null : e.target.valueAsNumber } }); setDirty(true); }} /></label>)}
          </fieldset>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr><th scope="col" className="p-2">Learner</th>{resultSections.map(([key,label]) => <th scope="col" className="p-2" key={key}>{label}</th>)}</tr></thead>
            <tbody>{roster.learners.filter(item => enrolled(item, subject)).map(learner => (
              <tr key={learner.id} className="border-t"><th scope="row" className="p-2">{learner.name}</th>
                {resultSections.map(([key,label]) => <td className="p-1" key={key}><input aria-label={`${learner.name} ${label}`} className={`${field} w-24`} type="number" min={0} max={scores.maxima[key] ?? 100} step="any"
                  disabled={busy} value={scores.marks[learner.id]?.[key] ?? ""} onChange={(e) => {
                    const value = e.target.value === "" ? null : e.target.valueAsNumber;
                    setScores(current => ({ ...current, marks: { ...current.marks, [learner.id]: { ...current.marks[learner.id], [key]: value } } }));
                    setDirty(true);
                  }} /></td>)}</tr>))}</tbody>
          </table></div>
          <button className={button} disabled={!dirty || busy}>Save subject marks</button>
        </form>}
        {roster.can_publish && <section className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">Review and publish class results</h3>
          {roster.learners.some(item => !item.subjects) && <p role="status" className="text-sm text-amber-900">Confirm subject enrolment for every learner before publishing. Only selected subjects appear on each report.</p>}
          <p className="text-sm">To correct a published report, save the revised subject marks and approve the class again.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr><th scope="col" className="p-2">Learner</th>{roster.subjects.map(item => <th scope="col" className="p-2" key={item.id}>{item.name}</th>)}</tr></thead>
            <tbody>{roster.learners.map(learner => <tr className="border-t" key={learner.id}><th scope="row" className="p-2">{learner.name}</th>
              {roster.subjects.map(item => <td className="p-2" key={item.id}>{result(learner, item)}</td>)}</tr>)}</tbody>
          </table></div>
          <label className="grid max-w-sm gap-1 text-sm font-semibold">
            Resumption date
            <input type="date" className={field} value={resumptionDate} disabled={busy}
              onChange={event => setResumptionDate(event.target.value)} />
            <span className="font-normal text-zinc-600">Applies to every report in this release. Leave blank to keep the previously published date, if any.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || dirty || !ready} onClick={publish}>Approve and publish whole class</button>
            <button type="button" className={field} disabled={busy} onClick={download}>Download published class PDF</button>
            <button type="button" className={`${field} font-semibold text-red-800`} disabled={busy} onClick={withdraw}>Unpublish class reports</button>
          </div>
        </section>}
      </>}
    </main>
  );
}
