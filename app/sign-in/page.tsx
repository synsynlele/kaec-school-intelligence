import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="w-fit"><KaecBrand compact /></Link>
          <Link href="/" className="w-fit text-sm font-semibold text-zinc-600 transition hover:text-zinc-950">← Back to KSI</Link>
        </div>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <section className="max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">KSI for teaching & school leadership</p>
            <h2 className="mt-5 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              One simple place to improve teaching and learning.
            </h2>
            <p className="mt-5 text-base leading-7 text-zinc-600">
              Teachers work from lesson planning through diagnosis and intervention. School leaders see the same learning system at class, subject and whole-school level.
            </p>

            <div className="mt-7 space-y-3 text-sm leading-6 text-zinc-600">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <strong className="text-zinc-950">School Owner:</strong> request or enter an approved school, then manage leadership, people and access.
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <strong className="text-zinc-950">Teacher / Staff:</strong> enter with your school-issued Staff Access Code. KSI automatically opens the correct Teacher or Leadership workspace for your assigned role.
              </div>
            </div>
          </section>

          <div className="flex justify-center lg:justify-end"><AuthForm /></div>
        </div>
      </div>
    </main>
  );
}
