"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveKsiRuntimeAccess } from "@/lib/supabase/runtime-access";

const AUTH_ENTRY_KEY = "ksi:auth:entryRole";
const AUTH_RETURN_KEY = "ksi:auth:returnTo";

type EntryRole = "owner" | "teacher";

function requestedEntry(): EntryRole | null {
  const search = new URLSearchParams(window.location.search);
  const queryEntry = search.get("entry");
  if (queryEntry === "owner" || queryEntry === "teacher") return queryEntry;

  const stored = window.sessionStorage.getItem(AUTH_ENTRY_KEY);
  if (stored === "owner" || stored === "teacher") return stored;
  return null;
}

function inferredEntryFromAccount(
  memberships: Array<{ member_role: string; member_status: string }>,
  metadataRole: unknown,
): EntryRole | null {
  if (memberships.some((membership) => membership.member_role === "owner")) return "owner";
  if (memberships.some((membership) => ["admin", "leader", "teacher"].includes(membership.member_role))) {
    return "teacher";
  }
  if (metadataRole === "owner" || metadataRole === "teacher") return metadataRole;
  return null;
}

export function AuthResolverClient() {
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async () => {
    setError(null);
    try {
      const access = await resolveKsiRuntimeAccess(getBrowserSupabaseClient(), { force: true });
      if (!access) {
        window.location.replace("/sign-in");
        return;
      }

      if (access.activeSchool) {
        window.sessionStorage.removeItem(AUTH_RETURN_KEY);
        window.location.replace("/dashboard");
        return;
      }

      const entry =
        requestedEntry() ??
        inferredEntryFromAccount(access.memberships, access.user.user_metadata?.ksi_entry_role);

      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      if (entry === "owner") {
        window.location.replace("/owner/access");
        return;
      }
      if (entry === "teacher") {
        window.location.replace("/teacher/join");
        return;
      }

      window.location.replace("/sign-in");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "KSI could not resolve your account access. Retry without signing in again.",
      );
    }
  }, []);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-sm sm:p-9">
        <div className="flex justify-center"><KaecBrand compact /></div>
        {error ? (
          <>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Access check interrupted</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Your account is still signed in.</h1>
            <p className="mt-3 text-sm leading-6 text-red-700">{error}</p>
            <button type="button" onClick={() => void resolve()} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white">
              Retry access check
            </button>
            <div className="mt-4"><Link href="/sign-in" className="text-sm font-semibold text-zinc-600">Use another account</Link></div>
          </>
        ) : (
          <>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Secure KSI access</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Opening the right workspace…</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">KSI is checking your governed school membership before deciding whether onboarding is needed.</p>
            <div className="mx-auto mt-6 h-2 w-40 overflow-hidden rounded-full bg-zinc-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-800" /></div>
          </>
        )}
      </div>
    </main>
  );
}
