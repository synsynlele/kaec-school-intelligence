import Link from "next/link";

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <div className="sticky top-0 z-50 border-b border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Stage 2 active
            </p>
            <p className="mt-1 text-sm font-medium">
              HQLS Lesson Intelligence is ready for live testing.
            </p>
          </div>
          <Link
            href="/hqls"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50"
          >
            Open HQLS Lesson Intelligence
          </Link>
        </div>
      </div>

      <DashboardClient />

      <nav className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2 sm:bottom-7 sm:right-7">
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
