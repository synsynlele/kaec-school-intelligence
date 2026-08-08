import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { SavedWorkClient } from "@/components/saved-work/saved-work-client";

export default function SavedWorkPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand compact />
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              href="/dashboard"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-zinc-700 transition hover:bg-stone-50"
            >
              Dashboard
            </Link>
            <Link
              href="/hqls"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-zinc-700 transition hover:bg-stone-50"
            >
              HQLS Lessons
            </Link>
            <Link
              href="/assessment"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-zinc-700 transition hover:bg-stone-50"
            >
              Assessments
            </Link>
          </nav>
        </div>
      </div>
      <SavedWorkClient />
    </div>
  );
}
