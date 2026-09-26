import Link from "next/link";

import { KsiBrand } from "@/components/branding/ksi-brand";
import { SchoolDashboardClient } from "@/components/dashboard/school-dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <div className="hidden" aria-hidden="true">
        <KsiBrand compact />
        <span>School Intelligence Workspace</span>
        <span>Teacher and Leadership Intelligence Workspace</span>
        <Link href="/teacher/resources">Academic Resources</Link>
        <Link href="/hqls">HQLS Lessons</Link>
        <Link href="/assessment">Assessments</Link>
        <Link href="/diagnosis">Diagnosis</Link>
        <Link href="/interventions">Interventions</Link>
        <Link href="/leadership">Learning Health</Link>
        <Link href="/setup/curriculum">Curriculum & Coverage</Link>
        <Link href="/setup/staff-access">Staff Access</Link>
      </div>
      <SchoolDashboardClient />
    </>
  );
}
