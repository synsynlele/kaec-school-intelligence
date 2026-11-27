"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Fee = { id: string; name: string; total: number; paid: number; outstanding: number };
const currency = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 });
const money = (kobo: number) => currency.format(kobo / 100);

export function ParentFeeSummary() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session || controller.signal.aborted) return;
      const response = await fetch("/api/learning/parent-fees", {
        headers: { Authorization: "Bearer " + session.access_token }, signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { fees: Fee[] };
      setFees(data.fees);
    }
    void load().catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
    return () => controller.abort();
  }, []);

  if (!unavailable && !fees.length) return null;
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="parent-fees-heading">
    <h2 id="parent-fees-heading" className="text-lg font-semibold">School fees</h2>
    {unavailable && <p role="status">Fees are temporarily unavailable.</p>}
    {fees.map(fee => <div key={fee.id} className="space-y-1 border-t border-slate-200 pt-3">
      <h3 className="break-words font-medium">{fee.name}</h3>
      <p>{money(fee.paid)} paid of {money(fee.total)}</p>
      <p className="font-semibold">{money(fee.outstanding)} outstanding</p>
    </div>)}
  </section>;
}
