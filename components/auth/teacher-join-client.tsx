"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  announceKsiWorkspaceChange,
  type KsiRuntimeAccess,
  resolveKsiRuntimeAccess,
} from "@/lib/supabase/runtime-access";

type RedeemResult = {
  workspace_id: string;
  workspace_name: string;
  member_role: string;
};

type MembershipCheckState = "checking" | "ready" | "error";

const AUTH_RETURN_KEY = "ksi:auth:returnTo";
const STAFF_ROLES = new Set(["admin", "leader", "teacher"]);

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

export function TeacherJoinClient() {
  const router = useRouter();
  const [access, setAccess] = useState<KsiRuntimeAccess | null>(null);
  const [membershipState, setMembershipState] = useState<MembershipCheckState>("checking");
  const [code, setCode] = useState("");
  const [redeemed, setRedeemed] = useState<RedeemResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccess = useCallback(async () => {
    setMembershipState("checking");
    setError(null);

    try {
      const next = await resolveKsiRuntimeAccess(getBrowserSupabaseClient(), { force: true });
      if (!next) {
        router.replace("/sign-in");
        return;
      }
      setAccess(next);
      setMembershipState("ready");
    } catch (caught) {
      setError(messageFrom(caught, "KSI could not verify your school membership."));
      setMembershipState("error");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadAccess();
    });
    return () => {
      cancelled = true;
    };
  }, [loadAccess]);

  const memberships = access?.memberships ?? [];
  const activeSchoolMembership = access?.activeSchool ?? null;
  const inactiveStaff =
    memberships.find(
      (membership) =>
        STAFF_ROLES.has(membership.member_role) &&
        (membership.member_status !== "active" || membership.access_status !== "active"),
    ) ?? null;
  const ownerMembership = memberships.find((membership) => membership.member_role === "owner") ?? null;
  const studentMembership = memberships.find((membership) => membership.member_role === "student") ?? null;

  useEffect(() => {
    if (membershipState !== "ready" || !activeSchoolMembership) return;
    window.sessionStorage.removeItem(AUTH_RETURN_KEY);
    window.location.replace("/dashboard");
  }, [activeSchoolMembership, membershipState]);

  const verifyRedeemedMembership = useCallback(async (linked: RedeemResult) => {
    setMembershipState("checking");
    setError(null);
    try {
      const next = await resolveKsiRuntimeAccess(getBrowserSupabaseClient(), { force: true });
      if (!next?.activeSchool || next.activeSchool.workspace_id !== linked.workspace_id) {
        throw new Error(
          "Your Staff Access Code was accepted, but KSI has not finished confirming the new school membership yet. Retry this access check; do not request or enter another code.",
        );
      }
      setAccess(next);
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      window.location.replace("/dashboard");
    } catch (caught) {
      setError(messageFrom(caught, "KSI accepted the code but could not confirm the new membership yet."));
      setMembershipState("error");
      setBusy(false);
    }
  }, []);

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: redeemError } = await supabase.rpc("redeem_staff_access_code", {
        raw_code: code.trim(),
      });
      if (redeemError) throw redeemError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("KSI could not complete the staff account link.");

      const linked = row as RedeemResult;
      if (!linked.workspace_id || !linked.workspace_name || !linked.member_role) {
        throw new Error("KSI linked the code but did not return a complete school membership.");
      }

      setRedeemed(linked);
      setCode("");
      announceKsiWorkspaceChange();
      await verifyRedeemedMembership(linked);
    } catch (caught) {
      setError(messageFrom(caught, "The Staff Access Code could not be redeemed."));
      setBusy(false);
    }
  }

  async function signOutAndChangeAccount() {
    setBusy(true);
    try {
      await getBrowserSupabaseClient().auth.signOut();
      router.replace("/sign-in");
    } finally {
      setBusy(false);
    }
  }

  if (membershipState === "checking" || (membershipState === "ready" && activeSchoolMembership)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 text-center">
        <div>
          <p className="text-sm font-semibold text-zinc-600">
            {redeemed
              ? `Access code accepted for ${redeemed.workspace_name}. Confirming your school workspace…`
              : activeSchoolMembership
                ? "Access confirmed. Opening your KSI workspace…"
                : "Checking Teacher / Staff access…"}
          </p>
          {redeemed ? <p className="mt-2 text-xs text-zinc-500">Do not enter or request another access code.</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="w-fit"><KaecBrand compact /></Link>
          <Link href="/sign-in" className="text-sm font-semibold text-zinc-600">Change entry role</Link>
        </div>

        <section className="mt-8 rounded-3xl bg-emerald-950 p-7 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Teacher / Staff</p>
          <h1 className="mt-3 text-3xl font-bold">Connect to your school.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/90">
            A Teacher account does not choose its own school or permissions. Your school owner/admin issues a one-time Staff Access Code to your exact email address.
          </p>
        </section>

        {membershipState === "error" ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
              {redeemed ? "Access code already accepted" : "Access check interrupted"}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Do not enter another access code.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {redeemed
                ? `KSI already accepted the one-time code for ${redeemed.workspace_name}. The only remaining step is to confirm the membership and open the dashboard.`
                : "KSI could not verify whether this account is already connected to a school. A temporary network or session failure is never treated as no membership."}
            </p>
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error ?? "KSI could not verify your school membership."}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void (redeemed ? verifyRedeemedMembership(redeemed) : loadAccess())}
              className="mt-5 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Retry access check
            </button>
          </section>
        ) : inactiveStaff ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Existing staff membership</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">{inactiveStaff.workspace_name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Your staff membership already exists. Membership status is <strong>{inactiveStaff.member_status}</strong> and school access is <strong>{inactiveStaff.access_status}</strong>. Another access code cannot bypass that governance state; your school owner/admin or KAEC must restore the existing access instead.
            </p>
          </section>
        ) : ownerMembership ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <p className="text-sm font-bold text-amber-950">This account is already a School Owner at {ownerMembership.workspace_name}.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">Choosing “Teacher / Staff” never downgrades or rewrites your owner role.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/dashboard" className="rounded-xl bg-amber-950 px-4 py-2.5 text-sm font-bold text-white">Open owner dashboard</a>
              <button type="button" disabled={busy} onClick={() => void signOutAndChangeAccount()} className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-950">Use another account</button>
            </div>
          </section>
        ) : studentMembership ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <p className="text-sm font-bold text-amber-950">This is already a Student KSI account.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">A student account is not silently converted into staff. Use a separate authorised staff account.</p>
            <button type="button" disabled={busy} onClick={() => void signOutAndChangeAccount()} className="mt-5 rounded-xl bg-amber-950 px-4 py-2.5 text-sm font-bold text-white">Sign out and use staff account</button>
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Staff Access Code</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Enter the code from your school once.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">This form appears only after KSI successfully confirms that this account has no active school membership. Once the code is accepted, KSI will never ask you to submit that one-time code again.</p>
            {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div> : null}
            <form onSubmit={redeem} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Staff Access Code</span>
                <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required autoComplete="one-time-code" placeholder="KSI-STAFF-XXXXXXXXXX" className="w-full rounded-xl border border-zinc-300 px-4 py-3 font-mono text-lg font-bold uppercase tracking-[0.06em] outline-none focus:border-emerald-700" />
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-950 px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? "Connecting…" : "Connect me to my school"}</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
