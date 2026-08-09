import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { InterventionWorkspaceClient } from "@/components/interventions/intervention-workspace-client";

export default function InterventionsPage() {
  return (
    <>
      <div className="sticky top-0 z-50 border-b border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl bg-white px-4 py-3"><KaecBrand compact /></div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Action & Intervention</p>
            <p className="mt-1 text-sm font-medium">Create plans here. Review, confirm and manage each intervention on its own result page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/interventions/next-lesson" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50">Build Next Lesson</Link>
            <Link href="/diagnosis" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900">Diagnosis</Link>
            <Link href="/hqls" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900">HQLS Lessons</Link>
            <Link href="/dashboard" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900">Dashboard</Link>
          </div>
        </div>
      </div>
      <InterventionWorkspaceClient />
    </>
  );
}
