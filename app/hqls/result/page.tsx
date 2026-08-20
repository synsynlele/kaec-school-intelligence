import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { HqlsDownloadButton } from "@/components/hqls/hqls-download-button";
import { HqlsResultClient } from "@/components/hqls/hqls-result-client";

export default async function HqlsResultPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson = "" } = await searchParams;

  return (
    <div className="ksi-hqls-result-document min-h-screen bg-stone-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <KaecBrand compact />
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Teacher lesson document</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {lesson ? <HqlsDownloadButton lessonId={lesson} /> : null}
            <Link href="/hqls" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800">HQLS Builder</Link>
            <Link href="/saved-work" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800">Saved Work</Link>
          </div>
        </div>
      </div>
      {lesson ? (
        <HqlsResultClient lessonId={lesson} />
      ) : (
        <main className="mx-auto max-w-3xl px-5 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Choose a saved HQLS lesson to open its result.</div>
        </main>
      )}
    </div>
  );
}
