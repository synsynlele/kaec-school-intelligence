"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOpen = mobileMenuPath === pathname;

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

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuPath(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const groups = useMemo<NavGroup[]>(() => {
    const schoolGroups: NavGroup[] = [];
    const studentWorkspaceRetired = role === "student";

    if (schoolActive && role && !studentWorkspaceRetired) {
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

      <button
        type="button"
        aria-label="Open KSI navigation"
        aria-expanded={mobileOpen}
        aria-controls="ksi-mobile-menu"
        onClick={() => setMobileMenuPath(pathname)}
        className="fixed bottom-4 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full border border-emerald-900/15 bg-emerald-950 px-4 py-3 text-sm font-bold text-white shadow-[0_12px_35px_rgba(6,78,59,0.28)] transition active:scale-[0.98] lg:hidden"
      >
        <span aria-hidden="true" className="grid gap-1">
          <span className="block h-0.5 w-4 rounded-full bg-white" />
          <span className="block h-0.5 w-4 rounded-full bg-white" />
          <span className="block h-0.5 w-4 rounded-full bg-white" />
        </span>
        Menu
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close KSI navigation"
            onClick={() => setMobileMenuPath(null)}
            className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[2px]"
          />
          <section
            id="ksi-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="KSI mobile navigation"
            className="absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[2rem] border-t border-zinc-200 bg-[#f8faf7] shadow-[0_-24px_70px_rgba(0,0,0,0.18)]"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-zinc-300" aria-hidden="true" />
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 pb-4 pt-4">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-zinc-950">{contextName}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">{contextRole}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileMenuPath(null)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 shadow-sm"
              >
                Close
              </button>
            </header>

            <nav className="max-h-[calc(84dvh-7rem)] space-y-5 overflow-y-auto px-5 py-5" aria-label="KSI mobile menu sections">
              {groups.map((group) => (
                <section key={`mobile:${group.label}`} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-400">{group.label}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const current = isCurrent(pathname, item.href);
                      return (
                        <Link
                          key={`mobile:${group.label}:${item.href}`}
                          href={item.href}
                          onClick={() => setMobileMenuPath(null)}
                          aria-current={current ? "page" : undefined}
                          className={`min-h-12 rounded-xl px-3 py-3 text-sm font-bold transition ${
                            current
                              ? "bg-emerald-950 text-white shadow-sm"
                              : "bg-zinc-50 text-zinc-700 hover:bg-emerald-50 hover:text-emerald-950"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
              <p className="pb-4 text-center text-[11px] leading-5 text-zinc-400">
                KAEC School Intelligence · Teacher + Leadership OS
              </p>
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}
