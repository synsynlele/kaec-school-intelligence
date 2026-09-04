"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  type KsiSchoolMembership,
  resolveKsiRuntimeAccess,
} from "@/lib/supabase/runtime-access";

type AccessRequest = {
  request_id: string;
  school_name: string;
  school_location: string;
  contact_phone: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  workspace_id: string | null;
  workspace_access_status: string | null;
};

type OwnerState = {
  memberships: KsiSchoolMembership[];
  requests: AccessRequest[];
};

type LoadState = "checking" | "ready" | "error";

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

async function loadOwnerState(supabase: SupabaseClient): Promise<OwnerState | null> {
  const access = await resolveKsiRuntimeAccess(supabase, { force: true });
  if (!access) return null;

  const { data, error } = await supabase.rpc("get_my_school_access_requests");
  if (error) throw error;

  return {
    memberships: access.memberships,
    requests: (data ?? []) as AccessRequest[],
  };
}

export function OwnerAccessClient() {
  const router = useRouter();
  const [state, setState] = useState<OwnerState | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [busy, setBusy] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState("checking");
    setError(null);
    try {
      const next = await loadOwnerState(getBrowserSupabaseClient());
      if (!next) {
        router.replace("/sign-in");
        return;
      }
      setState(next);
      setLoadState("ready");
    } catch (caught) {
      setError(messageFrom(caught, "Owner access could not be loaded."));
      setLoadState("error");
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ownerSchools = useMemo(
    () => state?.memberships.filter((membership) => membership.member_role === "owner") ?? [],
    [state?.memberships],
  );
  const activeOwnerSchool = ownerSchools.find(
    (membership) => membership.member_status === "active" && membership.access_status === "active",
  );
  const latestRequest = state?.requests[0] ?? null;
  const pendingRequest = state?.requests.find((request) => request.status === "pending") ?? null;

  useEffect(() => {
    if (loadState !== "ready" || !activeOwnerSchool) return;
    window.location.replace("/dashboard");
  }, [activeOwnerSchool, loadState]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: requestError } = await supabase.rpc("request_school_access", {
        target_school_name: schoolName.trim(),
        target_school_location: schoolLocation.trim(),
        target_contact_phone: contactPhone.trim(),
      });
      if (requestError) throw requestError;
      setSchoolName("");
      setSchoolLocation("");
      setContactPhone("");
      setSuccess("Your school access request has been sent to KAEC for review.");
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught, "Your school access request could not be submitted."));
    } finally {
      setBusy(false);
    }
  }

  if (loadState === "checking" || (loadState === "ready" && activeOwnerSchool)) {
    return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5"><p className="text-sm font-semibold text-zinc-600">{activeOwnerSchool ? "Owner access confirmed. Opening your dashboard…" : "Checking School Owner access…"}</p></main>;
  }

  if (loadState === "error") {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <KaecBrand />
          <section className="mt-8 rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Owner access check interrupted</p>
            <h1 className="mt-2 text-2xl font-bold text-zinc-950">KSI will not create another school request from an uncertain state.</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">A temporary session or network failure is not treated as “no school.” Retry the existing account check first.</p>
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error ?? "Owner access could not be loaded."}</p>
            <button type="button" onClick={() => void refresh()} className="mt-5 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">Retry access check</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="w-fit"><KaecBrand compact /></Link>
          <Link href="/sign-in" className="text-sm font-semibold text-zinc-600">Change entry role</Link>
        </div>

        <section className="mt-8 rounded-3xl bg-emerald-950 p-7 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">School Owner</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">School access is approved, not self-created.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">
            Your personal KSI identity and your school authority are separate. KAEC reviews the school, provisions it in Paused state, and activates it only when access is approved.
          </p>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div> : null}
        {success ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">{success}</div> : null}

        {ownerSchools.length > 0 ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">School not active</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">{ownerSchools[0].workspace_name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Current access state: <strong>{ownerSchools[0].access_status}</strong>. Your ownership record is preserved, but protected school KSI opens only when KAEC changes the school to Active.
            </p>
          </section>
        ) : pendingRequest ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Awaiting KAEC review</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">{pendingRequest.school_name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Your request was received on {new Date(pendingRequest.requested_at).toLocaleDateString()}. You do not need to create another school or another account.
            </p>
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Request school access</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Tell KAEC which school this account represents.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">This form appears only after KSI successfully loads your current memberships and confirms there is no existing owner school or pending request.</p>

            {latestRequest?.status === "rejected" ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Your previous request was not approved.{latestRequest.review_note ? ` Note: ${latestRequest.review_note}` : ""} You may submit a corrected request below.
              </div>
            ) : null}

            <form onSubmit={submitRequest} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-zinc-800">School name</span>
                <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-emerald-700" placeholder="e.g. Greenfield Academy" />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-zinc-800">School location</span>
                <input value={schoolLocation} onChange={(event) => setSchoolLocation(event.target.value)} required className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-emerald-700" placeholder="e.g. Igando, Lagos" />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Contact phone / WhatsApp</span>
                <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-emerald-700" placeholder="e.g. +234…" />
              </label>
              <button type="submit" disabled={busy} className="rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2">
                {busy ? "Submitting…" : "Submit school access request"}
              </button>
            </form>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
          <h2 className="font-bold text-zinc-950">Already part of a school in another role?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Choosing “School Owner” never upgrades an existing Teacher account into an owner. School authority still comes only from the governed KAEC approval process.</p>
        </section>
      </div>
    </main>
  );
}
