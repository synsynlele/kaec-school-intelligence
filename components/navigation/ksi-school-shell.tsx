"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

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

type GateState = "checking" | "ready" | "needs-school";

export function KsiSchoolShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ungated = isUngated(pathname);
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    if (ungated) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setState("checking");
    });

    void (async () => {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("default_workspace_id")
            .eq("id", user.id)
            .single(),
          supabase
            .from("workspace_members")
            .select("workspace_id,role,status")
            .eq("user_id", user.id)
            .eq("status", "active"),
        ]);
      if (profileError) throw profileError;
      if (membershipError) throw membershipError;

      const memberWorkspaceIds = [...new Set((memberships ?? []).map((row) => row.workspace_id))];
      if (!memberWorkspaceIds.length) {
        if (!cancelled) setState("needs-school");
        return;
      }

      const { data: workspaces, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id,name,workspace_type,access_status")
        .in("id", memberWorkspaceIds);
      if (workspaceError) throw workspaceError;

      const activeSchools = (workspaces ?? []).filter(
        (workspace) => workspace.workspace_type === "school" && workspace.access_status === "active",
      );
      if (!activeSchools.length) {
        if (!cancelled) setState("needs-school");
        return;
      }

      const currentIsSchool = activeSchools.some(
        (workspace) => workspace.id === profile.default_workspace_id,
      );
      if (!currentIsSchool) {
        const preferred = activeSchools[0];
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ default_workspace_id: preferred.id })
          .eq("id", user.id);
        if (updateError) throw updateError;
        window.dispatchEvent(new Event("ksi-workspace-change"));
        router.refresh();
      }

      if (!cancelled) setState("ready");
    })().catch(() => {
      if (!cancelled) setState("needs-school");
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, ungated]);

  if (ungated) return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-center">
        <div>
          <div className="mx-auto mb-5 w-fit"><KaecBrand compact /></div>
          <p className="text-sm font-semibold text-zinc-700">Opening your school workspace…</p>
          <p className="mt-2 text-xs text-zinc-500">KSI permissions are resolved from your active school membership.</p>
        </div>
      </div>
    );
  }

  if (state === "needs-school") {
    return (
      <main className="min-h-screen bg-stone-50 px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <KaecBrand />
          <section className="mt-10 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">School access required</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">KSI now operates inside governed school workspaces.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
              Personal workspaces do not carry School Owner, Admin, Leader or Teacher authority. Join the school that invited you, or use the School Owner path if your school is being provisioned on KSI.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link href="/teacher/join" className="rounded-2xl bg-emerald-950 px-5 py-4 text-center text-sm font-bold text-white hover:bg-emerald-900">
                Join with Staff Access Code
              </Link>
              <Link href="/owner/access" className="rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-center text-sm font-bold text-zinc-900 hover:bg-stone-50">
                School Owner Access
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
