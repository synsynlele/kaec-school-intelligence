import type { HqlsAdvice } from "@/lib/hqls/advisory-review";

export function ContentAdviceSummary({ advice }: { advice: HqlsAdvice | null }) {
  if (!advice) return null;
  return <aside className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <h2 className="font-semibold">{advice.teacherReview ? "Teacher validation recorded" : "Saved draft — teacher validation required"}</h2>
    <p className="mt-1">{advice.reviewStatus === "unavailable"
      ? "Automated content review was unavailable. Your lesson was saved. Check the examples, tasks and answers yourself before teaching."
      : advice.reviewStatus === "not_run"
        ? "This older lesson has no automated content review. The teacher must check and validate it manually."
        : "Automated feedback and suggestions appear beside their stages. They do not approve, reject or certify a lesson."}</p>
    {advice.stale && advice.attempts > 0 ? <p className="mt-1">These suggestions are from the original automated review. They were not rechecked after saving.</p> : null}
    {!advice.teacherReview ? <p className="mt-1">Review the lesson yourself, edit as needed, then select Validate Lesson. This records your decision without AI tokens.</p> : null}
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
