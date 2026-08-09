import Link from "next/link";

import { AssessmentResultClient } from "@/components/assessment/assessment-result-client";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default async function AssessmentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string }>;
}) {
  const { assessment = "" } = await searchParams;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand compact />
          <div className="flex flex-wrap gap-2">
            <Link href="/assessment" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800">Assessment Builder</Link>
            <Link href="/saved-work" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800">Saved Work</Link>
          </div>
        </div>
      </div>
      {assessment ? (
        <AssessmentResultClient assessmentId={assessment} />
      ) : (
        <main className="mx-auto max-w-3xl px-5 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Choose a saved assessment to open its result.</div>
        </main>
      )}
    </div>
  );
}
