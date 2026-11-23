import Link from "next/link";
import { FiBookOpen, FiDownload, FiLogOut, FiUsers } from "react-icons/fi";

export function LearningPortalHeader({ viewer, onSignOut }: {
  viewer: "parent" | "learner";
  onSignOut: () => Promise<void>;
}) {
  const parent = viewer === "parent";
  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-bold tracking-tight text-slate-900">KSI <span className="font-medium text-slate-600">Learning</span></Link>
        <button type="button" onClick={() => void onSignOut()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100">
          <FiLogOut aria-hidden="true" /> Sign out
        </button>
      </div>
      <div className={`relative isolate overflow-hidden rounded-3xl px-6 py-8 text-white shadow-lg shadow-slate-900/10 sm:px-9 sm:py-10 ${parent ? "bg-gradient-to-br from-slate-950 to-teal-900" : "bg-gradient-to-br from-indigo-950 to-indigo-700"}`}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 -z-10 h-80 w-80 rounded-full border border-white/20 bg-white/10 ring-[28px] ring-white/5" />
        <div aria-hidden="true" className="mb-5 grid size-11 place-items-center rounded-2xl border border-white/25 bg-white/10 text-xl">
          {parent ? <FiUsers /> : <FiBookOpen />}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{parent ? "Family dashboard" : "My learning"}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
          {parent ? "Find your learners’ school-published results, term reports and approved diagnoses." : "See what’s assigned, take assessments and check your results."}
        </p>
        <nav aria-label={parent ? "Family dashboard shortcuts" : "Learning dashboard shortcuts"} className="mt-5 flex flex-wrap gap-2">
          {!parent && <a href="#assessments" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-indigo-950">
            <FiBookOpen aria-hidden="true" /> Assessments
          </a>}
          <a href="#published-results" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/15">
            <FiDownload aria-hidden="true" /> {parent ? "Reports and results" : "Published results"}
          </a>
        </nav>
      </div>
    </header>
  );
}
