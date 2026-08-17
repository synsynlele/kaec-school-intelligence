import Link from "next/link";
import { Suspense } from "react";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { HqlsClient } from "@/components/hqls/hqls-client";
import { SchemePrefillBridge } from "@/components/hqls/scheme-prefill-bridge";
import { ArtifactResultRedirect } from "@/components/workflow/artifact-result-redirect";

export default function HqlsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <ArtifactResultRedirect queryKey="lesson" resultPath="/hqls/result" />
      </Suspense>
      <SchemePrefillBridge />
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 sm:px-8 md:flex-row md:items-center md:justify-between">
          <KaecBrand compact />
          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/resources" className="inline-flex w-fit items-center justify-center rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">Academic Resources</Link>
            <Link href="/saved-work" className="inline-flex w-fit items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-stone-50">Saved Work</Link>
            <Link href="/hqls/exports" className="inline-flex w-fit items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-stone-50">Lesson PDFs</Link>
          </div>
        </div>
      </div>
      <HqlsClient />
    </>
  );
}
