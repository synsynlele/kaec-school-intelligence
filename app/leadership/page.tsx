import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { CurriculumRiskIntelligencePanel } from "@/components/leadership/curriculum-risk-intelligence-panel";
import { DeliveryIntelligencePanel } from "@/components/leadership/delivery-intelligence-panel";
import { LeadershipHomeClient } from "@/components/leadership/leadership-home-client";
import { MasteryIntelligencePanel } from "@/components/leadership/mastery-intelligence-panel";

export default function LeadershipKsiPage() {
  return (
    <>
      <header className="border-b border-emerald-900/10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <KaecBrand compact />
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
          >
            Teacher KSI
          </Link>
        </div>
      </header>
      <LeadershipHomeClient />
      <DeliveryIntelligencePanel />
      <MasteryIntelligencePanel />
      <CurriculumRiskIntelligencePanel />
    </>
  );
}
