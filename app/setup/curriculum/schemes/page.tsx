import { SchemeSourceRepairClient } from "@/components/curriculum/scheme-source-repair-client";
import { SchemeReviewClient } from "@/components/curriculum/scheme-review-client";

export default function SchemeIngestionPage() {
  return (
    <>
      <SchemeSourceRepairClient />
      <SchemeReviewClient />
    </>
  );
}
