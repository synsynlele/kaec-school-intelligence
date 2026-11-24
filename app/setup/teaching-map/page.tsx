import { TeachingMapClient } from "@/components/workspace/teaching-map-client";

export default async function TeachingMapPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string | string[]; class?: string | string[] }>;
}) {
  const { staff, class: classroom } = await searchParams;
  const initialStaffId = typeof staff === "string" ? staff : undefined;
  const initialClassId = typeof classroom === "string" ? classroom : undefined;
  return <TeachingMapClient key={`${initialStaffId ?? ""}:${initialClassId ?? ""}`} initialStaffId={initialStaffId} initialClassId={initialClassId} />;
}
