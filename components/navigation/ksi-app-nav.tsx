"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Role = "owner" | "admin" | "leader" | "teacher" | "student";
type NavItem = { href: string; label: string };
type LiveWorkspaceAccess = {
  workspace_type?: string | null;
  access_status?: string | null;
};

const HIDDEN_PREFIXES = [
  "/sign-in",
  "/auth",
  "/owner/access",
  "/teacher/join",
  "/student",
];

function isCurrent(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function KsiAppNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [schoolActive, setSchoolActive] = useState(false);

  useEffect(() => {
    if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || pathname === "/") return;
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.default_workspace_id || cancelled) return;

      const [membershipResult, workspaceResult] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("role,status")
          .eq("workspace_id", profile.default_workspace_id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("workspaces")
          .select("*")
          .eq("id", profile.default_workspace_id)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      if (membershipResult.data?.status === "active") {
        setRole(membershipResult.data.role as Role);
      }
      const workspace = workspaceResult.data as unknown as LiveWorkspaceAccess | null;
      setSchoolActive(
        workspace?.workspace_type === "school" && workspace?.access_status === "active",
      );
    })();

    return () => { cancelled = true; };
  }, [pathname]);

  const items = useMemo<NavItem[]>(() => {
    if (!schoolActive || !role || role === "student") return [];
    if (role === "teacher") {
      return [
        { href: "/dashboard", label: "Home" },
        { href: "/teacher/resources", label: "Resources" },
        { href: "/hqls", label: "HQLS" },
        { href: "/assessment", label: "Assess" },
        { href: "/diagnosis", label: "Diagnose" },
        { href: "/saved-work", label: "Saved" },
      ];
    }
    return [
      { href: "/dashboard", label: "Home" },
      { href: "/leadership", label: "Learning Health" },
      { href: "/teacher/resources", label: "Resources" },
      { href: "/interventions", label: "Interventions" },
      ...(role === "owner" || role === "admin"
        ? [
            { href: "/setup", label: "Setup" },
            { href: "/setup/staff-access", label: "Staff" },
          ]
        : []),
    ];
  }, [role, schoolActive]);

  if (
    pathname === "/" ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    items.length === 0
  ) {
    return null;
  }

  return (
    <nav
      aria-label="KSI primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`min-w-fit flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-bold transition sm:text-sm ${
                current
                  ? "bg-emerald-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
