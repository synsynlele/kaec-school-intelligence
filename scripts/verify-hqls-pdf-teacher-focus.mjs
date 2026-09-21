import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const pdf = await readFile(join(ROOT, "lib/pdf/hqls-lesson-pdf.ts"), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const required of [
  'import { HQLS_STAGES } from "@/lib/domain/hqls"',
  "canonicalStageDefinition",
  "detailSection",
  "teachingNote",
  "teacherFollowUpPanel",
  "Teacher follow-up guide",
  "What happens in this stage",
  "What the teacher says or does",
  "What learners should do",
  "Expected struggle",
  "What the teacher must not do",
  "What the teacher should look for",
  "Reflection questions",
  "Real-life follow-up / transfer task",
  "Full Illumination - complete teaching note",
  "this.teachingNote(stage.teachingContent)",
]) {
  assert(
    pdf.includes(required),
    `HQLS teacher-ready PDF requirement is missing: ${required}`,
  );
}

assert(
  pdf.includes("definition.title") &&
    !pdf.includes("STAGE ${stage.stageNumber} - ${stage.title}"),
  "PDF stage headings must use the locked HQLS stage definitions rather than generated stage titles.",
);

assert(
  !pdf.includes("conciseTeachingFocus") &&
    !pdf.includes("trimPdfText(stage.teachingContent") &&
    !pdf.includes("compactSupportValue"),
  "HQLS PDF must not truncate Full Illumination or shorten teacher follow-up guidance.",
);

assert(
  pdf.includes("this.teachingNote(stage.teachingContent)") &&
    pdf.includes("this.teacherFollowUpPanel([") &&
    pdf.includes('label: "Expected struggle"') &&
    pdf.includes('label: "What the teacher must not do"') &&
    pdf.includes('label: "What the teacher should look for"'),
  "Full lesson content must remain prominent while teacher drift-check guidance is grouped in the compact follow-up box.",
);

assert(
  pdf.includes("this.ensure(leading + gapAfter)") &&
    !pdf.includes("wrapped.length * leading"),
  "Long HQLS text must paginate line-by-line instead of overflowing a single PDF page.",
);

console.log(
  "HQLS PDF teacher-focus verification passed: complete Full Illumination and plain-English lesson instructions stay prominent while teacher drift-check guidance is grouped in a compact follow-up box.",
);
