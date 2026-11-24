"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Plan = { learner_id: string; learner_name: string; priority: string; progress: string; action: string };

export function LearningImprovementPlan({ viewer }: { viewer: "parent" | "learner" }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getBrowserSupabaseClient().rpc("get_my_learning_improvement_plans");
        if (error) throw error;
        if (active) {
          setPlans(data as unknown as Plan[]);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section aria-labelledby="improvement-plan-heading" className="space-y-4 rounded-3xl border border-emerald-200 bg-white p-5 sm:p-6">
      <h2 id="improvement-plan-heading" className="text-xl font-bold text-emerald-950">Improvement plan</h2>
      {status === "loading" && <p role="status">Loading improvement plan…</p>}
      {status === "error" && <p role="alert">Could not load the improvement plan. Refresh to try again.</p>}
      {status === "ready" && plans.length === 0 && <p className="text-slate-600">The school has yet to publish an improvement plan.</p>}
      {plans.map(plan => (
        <article key={plan.learner_id} className="space-y-3 rounded-2xl bg-emerald-50 p-4">
          {viewer === "parent" && <h3 className="font-bold">{plan.learner_name}</h3>}
          <dl className="space-y-3 break-words">
            {plan.progress && <div><dt className="font-semibold">What improved</dt><dd className="whitespace-pre-wrap">{plan.progress}</dd></div>}
            <div><dt className="font-semibold">Current priority</dt><dd className="whitespace-pre-wrap">{plan.priority}</dd></div>
            <div><dt className="font-semibold">{viewer === "parent" ? "How to help at home" : "What to practise next"}</dt><dd className="whitespace-pre-wrap">{plan.action}</dd></div>
          </dl>
        </article>
      ))}
    </section>
  );
}
