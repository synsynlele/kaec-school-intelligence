"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SchemeDocument = {
  id: string;
  filename: string;
  subject: string;
  education_level: string;
  class_scope: string[];
  extraction_status: string;
  entries: number;
  pending: number;
  approved: number;
};

type Summary = {
  documents: number;
  junior_documents: number;
  senior_documents: number;
  entries: number;
  pending_review: number;
  approved_entries: number;
};

type ReviewStatus = "pending" | "approved" | "rejected";

type ReviewEntry = {
  id: string;
  filename: string;
  class_level: string;
  term: string;
  week_label: string;
  subject: string;
  topic: string;
  learning_objectives: string[];
  learning_activities: string[];
  embedded_core_skills: string[];
  learning_resources: string[];
  source_page: number | null;
  review_status: ReviewStatus;
  review_note: string | null;
  promoted_at: string | null;
};

type Context = {
  workspaceName: string;
  role: string;
  scheme: {
    documents: SchemeDocument[];
    summary: Summary;
  };
  queue: {
    can_review: boolean;
    entries: ReviewEntry[];
  };
};

async function loadContext(supabase: SupabaseClient): Promise<Context | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", session.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) {
    throw new Error("Choose a school workspace before opening Scheme Ingestion.");
  }

  const workspaceId = profile.default_workspace_id as string;
  const [workspaceResult, membershipResult, schemeResult, queueResult] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("name,workspace_type")
        .eq("id", workspaceId)
        .single(),
      supabase
        .from("workspace_members")
        .select("role,status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", session.user.id)
        .single(),
      supabase.rpc("get_scheme_ingestion_intelligence", {
        target_workspace_id: workspaceId,
      }),
      supabase.rpc("get_scheme_review_queue", {
        target_workspace_id: workspaceId,
      }),
    ]);

  const firstError =
    workspaceResult.error ??
    membershipResult.error ??
    schemeResult.error ??
    queueResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data || workspaceResult.data.workspace_type !== "school") {
    throw new Error("Scheme Ingestion is available only in a school workspace.");
  }
  if (!membershipResult.data || membershipResult.data.status !== "active") {
    throw new Error("Active school membership is required.");
  }

  return {
    workspaceName: workspaceResult.data.name,
    role: membershipResult.data.role,
    scheme: schemeResult.data as Context["scheme"],
    queue: queueResult.data as Context["queue"],
  };
}

