import Link from "next/link";

import { LearningScoreSheet } from "@/components/assessment/learning-score-sheet";

export default async function ScoreSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string }>;
}) {
  const { assessment } = await searchParams;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
      <Link className="font-semibold text-emerald-900 underline" href={assessment
        ? `/assessment/result?assessment=${encodeURIComponent(assessment)}`
        : "/saved-work"}>
        Back to {assessment ? "assessment" : "saved work"}
      </Link>
      <h1 className="text-3xl font-bold">Class score sheet</h1>
      {assessment ? <LearningScoreSheet assessmentId={assessment} /> : <p>Choose a saved assessment.</p>}
    </main>
  );
}
