import { SchemeSourceRepairClient } from "@/components/curriculum/scheme-source-repair-client";
import { SchemeIngestionClient } from "@/components/workspace/scheme-ingestion-client";

export default function SchemeIngestionPage() {
  return (
    <>
      <SchemeSourceRepairClient />
      <SchemeIngestionClient />
    </>
  );
}
