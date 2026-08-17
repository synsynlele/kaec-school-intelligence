import { KaecBrand } from "@/components/branding/kaec-brand";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <div className="hidden" aria-hidden="true">
        <KaecBrand compact />
      </div>
      <DashboardClient />
    </>
  );
}
