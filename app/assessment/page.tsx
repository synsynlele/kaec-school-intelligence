import Link from "next/link";

import { WorldClassAssessmentClient } from "@/components/assessment/world-class-assessment-client";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default function AssessmentPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand compact />
          <Link
            href="/saved-work"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-stone-50"
          >
            Manage Saved Work
          </Link>
        </div>
      </div>
      <WorldClassAssessmentClient />
    </div>
  );
}
