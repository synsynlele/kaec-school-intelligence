"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SavedWorkType = "lesson" | "assessment";
type SavedWorkAction = "archive" | "restore" | "delete";

type SavedWorkItem = {
  artifactType: SavedWorkType;
  artifactId: string;
  title: string;
  status: string;
  detail: string;
  updatedAt: string;
  dependencyCount: number;
  canManage: boolean;
  canPermanentlyDelete: boolean;
};

type SavedWorkPayload = {
  workspace: { id: string; name: string };
  active: SavedWorkItem[];
  archived: SavedWorkItem[];
};

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function SavedWorkClient() {
  const [data, setData] = useState<SavedWorkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const [typeFilter, setTypeFilter] = useState<"all" | SavedWorkType>("all");

  const authenticatedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const supabase = getBrowserSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error("Your session has expired. Sign in again.");
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : "The saved-work request failed.",
      );
    }
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await authenticatedFetch("/api/saved-work");
      setData(payload as unknown as SavedWorkPayload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Saved work could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const source = view === "active" ? data?.active ?? [] : data?.archived ?? [];
    if (typeFilter === "all") return source;
    return source.filter((item) => item.artifactType === typeFilter);
  }, [data, typeFilter, view]);

  async function manage(item: SavedWorkItem, action: SavedWorkAction) {
    if (!item.canManage) return;

    if (action === "archive") {
      const confirmed = window.confirm(
        `Archive “${item.title}”? You can restore it later from Archived.`,
      );
      if (!confirmed) return;
    }

    let confirmation: string | undefined;
    if (action === "delete") {
      if (!item.canPermanentlyDelete) return;
      confirmation = window.prompt(
        `Permanent deletion cannot be undone. Type DELETE to permanently remove “${item.title}”.`,
      ) ?? undefined;
      if (confirmation !== "DELETE") return;
    }

    const key = `${item.artifactType}:${item.artifactId}:${action}`;
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await authenticatedFetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType: item.artifactType,
          artifactId: item.artifactId,
          action,
          confirmation,
        }),
      });
      setNotice(
        action === "archive"
          ? `${item.title} was archived.`
          : action === "restore"
            ? `${item.title} was restored.`
            : `${item.title} was permanently deleted.`,
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The saved-work action could not be completed.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-6">
        <p className="text-sm font-medium text-zinc-500">Loading saved work…</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Saved Work
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Keep your teaching workspace clean without breaking the intelligence chain
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Archive hides work from normal lesson and assessment lists. Restore brings it back. Permanent delete is available only from Archive and only when no downstream record depends on it.
          </p>
        </div>
        {data ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="font-medium text-zinc-900">{data.workspace.name}</p>
            <p className="mt-1 text-xs text-zinc-500">Active workspace</p>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {notice}
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              view === "active"
                ? "bg-emerald-950 text-white"
                : "text-zinc-600 hover:bg-stone-50"
            }`}
          >
            Active ({data?.active.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setView("archived")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              view === "archived"
                ? "bg-emerald-950 text-white"
                : "text-zinc-600 hover:bg-stone-50"
            }`}
          >
            Archived ({data?.archived.length ?? 0})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "lesson", "assessment"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTypeFilter(filter)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                typeFilter === filter
                  ? "border-emerald-800 bg-emerald-50 text-emerald-950"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {filter === "all"
                ? "All"
                : filter === "lesson"
                  ? "HQLS Lessons"
                  : "Assessments"}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => {
            const archiveKey = `${item.artifactType}:${item.artifactId}:archive`;
            const restoreKey = `${item.artifactType}:${item.artifactId}:restore`;
            const deleteKey = `${item.artifactType}:${item.artifactId}:delete`;
            const dependencyLabel =
              item.artifactType === "lesson"
                ? `${item.dependencyCount} linked assessment${item.dependencyCount === 1 ? "" : "s"}`
                : `${item.dependencyCount} linked evidence/diagnosis record${item.dependencyCount === 1 ? "" : "s"}`;

            return (
              <article
                key={`${item.artifactType}:${item.artifactId}`}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        {item.artifactType === "lesson" ? "HQLS Lesson" : "Assessment"}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-800">
                        {item.status}
                      </span>
                    </div>
                    <h2 className="mt-2 truncate text-base font-semibold text-zinc-950">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm capitalize text-zinc-500">
                      {titleCase(item.detail)} · Updated {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                    {view === "archived" && item.dependencyCount > 0 ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Permanent delete blocked: {dependencyLabel} still depend on this item.
                      </p>
                    ) : null}
                    {!item.canManage ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        Only the creator or a workspace owner/admin can manage this item.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {view === "active" ? (
                      <button
                        type="button"
                        disabled={!item.canManage || busyKey !== null}
                        onClick={() => void manage(item, "archive")}
                        className="min-h-10 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyKey === archiveKey ? "Archiving…" : "Archive"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={!item.canManage || busyKey !== null}
                          onClick={() => void manage(item, "restore")}
                          className="min-h-10 rounded-xl bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busyKey === restoreKey ? "Restoring…" : "Restore"}
                        </button>
                        <button
                          type="button"
                          disabled={
                            !item.canPermanentlyDelete || busyKey !== null
                          }
                          onClick={() => void manage(item, "delete")}
                          className="min-h-10 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {busyKey === deleteKey
                            ? "Deleting…"
                            : "Permanent Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            {view === "active"
              ? "No active saved work matches this filter."
              : "Your Archived area is empty."}
          </div>
        )}
      </section>
    </main>
  );
}
