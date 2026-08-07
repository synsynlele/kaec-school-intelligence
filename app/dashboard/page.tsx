import Link from "next/link";

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <DashboardClient />
      <Link
        href="/resources"
        className="fixed bottom-5 right-5 z-20 rounded-2xl border border-emerald-800/15 bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-800 sm:bottom-7 sm:right-7"
      >
        Resource Library
      </Link>
    </>
  );
}
