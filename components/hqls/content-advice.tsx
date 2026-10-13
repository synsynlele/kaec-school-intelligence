import type { HqlsAdvice } from "@/lib/hqls/advisory-review";

export function ContentAdviceSummary({ advice }: { advice: HqlsAdvice | null }) {
  if (!advice) return null;
  return <aside className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <h2 className="font-semibold">{advice.teacherReview ? "Teacher review recorded" : "Saved draft — teacher review needed"}</h2>
    <p className="mt-1">{advice.reviewStatus === "unavailable"
      ? "Automated content review was unavailable. Your lesson was saved. Check the examples, tasks and answers yourself before teaching."
      : "Review suggestions appear beside their stages. They do not stop saving and do not certify accuracy."}</p>
    {advice.stale ? <p className="mt-1">These suggestions are from the original automated review. They were not rechecked after saving.</p> : null}
    {!advice.teacherReview ? <p className="mt-1">Edit any issues, then use Save and mark reviewed. This confirmation uses no AI tokens.</p> : null}
  </aside>;
}

export function StageContentAdvice({ advice, stageNumber }: { advice: HqlsAdvice | null; stageNumber: number }) {
  const suggestions = advice?.suggestions.filter((item) => item.stageNumber === stageNumber) ?? [];
  if (!suggestions.length) return null;
  return <aside className="mt-4 space-y-2" aria-label={`Content suggestions for Stage ${stageNumber}`}>
    {suggestions.map((item, index) => <div key={index} className={`rounded-xl border p-3 text-sm ${item.priority === "correct_before_teaching" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950"}`}>
      <p className="font-semibold">{advice?.stale ? "Earlier version review note" : item.priority === "correct_before_teaching" ? "Correct before teaching" : "Suggestion"}</p>
      <p className="mt-1 whitespace-pre-wrap">{item.correction}</p>
    </div>)}
  </aside>;
}
