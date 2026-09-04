"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveKsiRuntimeAccess } from "@/lib/supabase/runtime-access";

const UNGATED_PREFIXES = [
  "/sign-in",
  "/auth",
  "/owner/access",
  "/teacher/join",
  "/student",
  "/admin",
  "/curriculum/review",
  "/curriculum/resources",
  "/setup/curriculum/schemes",
];

function isUngated(pathname: string) {
  return pathname === "/" || UNGATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

type GateState = "checking" | "ready" | "needs-school" | "error";

export function KsiSchoolShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ungated = isUngated(pathname);
  const [state, setState] = useState<GateState>("checking");
  const [error, setError] = useState<string | null>(null);

  const resolveAccess = useCallback(async () => {
    setState("checking");
    setError(null);

    try {
      const access = await resolveKsiRuntimeAccess(getBrowserSupabaseClient(), { force: true });
      if (!access) {
        router.replace("/sign-in");
        return;
      }
      setState(access.activeSchool ? "ready" : "needs-school");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "KSI could not confirm your school access. Retry the access check.",
      );
      setState("error");
    }
  }, [router]);

  useEffect(() => {
    if (ungated) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void resolveAccess();
    });
    return () => {
      cancelled = true;
    };
  }, [resolveAccess, ungated]);

  if (ungated) return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-center">
        <div>
          <div className="mx-auto mb-5 w-fit"><KaecBrand compact /></div>
          <p className="text-sm font-semibold text-zinc-700">Opening your school workspace…</p>
          <p className="mt-2 text-xs text-zinc-500">KSI permissions are resolved from your governed school membership.</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <KaecBrand />
          <section className="mt-10 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Access check interrupted</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Your school membership has not been removed.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
              KSI could not verify access on this attempt. A network, session or platform error is never treated as “join a school” and will never send an existing teacher back to an access code.
            </p>
            {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
            <button type="button" onClick={() => void resolveAccess()} className="mt-6 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">
              Retry access check
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (state === "needs-school") {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <KaecBrand />
          <section className="mt-10 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">School access required</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">This account is not yet linked to an active KSI school.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
              This screen appears only after KSI successfully confirms that no active governed school membership exists. Staff can join the school that invited them; school owners can continue the KAEC approval flow.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link href="/teacher/join" className="rounded-2xl bg-emerald-950 px-5 py-4 text-center text-sm font-bold text-white hover:bg-emerald-900">Join with Staff Access Code</Link>
              <Link href="/owner/access" className="rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-center text-sm font-bold text-zinc-900 hover:bg-stone-50">School Owner Access</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
