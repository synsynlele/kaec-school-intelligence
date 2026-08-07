import Link from "next/link";

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <DashboardClient />
      <nav className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2 sm:bottom-7 sm:right-7">
        <Link
          href="/hqls"
          className="rounded-2xl border border-emerald-800/15 bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-800"
        >
          Create HQLS Lesson
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