export function SchemeIngestionClient() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [promotionText, setPromotionText] = useState("");

  const refresh = useCallback(async () => {
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    const next = await loadContext(supabase);
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setContext(next);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadContext(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) router.replace("/sign-in");
        else setContext(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Scheme Ingestion could not be loaded.",
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

  async function review(entryId: string, status: "approved" | "rejected") {
    const reviewNote = (reviewNotes[entryId] ?? "").trim();
    if (!reviewNote) {
      setError(
        "A human review note is required before approving or rejecting a scheme entry.",
      );
      return;
    }

    setBusyId(entryId);
    setError(null);
    setNotice(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: actionError } = await supabase.rpc("review_scheme_entry", {
        target_entry_id: entryId,
        target_status: status,
        target_review_note: reviewNote,
      });
      if (actionError) throw actionError;

      setReviewNotes((current) => {
        const next = { ...current };
        delete next[entryId];
        return next;
      });
      setNotice(
        `Scheme entry ${status}. The decision was recorded with a human review note. Nothing was promoted automatically.`,
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review action failed.");
    } finally {
      setBusyId(null);
    }
  }

  function requestPromotion(entryId: string) {
    setPromotionId(entryId);
    setPromotionText("");
    setError(null);
    setNotice(null);
  }

  async function promote() {
    if (!promotionId || promotionText !== "PROMOTE") return;

    const entryId = promotionId;
    setBusyId(entryId);
    setError(null);
    setNotice(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: actionError } = await supabase.rpc("promote_scheme_entry", {
        target_entry_id: entryId,
      });
      if (actionError) throw actionError;

      setPromotionId(null);
      setPromotionText("");
      setNotice(
        "One reviewed scheme entry was deliberately promoted. Bulk curriculum promotion remains disabled.",
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Promotion failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <p className="text-sm font-semibold text-zinc-600">
          Loading Scheme Ingestion…
        </p>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error ?? "Scheme Ingestion unavailable."}
        </div>
      </main>
    );
  }

  const { summary } = context.scheme;
  const promotionEntry = promotionId
    ? context.queue.entries.find((entry) => entry.id === promotionId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-emerald-900">
        <Link href="/setup/curriculum">← Curriculum Intelligence</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>

      <section className="mt-5 rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
          Stage 16 · Human-governed Lagos sequencing layer
        </p>
        <h1 className="mt-2 text-3xl font-bold">Scheme Ingestion</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-emerald-50/90">
          Verify staged rows against the supplied source. Every Approve or Reject
          decision requires a written human review note. Approval never promotes
          curriculum automatically; promotion is a separate one-row action.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-emerald-700 bg-emerald-900 px-3 py-1.5 text-xs font-bold text-emerald-100">
          Zero automatic promotion · bulk promotion disabled
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {notice}
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Scheme PDFs" value={summary.documents} />
        <Metric label="Junior" value={summary.junior_documents} />
        <Metric label="Senior" value={summary.senior_documents} />
        <Metric label="Staged rows" value={summary.entries} />
        <Metric label="Pending review" value={summary.pending_review} />
        <Metric label="Approved" value={summary.approved_entries} />
      </section>

      <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
              Source registry
            </p>
            <h2 className="mt-2 text-xl font-bold text-zinc-950">
              Supplied scheme documents
            </h2>
          </div>
          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600">
            Role: {context.role}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {context.scheme.documents.map((document) => (
            <article
              key={document.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
            >
              <div className="flex flex-wrap gap-2">
                <Badge>{document.education_level}</Badge>
                <Badge>{document.extraction_status}</Badge>
              </div>
              <h3 className="mt-3 font-bold text-zinc-950">{document.subject}</h3>
              <p className="mt-1 break-words text-xs leading-5 text-zinc-500">
                {document.filename}
              </p>
              <p className="mt-3 text-xs font-semibold text-zinc-600">
                {document.class_scope.join(" · ")}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {document.entries} staged · {document.pending} pending ·{" "}
                {document.approved} approved
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
          Human verification gate
        </p>
        <h2 className="mt-2 text-xl font-bold text-zinc-950">
          Scheme review queue
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
          Approval means a human has checked the extracted row against the supplied
          source and recorded why the decision was made. Promotion stays separate,
          explicit and single-row only.
        </p>

        <div className="mt-6 space-y-5">
          {context.queue.entries.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-600">
              No scheme rows are waiting for review.
            </div>
          ) : null}

          {context.queue.entries.map((entry) => {
            const note = reviewNotes[entry.id] ?? "";
            const noteReady = note.trim().length > 0;
            const busy = busyId === entry.id;

            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-zinc-200 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{entry.class_level}</Badge>
                  <Badge>{entry.term}</Badge>
                  <Badge>{entry.week_label}</Badge>
                  <Badge>{entry.review_status}</Badge>
                  {entry.promoted_at ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
                      promoted
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-lg font-bold text-zinc-950">
                  {entry.subject}: {entry.topic}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {entry.filename}
                  {entry.source_page ? ` · page ${entry.source_page}` : ""}
                </p>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <TextList
                    title="Learning objectives"
                    items={entry.learning_objectives}
                  />
                  <TextList
                    title="Learning activities"
                    items={entry.learning_activities}
                  />
                  <TextList
                    title="Embedded core skills"
                    items={entry.embedded_core_skills}
                  />
                  <TextList
                    title="Learning resources"
                    items={entry.learning_resources}
                  />
                </div>

                {entry.review_note ? (
                  <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    <span className="font-bold text-zinc-900">Recorded review note:</span>{" "}
                    {entry.review_note}
                  </div>
                ) : null}

                {context.queue.can_review &&
                entry.review_status === "pending" &&
                !entry.promoted_at ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <label className="block text-sm font-bold text-amber-950">
                      Required human review note
                      <textarea
                        rows={2}
                        value={note}
                        disabled={busy}
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [entry.id]: event.target.value,
                          }))
                        }
                        placeholder="State what you checked in the supplied source and why this row should be approved or rejected."
                        className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm font-normal text-zinc-900 outline-none focus:border-emerald-700 disabled:opacity-60"
                      />
                    </label>
                    <p className="mt-2 text-xs text-amber-900">
                      Approve and Reject remain disabled until this note is written.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={busy || !noteReady}
                        onClick={() => void review(entry.id, "approved")}
                        className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? "Recording…" : "Approve extraction"}
                      </button>
                      <button
                        disabled={busy || !noteReady}
                        onClick={() => void review(entry.id, "rejected")}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}

                {context.queue.can_review &&
                entry.review_status === "approved" &&
                !entry.promoted_at ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-950">
                      Approval is not promotion.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      Promotion is permitted one reviewed row at a time and requires
                      an explicit typed confirmation.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() => requestPromotion(entry.id)}
                      className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50"
                    >
                      Promote this reviewed row…
                    </button>
                  </div>
                ) : null}

                {!context.queue.can_review ? (
                  <p className="mt-5 text-xs font-semibold text-zinc-500">
                    Read-only. Platform curriculum review permission is required.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {promotionEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 px-4 py-8">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              Explicit single-row promotion gate
            </p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">
              Promote this reviewed scheme row?
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {promotionEntry.class_level} · {promotionEntry.term} ·{" "}
              {promotionEntry.week_label}: {promotionEntry.topic}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This is a separate canonical curriculum action. Bulk promotion is
              disabled and this confirmation applies to this one reviewed row only.
            </p>

            <label className="mt-5 block text-sm font-bold text-zinc-800">
              Type <span className="text-zinc-950">PROMOTE</span> to confirm
              <input
                autoFocus
                value={promotionText}
                disabled={busyId === promotionEntry.id}
                onChange={(event) => setPromotionText(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 font-mono outline-none focus:border-amber-600 disabled:opacity-60"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busyId === promotionEntry.id}
                onClick={() => {
                  setPromotionId(null);
                  setPromotionText("");
                }}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  promotionText !== "PROMOTE" || busyId === promotionEntry.id
                }
                onClick={() => void promote()}
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyId === promotionEntry.id
                  ? "Promoting…"
                  : "Promote one reviewed row"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-zinc-950">{value}</p>
    </article>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
      {children}
    </span>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
        {title}
      </p>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">Not extracted.</p>
      )}
    </div>
  );
}
