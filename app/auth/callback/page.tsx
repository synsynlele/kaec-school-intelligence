"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const AUTH_RETURN_KEY = "ksi:auth:returnTo";

function returnedAuthError() {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.get("error_description") || search.get("error") || hash.get("error_description") || hash.get("error") || null;
}

function safeInternalPath(value: string | null) {
  const path = value?.trim() ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path === "/student" || path.startsWith("/student/")) return "/dashboard";
  if (path === "/setup/student-access" || path.startsWith("/setup/student-access/")) return "/dashboard";
  return path;
}

function postAuthPath() {
  if (typeof window === "undefined") return "/dashboard";
  const search = new URLSearchParams(window.location.search);
  const queryDestination = safeInternalPath(search.get("next"));
  if (queryDestination) return queryDestination;
  const stored = safeInternalPath(window.sessionStorage.getItem(AUTH_RETURN_KEY));
  return stored ?? "/dashboard";
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Completing secure sign-in…");

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let active = true;
    let completed = false;

    const providerError = returnedAuthError();
    if (providerError) {
      const providerErrorTimer = window.setTimeout(() => { if (active) setError(providerError); }, 0);
      return () => {
        active = false;
        window.clearTimeout(providerErrorTimer);
      };
    }

    function enterWorkspace(session: Session | null) {
      if (!active || completed || !session?.user) return;
      completed = true;
      const destination = postAuthPath();
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      setMessage(destination === "/dashboard" ? "Sign-in complete. Opening your workspace…" : "Sign-in complete. Opening the right KSI access path…");
      window.location.replace(destination);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => enterWorkspace(session));

    void supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || completed) return;
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        enterWorkspace(data.session);
      })
      .catch((caught) => {
        if (!active || completed) return;
        setError(caught instanceof Error ? caught.message : "The sign-in session could not be completed.");
      });

    const timeout = window.setTimeout(() => {
      if (!active || completed) return;
      setError("The sign-in session did not finish in time. Return to sign in and try again.");
    }, 12_000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-sm sm:p-9">
        <div className="flex justify-center"><KaecBrand compact /></div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Secure authentication</p>
        {error ? (
          <>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Sign-in needs another try</h1>
            <p className="mt-3 text-sm leading-6 text-red-700">{error}</p>
            <Link href="/sign-in" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white">Return to sign in</Link>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Opening KAEC School Intelligence</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
            <div className="mx-auto mt-6 h-2 w-40 overflow-hidden rounded-full bg-zinc-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-800" /></div>
          </>
        )}
      </div>
    </main>
  );
}
