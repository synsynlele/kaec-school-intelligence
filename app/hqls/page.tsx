import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { HqlsClient } from "@/components/hqls/hqls-client";

export default function HqlsPage() {
  return (
    <>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand compact />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/saved-work"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-stone-50"
            >
              Manage Saved Work
            </Link>
            <Link
              href="/hqls/exports"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
            >
              Lesson PDF Exports
            </Link>
          </div>
        </div>
      </div>
      <HqlsClient />
    </>
  );
}
