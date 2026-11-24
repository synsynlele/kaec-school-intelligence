"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SubjectGradebookScope } from "@/lib/supabase/database";

const fields = [
  ["progress", "What improved (optional)", 500],
  ["priority", "Current priority", 200],
  ["learner_action", "What the learner should practise next", 500],
  ["parent_action", "How the parent can help at home", 500],
] as const;
const emptyPlan = { progress: "", priority: "", learner_action: "", parent_action: "" };
type Plan = typeof emptyPlan & { withdrawn?: boolean };

export function ImprovementPlanEditor({ scope, learners }: {
  scope: SubjectGradebookScope;
  learners: { id: string; name: string }[];
}) {
  const [learner, setLearner] = useState("");
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [published, setPublished] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function update(operation: "read" | "publish" | "withdraw", id = learner) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error } = await getBrowserSupabaseClient().rpc("manage_learning_improvement_plan", {
        school_id: scope.school_id, target_class: scope.target_class, school_session: scope.school_session,
        target_learner: id, operation, ...(operation === "publish" ? { plan } : {}),
      });
      if (error) throw error;
      const saved = data as Plan | null;
      setPlan(saved ?? emptyPlan);
      setPublished(Boolean(saved && !saved.withdrawn));
      setLoaded(true);
      if (operation === "publish") setMessage("Improvement plan published to both portals.");
      if (operation === "withdraw") setMessage("Improvement plan withdrawn from both portals.");
    } catch {
      setError("Could not update the improvement plan. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="space-y-3 rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-semibold text-emerald-900">Publish learner improvement plans</summary>
      <label className="grid max-w-md gap-1">Learner
        <select className="rounded-lg border p-2" value={learner} disabled={busy} onChange={event => {
          const id = event.target.value;
          setLearner(id);
          setLoaded(false);
          setMessage("");
          setError("");
          if (id) void update("read", id);
        }}>
          <option value="">Choose learner</option>
          {learners.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {message && <p role="status">{message}</p>}
      {busy && !loaded && <p role="status">Loading improvement plan…</p>}
      {learner && !loaded && error && <button type="button" className="underline" onClick={() => void update("read")}>Retry loading</button>}
      {loaded && <form className="grid gap-3" onSubmit={event => {
        event.preventDefault();
        if (window.confirm("Publish this plan to the learner and linked parents?")) void update("publish");
      }}>
        <p className="text-sm text-slate-600">Each learner has one current plan. Publishing replaces their previous plan.</p>
        {fields.map(([key, label, limit]) => <label key={key} className="grid gap-1 font-medium">{label}
          <textarea className="rounded-lg border p-2 font-normal" rows={2} value={plan[key]} maxLength={limit}
            required={key !== "progress"} disabled={busy} onChange={event => setPlan({ ...plan, [key]: event.target.value })} />
        </label>)}
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy || !plan.priority.trim() || !plan.learner_action.trim() || !plan.parent_action.trim()}>Publish plan</button>
          {published && <button type="button" className="rounded-lg border px-4 py-2 font-semibold text-red-800" disabled={busy} onClick={() => {
            if (window.confirm("Withdraw this plan from both portals?")) void update("withdraw");
          }}>Withdraw plan</button>}
        </div>
      </form>}
    </details>
  );
}
