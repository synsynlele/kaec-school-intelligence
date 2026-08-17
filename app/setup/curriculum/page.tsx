import { CurriculumResourceShortcut } from "@/components/curriculum/curriculum-resource-shortcut";
import { CurriculumIntelligenceClient } from "@/components/workspace/curriculum-intelligence-client";

export default function CurriculumIntelligencePage() {
  return (
    <>
      <CurriculumResourceShortcut />
      <CurriculumIntelligenceClient />
    </>
  );
}
