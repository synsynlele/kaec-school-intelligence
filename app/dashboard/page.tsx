import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <div className="sticky top-0 z-50 border-b border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl bg-white px-4 py-3">
            <KaecBrand compact />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              School Intelligence Workspace
            </p>
            <p className="mt-1 text-sm font-medium">
              Teach with HQLS, assess what happened, diagnose the evidence, act on the findings, then improve the next learning cycle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/hqls"
              className="inline-flex w-fit items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50"
            >
              HQLS Lessons
            </Link>
            <Link
              href="/hqls/deliver"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Lesson Delivery
            </Link>
            <Link
              href="/assessment"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Assessments
            </Link>
            <Link
              href="/diagnosis"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Diagnosis
            </Link>
            <Link
              href="/interventions"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Interventions
            </Link>
            <Link
              href="/leadership"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Leadership
            </Link>
          </div>
        </div>
      </div>

      <DashboardClient />

      <nav className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2 sm:bottom-7 sm:right-7">
        <Link
          href="/admin/schools"
          className="rounded-2xl border border-emerald-900/20 bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-950/10 transition hover:bg-emerald-900"
        >
          School Access
        </Link>
        <Link
          href="/setup/student-access"
          className="rounded-2xl border border-emerald-900/20 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-zinc-950/5 transition hover:bg-emerald-50"
        >
          Student Access
        </Link>
        <Link
          href="/setup"
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-lg shadow-zinc-950/5 transition hover:border-zinc-400"
        >
          Academic Setup
        </Link>
        <Link
          href="/resources"
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-lg shadow-zinc-950/5 transition hover:border-zinc-400"
        >
          Resource Library
        </Link>
      </nav>
    </>
  );
}
