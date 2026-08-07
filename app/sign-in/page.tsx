import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="w-fit">
            <KaecBrand compact />
          </Link>
          <Link
            href="/"
            className="w-fit text-sm font-medium text-zinc-600 transition hover:text-zinc-950"
          >
            ← Back to KAEC School Intelligence
          </Link>
        </div>

        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Design → Assess → Diagnose → Improve
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
              Academic intelligence built around how humans actually learn.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-600">
              One secure workspace for HQLS lessons, aligned assessments and
              evidence-based student diagnosis.
            </p>
          </section>

          <div className="flex justify-center lg:justify-end">
            <AuthForm />
          </div>
        </div>
      </div>
    </main>
  );
}
