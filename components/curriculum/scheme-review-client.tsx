"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type ReviewFilter = "pending" | "approved" | "rejected" | "promoted" | "all";
type ReviewStatus = "pending" | "approved" | "rejected";

type ReviewSummary = {
  documents: number;
  staged_documents: number;
  reviewed_documents: number;
  ingested_documents: number;
  blocked_documents: number;
  entries: number;
  pending: number;
  approved_unpromoted: number;
  rejected: number;
  promoted: number;
};

type SchemeDocument = {
  id: string;
  filename: string;
  subject: string;
  education_level: string;
  class_scope: string[];
  provenance_status: string;
  extraction_status: string;
  metadata: unknown;
  entries: number;
  pending: number;
  approved_unpromoted: number;
  rejected: number;
  promoted: number;
};

type ReviewConsolePayload = {
  summary: ReviewSummary;
  documents: SchemeDocument[];
};

type SchemeEntry = {
  id: string;
  document_id: string;
  filename: string;
  education_level: string;
  class_level: string;
  term: string;
  week_label: string;
  week_number: number | null;
  subject: string;
  component: string | null;
  topic: string;
  learning_objectives: unknown;
  learning_activities: unknown;
  embedded_core_skills: unknown;
  learning_resources: unknown;
  source_page: number | null;
  source_reference: string | null;
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
  promoted_at: string | null;
};

type ReviewPagePayload = {
  total: number;
  limit: number;
  offset: number;
  entries: SchemeEntry[];
};

type Filters = {
  documentId: string;
  status: ReviewFilter;
  classLevel: string;
  term: string;
};

type EditDraft = {
  entryId: string;
  classLevel: string;
  term: string;
  weekLabel: string;
  weekNumber: string;
  component: string;
  topic: string;
  objectives: string;
  activities: string;
  coreSkills: string;
  resources: string;
  sourcePage: string;
  sourceReference: string;
};

const PAGE_SIZE = 50;
const INITIAL_FILTERS: Filters = {
  documentId: "",
  status: "pending",
  classLevel: "",
  term: "",
};

function messageFrom(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (
    caught &&
    typeof caught === "object" &&
    "message" in caught &&
    typeof caught.message === "string" &&
    caught.message.trim()
  ) {
    return caught.message;
  }
  return fallback;
}

function asConsolePayload(value: unknown): ReviewConsolePayload {
  return value as ReviewConsolePayload;
}

function asPagePayload(value: unknown): ReviewPagePayload {
  return value as ReviewPagePayload;
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item === null || item === undefined) return "";
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }).filter(Boolean);
}

