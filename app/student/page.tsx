import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { StudentHomeClient } from "@/components/student/student-home-client";

export default function StudentKsiPage() {
  return (
    <>
      <header className="border-b border-emerald-900/10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <KaecBrand compact />
          <nav className="flex flex-wrap gap-2">
            <Link
              href="/student/learning"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950"
            >
              My Learning
            </Link>
            <Link
              href="/student/mastery"
              className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-semibold text-white"
            >
              My Mastery
            </Link>
            <Link
              href="/sign-in"
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
            >
              Account
            </Link>
          </nav>
        </div>
      </header>
      <StudentHomeClient />
    </>
  );
}
