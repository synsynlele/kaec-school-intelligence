import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const setup = await readFile(
  join(ROOT, "components/workspace/academic-setup-client.tsx"),
  "utf8",
);
const hqls = await readFile(
  join(ROOT, "components/hqls/hqls-client.tsx"),
  "utf8",
);
const assessment = await readFile(
  join(ROOT, "components/assessment/world-class-assessment-client.tsx"),
  "utf8",
);
const bridge = await readFile(
  join(ROOT, "components/hqls/scheme-prefill-bridge.tsx"),
  "utf8",
);
const academic = await readFile(
  join(ROOT, "lib/domain/academic-context.ts"),
  "utf8",
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const required of [
  "isTemporaryClassLabel",
  "classNameValidationMessage",
  "entering|incoming|prospective",
]) {
  assert(
    academic.includes(required),
    `Academic class validation requirement missing: ${required}`,
  );
}

for (const required of [
  "academic-record-editor",
  "revealEditor",
  "classNameValidationMessage(className)",
  'classNameValidationMessage(editing.name)',
  "Needs rename — use the actual class name",
]) {
  assert(
    setup.includes(required),
    `Academic Setup edit/validation requirement missing: ${required}`,
  );
}

assert(
  hqls.includes('id="hqls-subject"') &&
    hqls.includes('id="hqls-class"') &&
    hqls.includes("<select") &&
    !hqls.includes('list="hqls-subjects"') &&
    !hqls.includes('list="hqls-classes"'),
  "HQLS subject and class must use real setup-backed selects rather than datalist text entry.",
);

assert(
  hqls.includes("!isTemporaryClassLabel(item.name)"),
  "Temporary/non-operational class labels must be excluded from HQLS class choices.",
);

assert(
  assessment.includes('label="Subject"') &&
    assessment.includes('label="Class"') &&
    assessment.includes("subjectMatch?.id") &&
    assessment.includes("classMatch?.id") &&
    !assessment.includes('list="assessment-v11-subjects"') &&
    !assessment.includes('list="assessment-v11-classes"'),
  "Assessment subject and class must use setup-backed select records.",
);

assert(
  assessment.includes("!isTemporaryClassLabel(item.name)"),
  "Temporary/non-operational class labels must be excluded from Assessment class choices.",
);

assert(
  bridge.includes('querySelector<HTMLSelectElement>("#hqls-subject")') &&
    bridge.includes('querySelector<HTMLSelectElement>("#hqls-class")') &&
    bridge.includes("selectOptionByLabel"),
  "Scheme-to-HQLS prefill must remain compatible with setup-backed selects.",
);

console.log(
  "Academic setup linkage verification passed: editable setup records, valid operational class names, and setup-backed HQLS/Assessment dropdowns are enforced.",
);
