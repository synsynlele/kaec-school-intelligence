import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <div className="hidden" aria-hidden="true">
        <KaecBrand compact />
        <span>School Intelligence Workspace</span>
        <Link href="/hqls">HQLS Lessons</Link>
        <Link href="/assessment">Assessments</Link>
        <Link href="/diagnosis">Diagnosis</Link>
        <Link href="/interventions">Interventions</Link>
      </div>
      <DashboardClient />
    </>
  );
}
