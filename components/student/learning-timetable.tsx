"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Entry = { id: string; kind: "lesson" | "assessment"; subject: string; title?: string; venue?: string;
  weekday?: number; start?: string; end?: string; startsAt?: string; endsAt?: string; status: string };
const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const time = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const date = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric" });

function schedule(entry: Entry) {
  if (entry.kind === "lesson") return `${days[entry.weekday ?? 0]} · ${entry.start}–${entry.end} WAT`;
  const start = new Date(entry.startsAt ?? "");
  const end = new Date(entry.endsAt ?? "");
  return `${date.format(start)} · ${time.format(start)}–${time.format(end)} WAT`;
}

export function LearningTimetable() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setMessage("");
    setEntries(null);
    try {
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session) throw new Error("Sign in to see your timetable.");
      const response = await fetch("/api/learning/timetable", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEntries(result.entries);
      setMessage(result.message ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your timetable is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 print:border-0" id="my-timetable">
    <style>{`@media print {
      body:has(#my-timetable) * { visibility: hidden; }
      body:has(#my-timetable) #my-timetable, body:has(#my-timetable) #my-timetable * { visibility: visible; }
      body:has(#my-timetable) #my-timetable { break-inside: auto; }
      body:has(#my-timetable) main:has(> #my-timetable) > :not(#my-timetable) { display: none; }
    }`}</style>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-bold">My Timetable</h2>
      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" disabled={busy} onClick={() => void load()} className="font-semibold text-emerald-900 underline disabled:opacity-50">
          {busy ? "Loading timetable…" : entries ? "Refresh timetable" : "Show timetable"}
        </button>
        {!!entries?.length && <button type="button" onClick={() => window.print()} className="font-semibold text-emerald-900 underline">Print or save as PDF</button>}
      </div>
    </div>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    {entries && !entries.length && !message && <p className="text-sm text-slate-700">No timetable entries have been published for your subjects yet.</p>}
    {!!entries?.length && ([["lesson", "Weekly lessons"], ["assessment", "Tests & exams"]] as const).map(([kind, label]) => {
      const rows = entries.filter(entry => entry.kind === kind);
      return <div key={kind}>
        <h3 className="font-bold">{label}</h3>
        {rows.length ? <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {rows.map(entry => <li key={entry.id} className="break-words p-3">
            <p className="font-semibold">{entry.subject}{entry.title && ` · ${entry.title}`}</p>
            <p className="text-sm text-slate-700">{schedule(entry)}{entry.venue && ` · ${entry.venue}`}</p>
            {entry.status !== "Published" && <p className="text-sm font-bold text-amber-900">{entry.status}</p>}
          </li>)}
        </ul> : <p className="text-sm text-slate-700">Nothing published yet.</p>}
      </div>;
    })}
  </section>;
}
