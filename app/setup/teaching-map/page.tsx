import { TeachingMapClient } from "@/components/workspace/teaching-map-client";

export default async function TeachingMapPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string | string[] }>;
}) {
  const { staff } = await searchParams;
  const initialStaffId = typeof staff === "string" ? staff : undefined;
  return <TeachingMapClient key={initialStaffId} initialStaffId={initialStaffId} />;
}
