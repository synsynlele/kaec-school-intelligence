"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type DocumentRow = {
  id: string;
  filename: string;
  subject: string;
  education_level: string;
  class_scope: string[];
  extraction_status: string;
  metadata?: Record<string, unknown>;
  entries: number;
  pending: number;
  promoted: number;
};

type ConsoleData = { documents?: DocumentRow[] };
type Progress = { current: number; total: number; label: string; rows: number };

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    rows?: number;
  };
  if (!response.ok) throw new Error(payload.error || "Scheme repair failed.");
  return payload;
}

export function SchemeSourceRepairClient() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();
    void (async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const { data: access, error: accessError } = await supabase.rpc(
        "get_scheme_review_access",
      );
      if (accessError) throw accessError;
      if (!access) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile.default_workspace_id) {
        throw new Error("Choose a school workspace first.");
      }

      const nextWorkspaceId = profile.default_workspace_id as string;
      const { data, error: consoleError } = await supabase.rpc(
        "get_scheme_review_console",
        { target_workspace_id: nextWorkspaceId },
      );
      if (consoleError) throw consoleError;
      if (cancelled) return;

      const nextDocuments = ((data ?? {}) as ConsoleData).documents ?? [];
      setAllowed(true);
      setWorkspaceId(nextWorkspaceId);
      setDocuments(nextDocuments);
      setDocumentId(
        nextDocuments.find(
          (item) => item.metadata?.stage12_review_required !== true,
        )?.id ?? nextDocuments[0]?.id ?? "",
      );
    })()
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Scheme repair console could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const document = useMemo(
    () => documents.find((item) => item.id === documentId) ?? null,
    [documents, documentId],
  );
  const quarantined = document?.metadata?.stage12_review_required === true;

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
    setNotice(null);
  }

  async function repairClass(
    classLevel: string,
    index: number,
    total: number,
  ) {
    if (!document || !file || !workspaceId) return 0;
    const supabase = getBrowserSupabaseClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error("Your session has expired. Sign in again.");
    }

    setProgress({ current: index, total, label: classLevel, rows: 0 });
    const body = new FormData();
    body.set("workspaceId", workspaceId);
    body.set("documentId", document.id);
    body.set("classLevel", classLevel);
    body.set("source", file);

    const response = await fetch("/api/curriculum/scheme-repair", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
    });
    const payload = await responseMessage(response);
    return typeof payload.rows === "number" ? payload.rows : 0;
  }

  async function repairDocument() {
    if (!document || !file) return;
    if (quarantined) {
      setError(
        "This mixed source is quarantined and cannot be automatically repaired.",
      );
      return;
    }
    if (file.name.trim().toLowerCase() !== document.filename.trim().toLowerCase()) {
      setError(`Choose the exact registered file: ${document.filename}`);
      return;
    }

    const classes = document.class_scope;
    setBusy(true);
    setError(null);
    setNotice(null);
    let repairedRows = 0;

    try {
      for (let index = 0; index < classes.length; index += 1) {
        const classLevel = classes[index];
        const rows = await repairClass(
          classLevel,
          index + 1,
          classes.length,
        );
        repairedRows += rows;
        setProgress({
          current: index + 1,
          total: classes.length,
          label: classLevel,
          rows: repairedRows,
        });
      }
      setNotice(
        `${document.subject} source repair completed: ${repairedRows} structured rows returned to Pending review. Nothing was auto-approved or promoted.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Source repair stopped. Completed classes remain Pending review; nothing was promoted.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !allowed) return null;

  return (
    <section className="mx-auto mt-8 max-w-7xl px-5 sm:px-8">
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
          KAEC curriculum admin · Source repair
        </p>
        <h2 className="mt-2 text-2xl font-bold text-amber-950">
          Recover the full scheme from the original PDF
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-900">
          Use this only when a registered source has incomplete extraction. KSI reads the original PDF once per class, recovers all terms for that class, and returns every recovered row to Pending human review. This never approves or promotes curriculum.
        </p>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900">
            {notice}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-amber-900">
              Registered source
            </span>
            <select
              value={documentId}
              disabled={busy}
              onChange={(event) => {
                setDocumentId(event.target.value);
                setFile(null);
                setError(null);
                setNotice(null);
                setProgress(null);
              }}
              className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-3 text-sm font-semibold text-zinc-800"
            >
              {documents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subject} · {item.filename}
                  {item.metadata?.stage12_review_required === true
                    ? " · QUARANTINED"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-amber-900">
              Original PDF
            </span>
            <input
              type="file"
              accept="application/pdf"
              disabled={busy || quarantined}
              onChange={chooseFile}
              className="block w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-950 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
            />
          </label>

          <button
            type="button"
            disabled={!file || busy || quarantined}
            onClick={() => void repairDocument()}
            className="rounded-xl bg-amber-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Repairing…" : "Repair entire source"}
          </button>
        </div>

        {document ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-amber-900">
            <span className="rounded-full bg-white px-3 py-1.5 font-bold">
              {document.class_scope.join(" · ")}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5">
              {document.class_scope.length} extraction passes
            </span>
            <span className="rounded-full bg-white px-3 py-1.5">
              Current rows: {document.entries}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5">
              Pending: {document.pending}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5">
              Promoted: {document.promoted}
            </span>
          </div>
        ) : null}

        {quarantined ? (
          <p className="mt-4 text-sm font-bold text-red-800">
            This source remains quarantined because the registered PDF contains mixed/misbundled subject content. It must be resolved manually before any extraction repair.
          </p>
        ) : null}

        {progress ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-amber-950">
              <span>{progress.label}</span>
              <span>
                {progress.current}/{progress.total} · {progress.rows} rows recovered
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-200">
              <div
                className="h-full bg-amber-950 transition-all"
                style={{
                  width: `${Math.round((progress.current / progress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
