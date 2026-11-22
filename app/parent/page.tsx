import Link from "next/link";

import { ParentPortal } from "@/components/student/parent-portal";

export default function ParentPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-8">
      <Link href="/sign-in" className="text-sm font-semibold text-emerald-900 underline">Back to KSI sign-in</Link>
      <h1 className="text-3xl font-bold">Parent portal</h1>
      <ParentPortal />
    </main>
  );
}
