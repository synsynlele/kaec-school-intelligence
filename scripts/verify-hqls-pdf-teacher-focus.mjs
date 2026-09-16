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
  "conciseTeachingFocus",
  "supportPanel",
  "Support cues",
  "Expected learner outcome",
  "Guide guardrail",
  "Evidence to notice",
  "Productive struggle",
  "Concise teaching focus",
]) {
  assert(pdf.includes(required), `HQLS teacher-ready PDF requirement is missing: ${required}`);
}

assert(
  pdf.includes("definition.title") && !pdf.includes("STAGE ${stage.stageNumber} - ${stage.title}"),
  "PDF stage headings must use the locked HQLS stage definitions rather than generated stage titles.",
);

assert(
  pdf.includes("Math.min(6, sentences.length)") && pdf.includes("const maxChars = 900"),
  "Full Illumination PDF focus must remain deliberately concise.",
);

assert(
  pdf.includes('this.line("Core learning experience"') &&
    pdf.includes('this.line("Teacher prompts / actions"'),
  "Teacher-facing primary actions must remain visually separate from support cues.",
);

console.log(
  "HQLS PDF teacher-focus verification passed: canonical stage names, concise Full Illumination, and compact support cues are enforced in the PDF renderer.",
);
