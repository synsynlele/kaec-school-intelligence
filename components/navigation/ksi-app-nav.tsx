"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Role = "owner" | "admin" | "leader" | "teacher" | "student";
type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };
type LiveWorkspaceAccess = {
  name?: string | null;
  workspace_type?: string | null;
  access_status?: string | null;
};

const HIDDEN_PREFIXES = [
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

function isCurrent(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role: Role | null) {
  if (role === "owner") return "School Owner";
  if (role === "admin") return "School Admin";
  if (role === "leader") return "School Leader";
  if (role === "teacher") return "Teacher";
  return "School workspace";
}

export function KsiAppNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [schoolActive, setSchoolActive] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("School workspace");

  useEffect(() => {
    if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || pathname === "/") return;
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [{ data: profile }, { data: platformAdminRow }] = await Promise.all([
        supabase
          .from("profiles")
          .select("default_workspace_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_access_admins")
          .select("active")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setPlatformAdmin(Boolean(platformAdminRow?.active));

      if (!profile?.default_workspace_id) {
        setRole(null);
        setSchoolActive(false);
        setWorkspaceName("School workspace");
        return;
      }

      const [membershipResult, workspaceResult] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("role,status")
          .eq("workspace_id", profile.default_workspace_id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("workspaces")
          .select("name,workspace_type,access_status")
          .eq("id", profile.default_workspace_id)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const workspace = workspaceResult.data as LiveWorkspaceAccess | null;
      const isActiveSchool =
        workspace?.workspace_type === "school" &&
        workspace?.access_status === "active" &&
        membershipResult.data?.status === "active";

      setSchoolActive(Boolean(isActiveSchool));
      setRole(isActiveSchool ? (membershipResult.data?.role as Role) : null);
      setWorkspaceName(workspace?.name || "School workspace");
    };

    void load();
    const reload = () => void load();
    window.addEventListener("ksi-workspace-change", reload);
    return () => {
      cancelled = true;
      window.removeEventListener("ksi-workspace-change", reload);
    };
  }, [pathname]);

  const groups = useMemo<NavGroup[]>(() => {
    const schoolGroups: NavGroup[] = [];

    if (schoolActive && role && role !== "student") {
      const home = { href: "/dashboard", label: "Home" };
      const teaching: NavItem[] = [
        { href: "/teacher/resources", label: "Resources" },
        { href: "/hqls", label: "HQLS" },
        { href: "/assessment", label: "Assess" },
        { href: "/diagnosis", label: "Diagnose" },
        { href: "/saved-work", label: "Saved" },
      ];

      if (role === "teacher") {
        schoolGroups.push(
          { label: "Teacher workspace", items: [home] },
          { label: "Teaching workflow", items: teaching },
        );
      } else {
        const leadership: NavItem[] = [
          { href: "/leadership", label: "Learning Health" },
          { href: "/interventions", label: "Interventions" },
          { href: "/teacher/resources", label: "Resources" },
        ];

        if (role === "leader") {
          schoolGroups.push(
            { label: "Leadership workspace", items: [home] },
            { label: "Learning intelligence", items: leadership },
          );
        } else {
          schoolGroups.push(
            { label: "Leadership workspace", items: [home] },
            { label: "Teaching & learning", items: teaching },
            {
              label: "Learning intelligence",
              items: leadership.filter((item) => item.href !== "/teacher/resources"),
            },
            {
              label: "School administration",
              items: [
                { href: "/setup", label: "Setup" },
                { href: "/setup/staff-access", label: "Staff" },
              ],
            },
          );
        }
      }
    }

    if (platformAdmin) {
      schoolGroups.push({
        label: "KAEC platform",
        items: [{ href: "/admin/schools", label: "Super Admin" }],
      });
    }

    return schoolGroups;
  }, [platformAdmin, role, schoolActive]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return groups.flatMap((group) => group.items).filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [groups]);

  useEffect(() => {
    if (items.length) document.body.classList.add("ksi-school-nav-active");
    else document.body.classList.remove("ksi-school-nav-active");
    return () => document.body.classList.remove("ksi-school-nav-active");
  }, [items.length]);

  if (
    pathname === "/" ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    items.length === 0
  ) {
    return null;
  }

  const contextName = schoolActive ? workspaceName : platformAdmin ? "KAEC-NG Platform" : workspaceName;
  const contextRole = schoolActive ? roleLabel(role) : platformAdmin ? "Super Admin" : roleLabel(role);

  return (
    <>
      <aside
        aria-label="KSI desktop navigation"
        className="ksi-desktop-nav fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-emerald-950/10 bg-[#f8faf7] px-4 py-5 shadow-[10px_0_35px_rgba(18,48,35,0.04)] lg:flex"
      >
        <div className="px-2"><KaecBrand compact /></div>
        <div className="mt-5 rounded-2xl border border-emerald-950/10 bg-white p-3.5">
          <p className="truncate text-sm font-bold text-zinc-950">{contextName}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-800">{contextRole}</p>
        </div>

        <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pb-5" aria-label="KSI workspace sections">
          {groups.map((group) => (
            <section key={group.label}>
              <p className="px-2 text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-400">{group.label}</p>
              <div className="mt-2 grid gap-1">
                {group.items.map((item) => {
                  const current = isCurrent(pathname, item.href);
                  return (
                    <Link
                      key={`${group.label}:${item.href}`}
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        current
                          ? "bg-emerald-950 text-white shadow-sm"
                          : "text-zinc-650 hover:bg-white hover:text-zinc-950"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <p className="border-t border-zinc-200 px-2 pt-4 text-[11px] leading-5 text-zinc-400">
          KAEC School Intelligence<br />Teacher + Leadership OS
        </p>
      </aside>

      <nav
        aria-label="KSI mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur lg:hidden"
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
    </>
  );
}