function lines(value: unknown) {
  return asTextArray(value).join("\n");
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function blockerFrom(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const blocker = (metadata as Record<string, unknown>).stage12_ingestion_blocker;
  return typeof blocker === "string" && blocker.trim() ? blocker : null;
}

function statusClasses(status: ReviewStatus, promoted: boolean) {
  if (promoted) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "approved") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusLabel(entry: SchemeEntry) {
  if (entry.promoted_at) return "Promoted";
  if (entry.review_status === "approved") return "Approved · awaiting promotion";
  if (entry.review_status === "rejected") return "Rejected";
  return "Pending review";
}

function DetailList({ title, value }: { title: string; value: unknown }) {
  const items = asTextArray(value);
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SchemeReviewClient() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [consoleData, setConsoleData] = useState<ReviewConsolePayload | null>(null);
  const [pageData, setPageData] = useState<ReviewPagePayload | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowNotes, setRowNotes] = useState<Record<string, string>>({});
  const [bulkNote, setBulkNote] = useState("");
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [promotionIds, setPromotionIds] = useState<string[] | null>(null);
  const [promotionText, setPromotionText] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function fetchConsole(activeWorkspaceId: string) {
    const supabase = getBrowserSupabaseClient();
    const { data, error: rpcError } = await supabase.rpc(
      "get_scheme_review_console",
      { target_workspace_id: activeWorkspaceId },
    );
    if (rpcError) throw rpcError;
    return asConsolePayload(data);
  }

  async function fetchPage(
    activeWorkspaceId: string,
    activeFilters: Filters,
    activeOffset: number,
  ) {
    const supabase = getBrowserSupabaseClient();
    const { data, error: rpcError } = await supabase.rpc(
      "get_scheme_review_page",
      {
        target_workspace_id: activeWorkspaceId,
        target_document_id: activeFilters.documentId || null,
        target_status: activeFilters.status,
        target_class_level: activeFilters.classLevel || null,
        target_term: activeFilters.term || null,
        target_limit: PAGE_SIZE,
        target_offset: activeOffset,
      },
    );
    if (rpcError) throw rpcError;
    return asPagePayload(data);
  }

  async function refreshPage(
    activeWorkspaceId: string,
    activeFilters: Filters,
    activeOffset: number,
  ) {
    setPageLoading(true);
    setError(null);
    try {
      const nextPage = await fetchPage(
        activeWorkspaceId,
        activeFilters,
        activeOffset,
      );
      setPageData(nextPage);
    } catch (caught) {
      setError(messageFrom(caught, "The review queue could not be refreshed."));
    } finally {
      setPageLoading(false);
    }
  }

  async function refreshAll() {
    if (!workspaceId) return;
    setPageLoading(true);
    setError(null);
    try {
      const [nextConsole, nextPage] = await Promise.all([
        fetchConsole(workspaceId),
        fetchPage(workspaceId, filters, offset),
      ]);
      setConsoleData(nextConsole);
      setPageData(nextPage);
    } catch (caught) {
      setError(messageFrom(caught, "The curriculum review console could not be refreshed."));
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();

    void (async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          router.replace("/sign-in");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("default_workspace_id")
          .eq("id", session.user.id)
          .single();
        if (profileError) throw profileError;
        if (!profile?.default_workspace_id) {
          throw new Error("Choose an active workspace from the dashboard first.");
        }

        const { data: canReview, error: accessError } = await supabase.rpc(
          "get_scheme_review_access",
        );
        if (accessError) throw accessError;
        if (!canReview) {
          if (!cancelled) setRestricted(true);
          return;
        }

        const activeWorkspaceId = profile.default_workspace_id;
        const [nextConsole, nextPage] = await Promise.all([
          fetchConsole(activeWorkspaceId),
          fetchPage(activeWorkspaceId, INITIAL_FILTERS, 0),
        ]);
        if (cancelled) return;
        setWorkspaceId(activeWorkspaceId);
        setConsoleData(nextConsole);
        setPageData(nextPage);
      } catch (caught) {
        if (!cancelled) {
          setError(
            messageFrom(caught, "The curriculum review console could not be loaded."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/sign-in");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const entries = pageData?.entries ?? [];
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selected.has(entry.id)),
    [entries, selected],
  );
  const selectableEntries = entries.filter((entry) => !entry.promoted_at);
  const allSelectableSelected =
    selectableEntries.length > 0 &&
    selectableEntries.every((entry) => selected.has(entry.id));
  const selectedCanPromote =
    selectedEntries.length > 0 &&
    selectedEntries.every(
      (entry) => entry.review_status === "approved" && !entry.promoted_at,
    );
  const selectedDocument = consoleData?.documents.find(
    (document) => document.id === filters.documentId,
  );
  const quarantinedDocuments =
    consoleData?.documents.filter((document) => blockerFrom(document.metadata)) ?? [];
  const canGoNext = Boolean(
    pageData && pageData.offset + pageData.limit < pageData.total,
  );
  const canGoPrevious = offset > 0;

  function changeFilters(patch: Partial<Filters>) {
    if (!workspaceId) return;
    const nextFilters = { ...filters, ...patch };
    setFilters(nextFilters);
    setOffset(0);
    setSelected(new Set());
    setNotice(null);
    void refreshPage(workspaceId, nextFilters, 0);
  }

  function movePage(nextOffset: number) {
    if (!workspaceId) return;
    const safeOffset = Math.max(0, nextOffset);
    setOffset(safeOffset);
    setSelected(new Set());
    setNotice(null);
    void refreshPage(workspaceId, filters, safeOffset);
  }

  function toggleEntry(entryId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  function togglePageSelection() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelectableSelected) {
        selectableEntries.forEach((entry) => next.delete(entry.id));
      } else {
        selectableEntries.forEach((entry) => next.add(entry.id));
      }
      return next;
    });
  }

  async function reviewEntries(
    ids: string[],
    nextStatus: "approved" | "rejected",
    reviewNote: string,
  ) {
    if (ids.length === 0) return;
    setAction(`${nextStatus}:${ids.length}`);
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const result = ids.length === 1
        ? await supabase.rpc("review_scheme_entry", {
            target_entry_id: ids[0],
            target_status: nextStatus,
            target_review_note: reviewNote.trim() || null,
          })
        : await supabase.rpc("review_scheme_entries_bulk", {
            target_entry_ids: ids,
            target_status: nextStatus,
            target_review_note: reviewNote.trim() || null,
          });
      if (result.error) throw result.error;
      setSelected(new Set());
      setBulkNote("");
      setRowNotes((current) => {
        const next = { ...current };
        ids.forEach((id) => delete next[id]);
        return next;
      });
      setNotice(
        `${ids.length} scheme ${ids.length === 1 ? "entry" : "entries"} ${nextStatus}. Nothing was promoted automatically.`,
      );
      await refreshAll();
    } catch (caught) {
      setError(messageFrom(caught, "The review action could not be completed."));
    } finally {
      setAction(null);
    }
  }

  function startEdit(entry: SchemeEntry) {
    if (entry.promoted_at) return;
    setEditing({
      entryId: entry.id,
      classLevel: entry.class_level,
      term: entry.term,
      weekLabel: entry.week_label,
      weekNumber: entry.week_number?.toString() ?? "",
      component: entry.component ?? "",
      topic: entry.topic,
      objectives: lines(entry.learning_objectives),
      activities: lines(entry.learning_activities),
      coreSkills: lines(entry.embedded_core_skills),
      resources: lines(entry.learning_resources),
      sourcePage: entry.source_page?.toString() ?? "",
      sourceReference: entry.source_reference ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.weekLabel.trim() || !editing.topic.trim()) {
      setError("Week label and topic are required.");
      return;
    }
    setAction(`edit:${editing.entryId}`);
    setError(null);
    setNotice(null);
    try {
      const weekNumber = editing.weekNumber.trim()
        ? Number(editing.weekNumber)
        : null;
      const sourcePage = editing.sourcePage.trim()
        ? Number(editing.sourcePage)
        : null;
      if (weekNumber !== null && !Number.isInteger(weekNumber)) {
        throw new Error("Week number must be a whole number.");
      }
      if (sourcePage !== null && !Number.isInteger(sourcePage)) {
        throw new Error("Source page must be a whole number.");
      }

      const supabase = getBrowserSupabaseClient();
      const { error: updateError } = await supabase.rpc("update_scheme_entry", {
        target_entry_id: editing.entryId,
        target_patch: {
          class_level: editing.classLevel,
          term: editing.term,
          week_label: editing.weekLabel.trim(),
          week_number: weekNumber,
          component_name: editing.component.trim() || null,
          topic: editing.topic.trim(),
          learning_objectives: parseLines(editing.objectives),
          learning_activities: parseLines(editing.activities),
          embedded_core_skills: parseLines(editing.coreSkills),
          learning_resources: parseLines(editing.resources),
          source_page: sourcePage,
          source_reference: editing.sourceReference.trim() || null,
        },
      });
      if (updateError) throw updateError;
      setEditing(null);
      setNotice("Entry updated and returned to Pending review. Nothing was promoted.");
      await refreshAll();
    } catch (caught) {
      setError(messageFrom(caught, "The scheme entry could not be updated."));
    } finally {
      setAction(null);
    }
  }

  function requestPromotion(ids: string[]) {
    if (ids.length === 0) return;
    setPromotionIds(ids);
    setPromotionText("");
    setError(null);
    setNotice(null);
  }

  async function confirmPromotion() {
    if (!promotionIds || promotionIds.length === 0 || promotionText !== "PROMOTE") {
      return;
    }
    const ids = promotionIds;
    setAction(`promote:${ids.length}`);
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const result = ids.length === 1
        ? await supabase.rpc("promote_scheme_entry", {
            target_entry_id: ids[0],
          })
        : await supabase.rpc("promote_scheme_entries_bulk", {
            target_entry_ids: ids,
          });
      if (result.error) throw result.error;
      setPromotionIds(null);
      setPromotionText("");
      setSelected(new Set());
      setNotice(
        `${ids.length} approved scheme ${ids.length === 1 ? "entry was" : "entries were"} promoted into the canonical Lagos curriculum graph.`,
      );
      await refreshAll();
    } catch (caught) {
      setError(messageFrom(caught, "Promotion could not be completed."));
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <p className="text-sm font-medium text-zinc-500">
          Loading the governed curriculum review queue…
        </p>
      </main>
    );
  }

  if (restricted) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
            Restricted curriculum authority
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-950">
            This review console is limited to KSI platform curriculum administrators.
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            School workspace roles can use approved curriculum intelligence, but they cannot approve or promote global KSI curriculum records.
          </p>
        </div>
      </main>
    );
  }

  if (!workspaceId || !consoleData || !pageData) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-7 text-sm text-red-800">
          {error ?? "The curriculum review console could not be loaded."}
        </div>
      </main>
    );
  }

  const summaryCards = [
    ["Pending", consoleData.summary.pending, "Awaiting human decision"],
    ["Approved", consoleData.summary.approved_unpromoted, "Still not live"],
    ["Rejected", consoleData.summary.rejected, "Excluded from promotion"],
    ["Promoted", consoleData.summary.promoted, "Canonical graph"],
    ["Documents", consoleData.summary.documents, `${consoleData.summary.staged_documents} still staged`],
  ] as const;

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Stage 12 · Human curriculum governance
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Scheme Review & Approval Console
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">
                Review source-traceable Lagos scheme rows before they can enter KSI&apos;s canonical curriculum graph. Approval and promotion are deliberately separate actions.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Zero automatic promotion</p>
              <p className="mt-1 text-emerald-800">
                Approved rows remain non-live until you explicitly type PROMOTE.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summaryCards.map(([label, value, hint]) => (
              <div key={label} className="rounded-2xl border border-zinc-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
                <p className="mt-1 text-xs text-zinc-500">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        {quarantinedDocuments.length > 0 ? (
          <section className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
              Provenance quarantine
            </p>
            {quarantinedDocuments.map((document) => (
              <div key={document.id} className="mt-3">
                <p className="font-semibold text-zinc-950">{document.filename}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">
                  {blockerFrom(document.metadata)}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        ) : null}

        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-zinc-700">
              Document
              <select
                value={filters.documentId}
                onChange={(event) => changeFilters({ documentId: event.target.value })}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
              >
                <option value="">All documents</option>
                {consoleData.documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.subject} · {document.education_level} ({document.entries})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-zinc-700">
              Review state
              <select
                value={filters.status}
                onChange={(event) =>
                  changeFilters({ status: event.target.value as ReviewFilter })
                }
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
              >
                <option value="pending">Pending review</option>
                <option value="approved">Approved · awaiting promotion</option>
                <option value="rejected">Rejected</option>
                <option value="promoted">Promoted</option>
                <option value="all">All rows</option>
              </select>
            </label>

            <label className="text-sm font-medium text-zinc-700">
              Class
              <select
                value={filters.classLevel}
                onChange={(event) => changeFilters({ classLevel: event.target.value })}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
              >
                <option value="">All classes</option>
                {['JSS1','JSS2','JSS3','SS1','SS2','SS3'].map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-zinc-700">
              Term
              <select
                value={filters.term}
                onChange={(event) => changeFilters({ term: event.target.value })}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
              >
                <option value="">All terms</option>
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>
            </label>
          </div>

          {selectedDocument ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-stone-50 px-4 py-3 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-950">{selectedDocument.filename}</span>
              <span className="mx-2 text-zinc-300">·</span>
              {selectedDocument.pending} pending · {selectedDocument.approved_unpromoted} approved · {selectedDocument.rejected} rejected · {selectedDocument.promoted} promoted
            </div>
          ) : null}
        </section>

        {selected.size > 0 ? (
          <section className="sticky top-3 z-30 mt-5 rounded-2xl border border-emerald-300 bg-emerald-950 p-4 text-white shadow-xl">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="font-semibold">{selected.size} selected on this page</p>
                <p className="mt-1 text-xs text-emerald-100">
                  Bulk review never promotes. Promotion has its own confirmation gate.
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:max-w-4xl">
                <input
                  value={bulkNote}
                  onChange={(event) => setBulkNote(event.target.value)}
                  placeholder="Optional review note for selected rows"
                  className="min-w-0 flex-1 rounded-xl border border-emerald-700 bg-emerald-900 px-3 py-2 text-sm text-white outline-none placeholder:text-emerald-300 focus:border-emerald-300"
                />
                <button
                  type="button"
                  disabled={Boolean(action)}
                  onClick={() => void reviewEntries([...selected], "approved", bulkNote)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                >
                  Approve selected
                </button>
                <button
                  type="button"
                  disabled={Boolean(action)}
                  onClick={() => void reviewEntries([...selected], "rejected", bulkNote)}
                  className="rounded-xl border border-red-300/50 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Reject selected
                </button>
                {selectedCanPromote ? (
                  <button
                    type="button"
                    disabled={Boolean(action)}
                    onClick={() => requestPromotion([...selected])}
                    className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
                  >
                    Promote selected…
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Review queue</p>
              <p className="mt-1 text-sm text-zinc-500">
                {pageData.total.toLocaleString()} matching rows · showing {pageData.total === 0 ? 0 : pageData.offset + 1}–{Math.min(pageData.offset + pageData.limit, pageData.total)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectableEntries.length > 0 ? (
                <button
                  type="button"
                  onClick={togglePageSelection}
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {allSelectableSelected ? "Clear page selection" : "Select this page"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={pageLoading || Boolean(action)}
                onClick={() => void refreshAll()}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {pageLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="font-medium text-zinc-800">No scheme rows match these filters.</p>
              <p className="mt-2 text-sm text-zinc-500">
                Quarantined or source-incomplete documents can correctly have zero staged rows.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {entries.map((entry) => {
                const promoted = Boolean(entry.promoted_at);
                const rowNote = rowNotes[entry.id] ?? "";
                return (
                  <article key={entry.id} className="p-5 sm:p-6">
                    <div className="flex gap-4">
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          aria-label={`Select ${entry.subject} ${entry.week_label}`}
                          checked={selected.has(entry.id)}
                          disabled={promoted}
                          onChange={() => toggleEntry(entry.id)}
                          className="h-4 w-4 rounded border-zinc-300 accent-emerald-800 disabled:opacity-30"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            {entry.class_level}
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                            {entry.term}
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                            {entry.week_label}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(entry.review_status, promoted)}`}>
                            {statusLabel(entry)}
                          </span>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-semibold text-emerald-900">
                            {entry.subject}{entry.component ? ` · ${entry.component}` : ""}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold leading-7 text-zinc-950">
                            {entry.topic}
                          </h2>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            Source: {entry.filename}
                            {entry.source_page ? ` · page ${entry.source_page}` : ""}
                            {entry.source_reference ? ` · ${entry.source_reference}` : ""}
                          </p>
                        </div>

                        <details className="mt-4 rounded-2xl border border-zinc-200 bg-stone-50 p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                            Inspect extracted learning detail
                          </summary>
                          <div className="mt-4 grid gap-5 lg:grid-cols-2">
                            <DetailList title="Learning objectives" value={entry.learning_objectives} />
                            <DetailList title="Learning activities" value={entry.learning_activities} />
                            <DetailList title="Embedded core skills" value={entry.embedded_core_skills} />
                            <DetailList title="Learning resources" value={entry.learning_resources} />
                          </div>
                          {entry.review_note ? (
                            <div className="mt-4 border-t border-zinc-200 pt-4 text-sm text-zinc-700">
                              <span className="font-semibold">Review note:</span> {entry.review_note}
                            </div>
                          ) : null}
                        </details>

                        {!promoted ? (
                          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                            <input
                              value={rowNote}
                              onChange={(event) =>
                                setRowNotes((current) => ({
                                  ...current,
                                  [entry.id]: event.target.value,
                                }))
                              }
                              placeholder="Optional review note"
                              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={Boolean(action)}
                                onClick={() => startEdit(entry)}
                                className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                              >
                                Edit source row
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(action)}
                                onClick={() => void reviewEntries([entry.id], "approved", rowNote)}
                                className="rounded-xl bg-emerald-800 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(action)}
                                onClick={() => void reviewEntries([entry.id], "rejected", rowNote)}
                                className="rounded-xl border border-red-300 px-3.5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                              {entry.review_status === "approved" ? (
                                <button
                                  type="button"
                                  disabled={Boolean(action)}
                                  onClick={() => requestPromotion([entry.id])}
                                  className="rounded-xl bg-amber-300 px-3.5 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-50"
                                >
                                  Promote…
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm font-medium text-emerald-800">
                            Promoted rows are immutable. Corrections must be handled through a new governed source/version, not silent editing.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-4">
            <button
              type="button"
              disabled={!canGoPrevious || pageLoading}
              onClick={() => movePage(offset - PAGE_SIZE)}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-xs font-medium text-zinc-500">
              Page {pageData.total === 0 ? 0 : Math.floor(offset / PAGE_SIZE) + 1} of {Math.ceil(pageData.total / PAGE_SIZE)}
            </p>
            <button
              type="button"
              disabled={!canGoNext || pageLoading}
              onClick={() => movePage(offset + PAGE_SIZE)}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/60 px-4 py-8">
          <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                  Source-row correction
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Edit before approval</h2>
                <p className="mt-2 text-sm text-zinc-600">
                  Saving a correction resets this row to Pending review. It does not promote it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700">
                Class
                <select
                  value={editing.classLevel}
                  onChange={(event) => setEditing({ ...editing, classLevel: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                >
                  {['JSS1','JSS2','JSS3','SS1','SS2','SS3'].map((level) => <option key={level}>{level}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Term
                <select
                  value={editing.term}
                  onChange={(event) => setEditing({ ...editing, term: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                >
                  {['First Term','Second Term','Third Term'].map((term) => <option key={term}>{term}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Week label
                <input value={editing.weekLabel} onChange={(event) => setEditing({ ...editing, weekLabel: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Week number
                <input inputMode="numeric" value={editing.weekNumber} onChange={(event) => setEditing({ ...editing, weekNumber: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
                Component / strand
                <input value={editing.component} onChange={(event) => setEditing({ ...editing, component: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" placeholder="Leave blank for non-composite subjects" />
              </label>
              <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
                Topic
                <textarea rows={3} value={editing.topic} onChange={(event) => setEditing({ ...editing, topic: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Learning objectives · one per line
                <textarea rows={7} value={editing.objectives} onChange={(event) => setEditing({ ...editing, objectives: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Learning activities · one per line
                <textarea rows={7} value={editing.activities} onChange={(event) => setEditing({ ...editing, activities: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Embedded core skills · one per line
                <textarea rows={6} value={editing.coreSkills} onChange={(event) => setEditing({ ...editing, coreSkills: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Learning resources · one per line
                <textarea rows={6} value={editing.resources} onChange={(event) => setEditing({ ...editing, resources: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Source page
                <input inputMode="numeric" value={editing.sourcePage} onChange={(event) => setEditing({ ...editing, sourcePage: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Source reference
                <input value={editing.sourceReference} onChange={(event) => setEditing({ ...editing, sourceReference: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700">
                Cancel
              </button>
              <button type="button" disabled={Boolean(action)} onClick={() => void saveEdit()} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {action?.startsWith("edit:") ? "Saving…" : "Save correction"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {promotionIds ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 px-4 py-8">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              Explicit promotion gate
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Promote {promotionIds.length} approved {promotionIds.length === 1 ? "row" : "rows"}?
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Promotion creates canonical curriculum nodes and makes the approved scheme content available to KSI&apos;s curriculum graph. This is separate from approval and is never automatic.
            </p>
            <label className="mt-5 block text-sm font-medium text-zinc-700">
              Type <span className="font-bold text-zinc-950">PROMOTE</span> to confirm
              <input
                autoFocus
                value={promotionText}
                onChange={(event) => setPromotionText(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 font-mono outline-none focus:border-amber-600"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(action)}
                onClick={() => {
                  setPromotionIds(null);
                  setPromotionText("");
                }}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={promotionText !== "PROMOTE" || Boolean(action)}
                onClick={() => void confirmPromotion()}
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {action?.startsWith("promote:") ? "Promoting…" : "Promote to curriculum graph"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
