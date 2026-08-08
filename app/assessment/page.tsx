import { WorldClassAssessmentClient } from "@/components/assessment/world-class-assessment-client";
import { KaecBrand } from "@/components/branding/kaec-brand";

export default function AssessmentPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
          <KaecBrand compact />
        </div>
      </div>
      <WorldClassAssessmentClient />
    </div>
  );
}
