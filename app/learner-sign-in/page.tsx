import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function LearnerSignInPage() {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <Link href="/sign-in" className="text-sm font-semibold text-emerald-900 underline">Back to KSI sign-in</Link>
      <AuthForm learnerOnly />
    </main>
  );
}
