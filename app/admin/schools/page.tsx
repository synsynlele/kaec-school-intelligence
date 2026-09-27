import Link from "next/link";

import { SchoolAccessClient } from "@/components/admin/school-access-client";
import { SchoolAccessRequests } from "@/components/admin/school-access-requests";
import { PlatformSchoolOverview } from "@/components/admin/platform-school-overview";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default function SchoolAccessAdminPage() {
  return (
    <>
      <header className="border-b border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-8 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-fit rounded-xl bg-white px-3 py-2">
            <KaecBrand compact />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              KSI Platform Administration
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">KSI Platform Overview</h1>
            <p className="mt-1 max-w-3xl text-sm text-emerald-50/90">
              Monitor school activity and follow-through, then manage onboarding and access.
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

      <PlatformSchoolOverview />
      <SchoolAccessRequests />
      <SchoolAccessClient />
    </>
  );
}
