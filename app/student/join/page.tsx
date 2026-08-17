import Link from "next/link";

import { StudentJoinClient } from "@/components/student/student-join-client";

export default function StudentJoinPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="text-sm font-bold text-emerald-950">
          KAEC School Intelligence
        </Link>
        <Link href="/sign-in" className="text-sm font-semibold text-zinc-600">
          Sign in
        </Link>
      </header>
      <StudentJoinClient />
    </div>
  );
}
