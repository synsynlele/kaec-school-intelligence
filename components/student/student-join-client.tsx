"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const AUTH_RETURN_KEY = "ksi:auth:returnTo";

type RedeemResult = {
  workspace_id: string;
  student_id: string;
  student_name: string;
  workspace_name: string;
};

type StaffSchool = {
  workspaceName: string;
  role: string;
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

async function findStaffSchool(
  supabase: SupabaseClient,
  userId: string,
): Promise<StaffSchool | null> {
  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,status")
    .eq("user_id", userId)
    .eq("status", "active");
  if (membershipError) throw membershipError;

  const staffMemberships = (memberships ?? []).filter(
    (membership) => membership.role !== "student",
  );
  if (!staffMemberships.length) return null;

  const { data: schools, error: schoolError } = await supabase
    .from("workspaces")
    .select("id,name,workspace_type")
    .in(
      "id",
      staffMemberships.map((membership) => membership.workspace_id),
    )
    .eq("workspace_type", "school");
  if (schoolError) throw schoolError;

  const school = schools?.[0];
  if (!school) return null;
  const membership = staffMemberships.find(
    (item) => item.workspace_id === school.id,
  );

  return membership
    ? { workspaceName: school.name, role: membership.role }
    : null;
}

export function StudentJoinClient() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [staffSchool, setStaffSchool] = useState<StaffSchool | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<RedeemResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError.message);
        setSignedIn(false);
        return;
      }

      const user = data.session?.user;
      setSignedIn(Boolean(user));
      if (!user) return;

      try {
        const staff = await findStaffSchool(supabase, user.id);
        if (!cancelled) setStaffSchool(staff);
      } catch (caught) {
        if (!cancelled) {
          setError(messageFrom(caught, "KSI could not verify this account."));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function continueToSignIn() {
    window.sessionStorage.setItem(AUTH_RETURN_KEY, "/student/join");
    router.push("/sign-in");
  }

  async function useDifferentAccount() {
    setBusy(true);
    setError(null);
    try {
      window.sessionStorage.setItem(AUTH_RETURN_KEY, "/student/join");
      await getBrowserSupabaseClient().auth.signOut();
      router.replace("/sign-in");
    } finally {
      setBusy(false);
    }
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || staffSchool) return;

    setBusy(true);
    setError(null);

    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: redeemError } = await supabase.rpc(
        "redeem_student_access_code",
        { raw_code: code.trim() },
      );

      if (redeemError) throw redeemError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("KSI could not complete the student account link.");

      setLinked(row as RedeemResult);
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
    } catch (caught) {
      setError(
        messageFrom(
          caught,
          "The Student Access Code could not be redeemed. Check the code or ask the school to issue a new one.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === null) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
        <p className="text-sm font-semibold text-zinc-600">Checking your KSI account…</p>
      </main>
    );
  }

  if (linked) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
        <section className="rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Student KSI connected</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950">Welcome, {linked.student_name}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Your account is now securely linked to your learning record at {linked.workspace_name}.
          </p>
          <Link href="/student" className="mt-6 inline-flex rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">
            Open Student KSI
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Join Student KSI</p>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950">Connect your learning record</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your school gives you a one-time Student Access Code. The learner must sign in with their own Google or email account before redeeming it.
        </p>

        {!signedIn ? (
          <div className="mt-7 rounded-2xl bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-950">Sign in with the student&apos;s own account first. Google is recommended.</p>
            <button type="button" onClick={continueToSignIn} className="mt-4 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">
              Continue to student sign in
            </button>
          </div>
        ) : staffSchool ? (
          <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-950">This is a staff account, not a student account.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              This account already has the <strong>{staffSchool.role}</strong> role at <strong>{staffSchool.workspaceName}</strong>. KSI deliberately prevents a school owner, admin, leader or teacher account from being converted into a learner profile.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void useDifferentAccount()}
              className="mt-4 rounded-xl bg-amber-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Sign out and use the student&apos;s account
            </button>
          </div>
        ) : (
          <form onSubmit={redeem} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Student Access Code</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="KSI-XXXXXXXX"
                autoComplete="one-time-code"
                required
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 font-mono text-lg font-bold uppercase tracking-[0.08em] text-zinc-950 outline-none focus:border-emerald-700"
              />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-950 px-5 py-3 font-bold text-white disabled:opacity-60">
              {busy ? "Connecting…" : "Connect my Student KSI"}
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <p className="mt-7 text-xs leading-5 text-zinc-500">
          A code can be used once and expires automatically. If it has expired, was revoked or was already used, KSI will now show that exact reason.
        </p>
      </section>
    </main>
  );
}
