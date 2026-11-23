import { AcademicSetupClient } from "@/components/workspace/academic-setup-client";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string | string[] }>;
}) {
  const { student } = await searchParams;
  return <AcademicSetupClient key={typeof student === "string" ? student : undefined}
    initialStudentId={typeof student === "string" ? student : undefined} />;
}
