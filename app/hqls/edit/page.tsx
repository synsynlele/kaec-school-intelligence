import Link from "next/link";

import { KsiBrand } from "@/components/branding/ksi-brand";
import { HqlsClient } from "@/components/hqls/hqls-client";

export default async function HqlsEditPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;
  if (!lesson) {
    return <main className="mx-auto max-w-3xl p-8">Choose a lesson from <Link className="font-semibold text-emerald-800" href="/saved-work">Saved Work</Link> to edit.</main>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <KsiBrand compact />
          <div className="flex gap-3 text-sm font-semibold text-emerald-900">
            <Link href={`/hqls/result?lesson=${encodeURIComponent(lesson)}`}>View lesson</Link>
            <Link href="/saved-work">Saved Work</Link>
          </div>
        </div>
      </nav>
      <HqlsClient editorOnly />
    </div>
  );
}
