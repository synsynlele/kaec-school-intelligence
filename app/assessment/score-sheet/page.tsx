import Link from "next/link";

import { LearningScoreSheet } from "@/components/assessment/learning-score-sheet";

export default async function ScoreSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string; from?: string }>;
}) {
  const { assessment, from } = await searchParams;

  const cbt = from === "cbt";
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
      <Link className="font-semibold text-emerald-900 underline" href={cbt ? "/assessment/cbt" : assessment
        ? `/assessment/result?assessment=${encodeURIComponent(assessment)}`
        : "/saved-work"}>
        Back to {cbt ? "Manage CBT" : assessment ? "assessment" : "saved work"}
      </Link>
      <h1 className="text-3xl font-bold">{cbt ? "CBT learner attempts" : "Assessment score sheet"}</h1>
      {assessment ? <LearningScoreSheet assessmentId={assessment} cbtManagement={cbt} /> : <p>Choose a saved assessment.</p>}
    </main>
  );
}
