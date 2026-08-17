import Link from "next/link";

import { StudentAccessManager } from "@/components/workspace/student-access-manager";

export default function StudentAccessPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-950">People access</p>
            <p className="mt-1 text-xs leading-5 text-emerald-900">Student codes link learner records. Teacher/Staff codes connect authorised school staff.</p>
          </div>
          <Link href="/setup/staff-access" className="w-fit rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">Manage Staff Access</Link>
        </div>
      </div>
      <StudentAccessManager />
    </>
  );
}
