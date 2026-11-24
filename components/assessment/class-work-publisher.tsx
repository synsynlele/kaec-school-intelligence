"use client";

import { useEffect, useState } from "react";
import { FiSend } from "react-icons/fi";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Publication = { due_on: string | null; published_at: string; class_id: string };

export function ClassWorkPublisher({ assessmentId, className, classId, kind, eligible }: {
  assessmentId: string; className: string; classId: string | null; kind: "assignment" | "project"; eligible: boolean;
}) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getBrowserSupabaseClient().rpc("manage_learning_class_work", { source_id: assessmentId, operation: "read" })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        const saved = data as Publication | null;
        setPublication(saved);
        setDeadline(saved?.due_on ?? "");
        setBusy(false);
      });
    return () => { active = false; };
  }, [assessmentId]);

  async function update(operation: "publish" | "withdraw") {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("manage_learning_class_work", {
        source_id: assessmentId, operation, ...(deadline && operation === "publish" ? { deadline } : {}),
      });
      if (error) throw error;
      setPublication(data as Publication | null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update learner access. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-bold text-indigo-950"><FiSend aria-hidden="true" /> Send {kind} to learners</h2>
      <p className="text-sm text-slate-700">{eligible
        ? `Share the learner instructions and tasks with ${className}.`
        : "Link an active class and validate this work before publishing."}</p>
      {publication && <p role="status" className="text-sm font-semibold text-emerald-900">
        {publication.class_id === classId ? "Published to the learner portal." : "The class has changed. Publish again to share this work with the current class."}
      </p>}
      {error && <p role="alert" className="text-sm text-red-900">{error}</p>}
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        if (window.confirm(`Publish this ${kind} to ${className}?`)) void update("publish");
      }}>
        <label className="grid gap-1 text-sm font-medium">Due date (optional)
          <input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} disabled={!eligible || busy}
            className="rounded-lg border border-indigo-200 bg-white p-2" />
        </label>
        <button disabled={!eligible || busy} className="min-h-11 rounded-xl bg-indigo-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {publication ? "Update published work" : `Publish ${kind}`}
        </button>
        {publication && <button type="button" disabled={busy} onClick={() => {
          if (window.confirm("Withdraw this work from the learner portal?")) void update("withdraw");
        }} className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-800 disabled:opacity-50">Withdraw</button>}
      </form>
    </section>
  );
}
