import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const source = await readFile(join(ROOT, "lib/pdf/hqls-lesson-pdf.ts"), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const required of [
  'import { HQLS_STAGES } from "@/lib/domain/hqls"',
  "HQLS_STAGES[stage.stageNumber - 1]",
  "Supporting notes",
  "Expected learner outcome",
  "Guardrail",
  "Evidence to notice",
  "Productive struggle",
  "supportBox(",
  "conciseFullIllumination",
  "FULL_ILLUMINATION_PDF_MAX_CHARS",
]) {
  assert(source.includes(required), `HQLS PDF teacher layout is missing: ${required}`);
}

assert(
  !source.includes('this.line("Expected learner actions"') &&
    !source.includes('this.line("Guide Guardrails - what the teacher must not do"'),
  "Supporting HQLS guidance should be compacted into the supporting-notes box, not rendered as competing primary sections.",
);

assert(
  source.includes('definition?.title ?? stage.title') &&
    source.includes('definition?.purpose ?? stage.purpose'),
  "The PDF must prefer the canonical HQLS stage name and purpose over generated labels.",
);

console.log(
  "HQLS PDF teacher-layout verification passed: canonical stages, concise Full Illumination, and compact supporting guidance are enforced.",
);
