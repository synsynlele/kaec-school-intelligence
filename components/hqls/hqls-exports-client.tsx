"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Lesson = {
  id: string;
  title: string;
  topic: string;
  status: "draft" | "validated" | "archived";
  updated_at: string;
};

type ExportState = {
  workspaceName: string;
  lessons: Lesson[];
};

export function HqlsExportsClient() {
  const router = useRouter();
  const [state, setState] = useState<ExportState | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile.default_workspace_id) {
        throw new Error("Choose an active workspace before exporting HQLS lessons.");
      }
      const [workspaceResult, lessonResult] = await Promise.all([
        supabase
          .from("workspaces")
          .select("name")
          .eq("id", profile.default_workspace_id)
          .single(),
        supabase
          .from("lessons")
          .select("id,title,topic,status,updated_at")
          .eq("workspace_id", profile.default_workspace_id)
          .order("updated_at", { ascending: false }),
      ]);
      const firstError = workspaceResult.error ?? lessonResult.error;
      if (firstError) throw firstError;
      if (!workspaceResult.data) throw new Error("The active workspace could not be loaded.");
      if (!cancelled) {
        setState({
          workspaceName: workspaceResult.data.name,
          lessons: (lessonResult.data ?? []) as Lesson[],
        });
      }
    };

    void load()
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Lesson exports could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function downloadPdf(lesson: Lesson) {
    setDownloading(lesson.id);
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
        body: JSON.stringify({ lessonId: lesson.id }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(
          typeof payload.error === "string" ? payload.error : "The lesson PDF could not be prepared.",
        );
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || "hqls-lesson.pdf";
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The lesson PDF could not be downloaded.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/hqls"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
            >
              Back to HQLS
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
          Teacher-ready exports
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Download HQLS lesson PDFs</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          PDFs are prepared from the final saved lesson, use the official KAEC-NG branding, and are available only when the lesson has a passing HQLS fidelity record.
        </p>

        {state ? (
          <p className="mt-5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            Active workspace: <span className="font-semibold text-zinc-900">{state.workspaceName}</span>
          </p>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-7 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
              Loading saved lessons…
            </div>
          ) : state?.lessons.length ? (
            state.lessons.map((lesson) => (
              <article
                key={lesson.id}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-zinc-950">{lesson.title}</h2>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${lesson.status === "validated" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {lesson.status === "validated" ? "HQLS Validated" : lesson.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">{lesson.topic}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Updated {new Date(lesson.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={lesson.status !== "validated" || downloading !== null}
                  onClick={() => void downloadPdf(lesson)}
                  className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {downloading === lesson.id ? "Preparing PDF…" : "Download PDF"}
                </button>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
              No saved HQLS lessons are available in this workspace yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
