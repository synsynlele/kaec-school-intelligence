"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type AccessRequest = {
  request_id: string;
  requester_email: string;
  school_name: string;
  school_location: string;
  contact_phone: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  workspace_id: string | null;
};

function messageFrom(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (
    caught &&
    typeof caught === "object" &&
    "message" in caught &&
    typeof (caught as { message?: unknown }).message === "string"
  ) {
    return (caught as { message: string }).message;
  }
  return fallback;
}

async function fetchRequests(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_school_access_requests");
  if (error) throw error;
  return (data ?? []) as AccessRequest[];
}

export function SchoolAccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setRequests(await fetchRequests(getBrowserSupabaseClient()));
  }

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void fetchRequests(supabase)
      .then((next) => {
        if (!cancelled) setRequests(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(messageFrom(caught, "School access requests could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests],
  );

  async function approve(event: FormEvent<HTMLFormElement>, request: AccessRequest) {
    event.preventDefault();
    const note = new FormData(event.currentTarget).get("note");
    setBusyId(request.request_id);
    setError(null);
    setSuccess(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("approve_school_access_request", {
        target_request_id: request.request_id,
        target_review_note: typeof note === "string" && note.trim() ? note.trim() : null,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      setSuccess(`${String(row?.workspace_name ?? request.school_name)} has been approved and provisioned in Paused state. Activate it separately when commercial access is cleared.`);
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught, "The school access request could not be approved."));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(request: AccessRequest) {
    const note = window.prompt("Reason or guidance for the owner (optional):") ?? "";
    setBusyId(request.request_id);
    setError(null);
    setSuccess(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("reject_school_access_request", {
        target_request_id: request.request_id,
        target_review_note: note.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSuccess(`${request.school_name} access request was rejected.`);
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught, "The school access request could not be rejected."));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <section className="mx-auto max-w-7xl px-5 pt-10 sm:px-8"><div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm font-semibold text-zinc-600">Loading owner access requests…</div></section>;
  }

  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 sm:px-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Owner onboarding queue</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">School access requests</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Owners can create an identity and request access, but only KAEC can approve the request. Approval provisions the school in Paused state; activation remains a separate decision.</p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{pending.length} pending</span>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {success ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</div> : null}

        {pending.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-zinc-50 px-5 py-6 text-sm text-zinc-500">No pending school-owner requests.</div>
        ) : (
          <div className="mt-6 space-y-4">
            {pending.map((request) => (
              <article key={request.request_id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950">{request.school_name}</h3>
                    <dl className="mt-3 space-y-1.5 text-sm text-zinc-600">
                      <div><dt className="inline font-semibold text-zinc-800">Owner email:</dt> <dd className="inline">{request.requester_email}</dd></div>
                      <div><dt className="inline font-semibold text-zinc-800">Location:</dt> <dd className="inline">{request.school_location}</dd></div>
                      <div><dt className="inline font-semibold text-zinc-800">Phone:</dt> <dd className="inline">{request.contact_phone}</dd></div>
                      <div><dt className="inline font-semibold text-zinc-800">Requested:</dt> <dd className="inline">{new Date(request.requested_at).toLocaleString()}</dd></div>
                    </dl>
                  </div>

                  <form onSubmit={(event) => approve(event, request)} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <label>
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-600">Review note</span>
                      <input name="note" placeholder="Optional internal / owner guidance" className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700" />
                    </label>
                    <button type="submit" disabled={busyId !== null} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busyId === request.request_id ? "Working…" : "Approve & provision"}</button>
                    <button type="button" disabled={busyId !== null} onClick={() => void reject(request)} className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-60">Reject</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
