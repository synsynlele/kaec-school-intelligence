import Link from "next/link";

import { FamilyAccessManager } from "@/components/workspace/family-access-manager";

export default function FamilyAccessPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-8">
      <Link href="/setup/learner-access" className="text-sm font-semibold text-emerald-900 underline">Learner access</Link>
      <h1 className="text-3xl font-bold">Family access</h1>
      <FamilyAccessManager />
    </main>
  );
}
