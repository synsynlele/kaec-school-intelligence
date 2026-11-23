"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };

export function ManualProjectForm({ schoolId, classes, subjects }: {
  schoolId: string;
  classes: Option[];
  subjects: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = "w-full rounded-xl border border-zinc-300 bg-white p-2.5 font-normal";

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { data, error: cause } = await getBrowserSupabaseClient().rpc("create_learning_project", {
        school_id: schoolId,
        target_class: String(form.get("class")),
        target_subject: String(form.get("subject")),
        project_title: String(form.get("title")),
        academic_session: String(form.get("session")).trim(),
        school_term: String(form.get("term")),
        maximum: Number(form.get("maximum")),
      });
      if (cause || !data) throw new Error(cause?.message ?? "The project could not be saved.");
      router.push(`/assessment/score-sheet?assessment=${encodeURIComponent(data)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The project could not be saved.");
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl border border-emerald-900/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold text-emerald-950">Add a real-life project</summary>
      <form onSubmit={createProject} className="mt-4 space-y-4">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Project title
            <input name="title" className={field} required maxLength={160} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Class
            <select name="class" className={field} defaultValue="" required>
              <option value="" disabled>Select class</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Subject
            <select name="subject" className={field} defaultValue="" required>
              <option value="" disabled>Select subject</option>
              {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Academic session
            <input name="session" placeholder="2026/2027" pattern="[0-9]{4}/[0-9]{4}" maxLength={9} className={field} required />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Term
            <select name="term" className={field} defaultValue="" required>
              <option value="" disabled>Select term</option>
              {["First Term", "Second Term", "Third Term"].map((term) => <option key={term}>{term}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Maximum mark
            <input name="maximum" type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" className={field} required />
          </label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <button className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>
          {busy ? "Creating project…" : "Create project and enter marks"}
        </button>
      </form>
    </details>
  );
}
