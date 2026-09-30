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
  "SUPPORT CUES  |  Teacher reference",
  "Teacher says / shows",
  "Central question",
  "Teacher asks",
  "Guiding questions for the first trial",
  "Task",
  "Students must",
  "Task - return to the first attempt",
  "Teacher feedback without taking ownership",
  "Expected struggle",
  "Teacher must NOT do",
  "What the teacher should look for",
  "Reflection prompts",
  "REAL LIFE ASSIGNMENT",
  "Teacher explains clearly and in detail",
  "stageHeading",
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
    pdf.includes('label: "Teacher must NOT do"') &&
    pdf.includes('label: "What the teacher should look for"'),
  "Full teaching content and the first-attempt teacher guardrails must remain visible in the classroom map.",
);

assert(
  (pdf.match(/this\.teacherFollowUpPanel\(\[/g) ?? []).length === 7 &&
    pdf.includes("this.addStage(stage)") &&
    !pdf.includes("const previousPage = [...this.current]") &&
    pdf.includes("const schoolX = 108"),
  "Each stage needs compact support cues, stages should follow each other without page-sized gaps, and the fallback header must not overlap the school name.",
);

assert(
  pdf.includes("this.ensure(leading + gapAfter)") &&
    !pdf.includes("wrapped.length * leading"),
  "Long HQLS text must paginate line-by-line instead of overflowing a single PDF page.",
);

console.log(
  "HQLS PDF teacher-focus verification passed: complete teaching note and the seven-stage classroom map remain intact.",
);
