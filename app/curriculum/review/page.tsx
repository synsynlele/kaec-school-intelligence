import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { SchemeReviewClient } from "@/components/curriculum/scheme-review-client";

export default function CurriculumReviewPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl bg-white px-4 py-3">
            <KaecBrand compact />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Platform Curriculum Governance
            </p>
            <p className="mt-1 text-sm font-medium">
              Human review before canonical curriculum promotion.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-300/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>
      <SchemeReviewClient />
    </>
  );
}
