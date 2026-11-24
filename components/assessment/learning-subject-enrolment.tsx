"use client";

import { useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };
type Roster = { subjects: Option[]; learners: (Option & { subjects: string[] | null })[] };
type Scope = { school_id: string; target_class: string; school_session: string };

const field = "w-full rounded-lg border border-zinc-300 bg-white p-2.5";
const button = "rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-60";

export function LearningSubjectEnrolment({ schoolId, classes }: { schoolId: string; classes: Option[] }) {
  const [scope, setScope] = useState<Scope | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [learners, setLearners] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function readRoster(nextScope: Scope) {
    const { data, error } = await getBrowserSupabaseClient().rpc("get_learning_subject_enrolments", nextScope);
    if (error) throw new Error(error.message);
    setRoster(data as unknown as Roster);
    setScope(nextScope);
    setLearners([]);
    setSubjects([]);
  }

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    setRoster(null);
    try {
      await readRoster({ school_id: schoolId, target_class: String(form.get("class")), school_session: String(form.get("session")) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the class roster.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scope || !learners.length || !subjects.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error } = await getBrowserSupabaseClient().rpc("save_learning_subject_enrolment", {
        ...scope, learner_ids: learners, selected_subject_ids: subjects,
      });
      if (error) throw new Error(error.message);
      setNotice(`Saved subject enrolment for ${learners.length} learner(s).`);
      setRoster(null);
      await readRoster(scope);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save subject enrolment.");
    } finally {
      setBusy(false);
    }
  }

  function toggleLearner(learner: Roster["learners"][number]) {
    const next = learners.includes(learner.id) ? learners.filter((id) => id !== learner.id) : [...learners, learner.id];
    setLearners(next);
    if (next.length === 1) {
      const enrolled = roster?.learners.find(({ id }) => id === next[0])?.subjects ?? [];
      setSubjects(enrolled.filter((id) => roster?.subjects.some((subject) => subject.id === id)));
    } else if (learners.length < 2 || !next.length) {
      setSubjects([]);
    }
  }

  return (
    <details className="rounded-2xl border border-emerald-900/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold text-emerald-950">Learner subject enrolment</summary>
      <form onSubmit={load} onChange={() => { setRoster(null); setError(""); setNotice(""); }} className="mt-4 space-y-3">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">Class
            <select name="class" className={field} required>
              <option value="">Select class</option>
              {classes.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Academic session
            <input name="session" className={field} required placeholder="2026/2027" pattern="[0-9]{4}/[0-9]{4}" />
          </label>
        </fieldset>
        <button className={button} disabled={busy}>Load class roster</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-800" role="alert">{error}</p>}
      {notice && <p className="mt-3 text-sm" role="status">{notice}</p>}
      {roster && (
        <form onSubmit={save} className="mt-4 space-y-3 border-t pt-4">
          <p className="text-sm">{roster.learners.filter((learner) => learner.subjects?.every((id) => roster.subjects.some((subject) => subject.id === id))).length} of {roster.learners.length} learners have current subject selections.</p>
          {!roster.learners.length && <p className="text-sm">There are no active learners in this class.</p>}
          {!roster.subjects.length && <p className="text-sm">Add teaching assignments for this class to make subjects available.</p>}
          {roster.learners.length > 0 && roster.subjects.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset disabled={busy} className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">Learners</legend>
                  {roster.learners.map((learner) => (
                    <label key={learner.id} className="flex min-h-10 items-center gap-2 text-sm">
                      <input type="checkbox" checked={learners.includes(learner.id)} onChange={() => toggleLearner(learner)} />
                      <span>{learner.name} · {learner.subjects ? `${learner.subjects.length} subjects recorded` : "Enrolment missing"}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset disabled={busy} className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">Subjects</legend>
                  {roster.subjects.map(({ id, name }) => (
                    <label key={id} className="flex min-h-10 items-center gap-2 text-sm">
                      <input type="checkbox" checked={subjects.includes(id)}
                        onChange={() => setSubjects(subjects.includes(id) ? subjects.filter((subject) => subject !== id) : [...subjects, id])} />
                      {name}
                    </label>
                  ))}
                </fieldset>
              </div>
              <p className="text-sm">Saving replaces the subject list for each selected learner. Select a group to apply the same subjects, or one learner to edit their electives.</p>
              <button className={button} disabled={busy || !learners.length || !subjects.length}>Save subjects for {learners.length} learner(s)</button>
            </>
          )}
        </form>
      )}
    </details>
  );
}
