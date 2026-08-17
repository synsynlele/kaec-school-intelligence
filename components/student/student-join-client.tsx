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

export function StudentJoinClient() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<RedeemResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError.message);
        setSignedIn(false);
        return;
      }
      setSignedIn(Boolean(data.session?.user));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function continueToSignIn() {
    window.sessionStorage.setItem(AUTH_RETURN_KEY, "/student/join");
    router.push("/sign-in");
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;

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
        caught instanceof Error
          ? caught.message
          : "The Student Access Code could not be redeemed.",
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
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
            Student KSI connected
          </p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950">
            Welcome, {linked.student_name}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Your account is now securely linked to your learning record at {linked.workspace_name}.
          </p>
          <Link
            href="/student"
            className="mt-6 inline-flex rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white"
          >
            Open Student KSI
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
          Join Student KSI
        </p>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950">Connect your learning record</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your school gives you a one-time Student Access Code. Sign in with your own account, then enter that code here. KSI will link only your learning record.
        </p>

        {!signedIn ? (
          <div className="mt-7 rounded-2xl bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-950">
              Sign in first. Google is the recommended option.
            </p>
            <button
              type="button"
              onClick={continueToSignIn}
              className="mt-4 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white"
            >
              Continue to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={redeem} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
                Student Access Code
              </span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="KSI-XXXXXXXX"
                autoComplete="one-time-code"
                required
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 font-mono text-lg font-bold uppercase tracking-[0.08em] text-zinc-950 outline-none focus:border-emerald-700"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-950 px-5 py-3 font-bold text-white disabled:opacity-60"
            >
              {busy ? "Connecting…" : "Connect my Student KSI"}
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <p className="mt-7 text-xs leading-5 text-zinc-500">
          A code can be used once and expires automatically. If it has expired or was already used, ask your school administrator for a new code.
        </p>
      </section>
    </main>
  );
}
