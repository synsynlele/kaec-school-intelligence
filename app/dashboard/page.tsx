import { KaecBrand } from "@/components/branding/kaec-brand";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return <DashboardClient brand={<KaecBrand compact />} />;
}
