"use client";

import { useEffect, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function HqlsDownloadButton({ lessonId }: { lessonId: string }) {
  const [validated, setValidated] = useState<boolean | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabaseClient();
    void supabase
      .from("lessons")
      .select("status")
      .eq("id", lessonId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(loadError.message);
          setValidated(false);
          return;
        }
        setValidated(data?.status === "validated");
      });
    return () => {
      active = false;
    };
  }, [lessonId]);

  async function downloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Your session has expired. Sign in again.");

      const response = await fetch("/api/hqls/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lessonId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "The HQLS lesson PDF could not be prepared.",
        );
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = match?.[1] || "hqls-lesson.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The HQLS PDF could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={validated !== true || downloading}
        onClick={() => void downloadPdf()}
        className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {downloading ? "Preparing PDF…" : "Download Lesson PDF"}
      </button>
      {validated === false ? (
        <span className="text-[11px] text-zinc-500">Available after HQLS validation.</span>
      ) : null}
      {error ? <span className="max-w-xs text-[11px] text-red-700">{error}</span> : null}
    </div>
  );
}
