import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { DiagnosisResultClient } from "@/components/diagnosis/diagnosis-result-client";

export default async function DiagnosisResultPage({
  searchParams,
}: {
  searchParams: Promise<{ diagnosis?: string }>;
}) {
  const { diagnosis = "" } = await searchParams;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand compact />
          <div className="flex flex-wrap gap-2">
            <Link href="/diagnosis" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800">Diagnosis Builder</Link>
            <Link href="/interventions" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800">Interventions</Link>
          </div>
        </div>
      </div>
      {diagnosis ? (
        <DiagnosisResultClient diagnosisId={diagnosis} />
      ) : (
        <main className="mx-auto max-w-3xl px-5 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Choose a saved diagnosis to open its result.</div>
        </main>
      )}
    </div>
  );
}
