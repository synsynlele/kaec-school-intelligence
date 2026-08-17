"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SchoolMembership = {
  workspace_id: string;
  workspace_name: string;
  access_status: "active" | "paused" | "blocked" | "disabled";
  member_role: string;
  member_status: string;
};

type RedeemResult = {
  workspace_id: string;
  workspace_name: string;
  member_role: string;
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

export function TeacherJoinClient() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<RedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      if (!data.session?.user) {
        router.replace("/sign-in");
        return;
      }

      const { data: membershipData, error: membershipError } = await supabase.rpc(
        "get_my_school_memberships",
      );
      if (cancelled) return;
      if (membershipError) setError(membershipError.message);
      else setMemberships((membershipData ?? []) as SchoolMembership[]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const activeStaff = useMemo(
    () =>
      memberships.find(
        (membership) =>
          ["admin", "leader", "teacher"].includes(membership.member_role) &&
          membership.member_status === "active" &&
          membership.access_status === "active",
      ) ?? null,
    [memberships],
  );

  const inactiveStaff = useMemo(
    () =>
      memberships.find(
        (membership) =>
          ["admin", "leader", "teacher"].includes(membership.member_role) &&
          membership.access_status !== "active",
      ) ?? null,
    [memberships],
  );

  const ownerMembership = memberships.find((membership) => membership.member_role === "owner") ?? null;
  const studentMembership = memberships.find((membership) => membership.member_role === "student") ?? null;

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
      setLinked(row as RedeemResult);
    } catch (caught) {
      setError(messageFrom(caught, "The Staff Access Code could not be redeemed."));
    } finally {
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

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5"><p className="text-sm font-semibold text-zinc-600">Checking Teacher / Staff access…</p></main>;
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

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div> : null}

        {linked ? (
          <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Staff access connected</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">{linked.workspace_name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Your governed role is <strong>{linked.member_role}</strong>. KSI has connected this account to the school without changing any other account identity.</p>
            <a href="/dashboard" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">Open KSI dashboard</a>
          </section>
        ) : activeStaff ? (
          <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Already connected</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">{activeStaff.workspace_name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">This account already has the <strong>{activeStaff.member_role}</strong> role in an active school.</p>
            <a href="/dashboard" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">Open KSI dashboard</a>
          </section>
        ) : inactiveStaff ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">School access {inactiveStaff.access_status}</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">{inactiveStaff.workspace_name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Your staff membership remains preserved, but protected school KSI is unavailable until KAEC reactivates the school.</p>
          </section>
        ) : ownerMembership ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <p className="text-sm font-bold text-amber-950">This account is already a School Owner at {ownerMembership.workspace_name}.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">Choosing “Teacher / Staff” on the entry screen does not downgrade or rewrite your owner role. Use your owner dashboard, or sign out and use the teacher&apos;s own account.</p>
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
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Enter the code from your school.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">The code is bound to the email address the school invited. If you signed in with a different email, KSI will refuse the connection.</p>
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
