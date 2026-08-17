import Link from "next/link";

import { SchoolAccessClient } from "@/components/admin/school-access-client";
import { SchoolAccessRequests } from "@/components/admin/school-access-requests";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default function SchoolAccessAdminPage() {
  return (
    <>
      <header className="border-b border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl bg-white px-4 py-3">
            <KaecBrand compact />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              KSI Platform Administration
            </p>
            <h1 className="mt-1 text-2xl font-bold">School Access Control</h1>
            <p className="mt-1 max-w-3xl text-sm text-emerald-50/90">
              Review owner requests, provision schools and control Active / Paused / Blocked / Disabled access without deleting learning data.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            Back to KSI
          </Link>
        </div>
      </header>

      <SchoolAccessRequests />
      <SchoolAccessClient />
    </>
  );
}
