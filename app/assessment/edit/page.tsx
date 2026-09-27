import Link from "next/link";

import { WorldClassAssessmentClient } from "@/components/assessment/world-class-assessment-client";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default async function AssessmentEditPage({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string }>;
}) {
  const { assessment } = await searchParams;
  if (!assessment) {
    return <main className="mx-auto max-w-3xl p-8">Choose an assessment from <Link className="font-semibold text-emerald-800" href="/saved-work">Saved Work</Link> to edit.</main>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <KaecBrand compact />
          <div className="flex gap-3 text-sm font-semibold text-emerald-900">
            <Link href={`/assessment/result?assessment=${encodeURIComponent(assessment)}`}>View assessment</Link>
            <Link href="/saved-work">Saved Work</Link>
          </div>
        </div>
      </nav>
      <WorldClassAssessmentClient editorOnly />
    </div>
  );
}
