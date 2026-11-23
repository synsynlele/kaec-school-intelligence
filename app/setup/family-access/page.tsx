import Link from "next/link";

import { FamilyAccessManager } from "@/components/workspace/family-access-manager";

export default function FamilyAccessPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-5 py-10 sm:px-8">
      <header className="ksi-workspace-banner p-5 sm:p-7">
        <Link href="/setup/learner-access" className="text-sm font-semibold text-emerald-900">← Learner access</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">Family access</h1>
      </header>
      <FamilyAccessManager />
    </main>
  );
}
