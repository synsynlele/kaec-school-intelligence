import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function tsxFiles(directory) {
  const root = join(ROOT, directory);
  const output = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith(".tsx")) output.push(path);
    }
  }
  await walk(root);
  return output;
}

const [
  openai,
  authForm,
  authCallback,
  assessmentPage,
  savedWorkPage,
  rootLayout,
  globals,
  pdfSafety,
  hqlsPdfRoute,
  assessmentPdfRoute,
  diagnosisPdfRoute,
  hqlsPdf,
  assessmentPdf,
  diagnosisPdf,
] = await Promise.all([
  text("lib/ai/openai.ts"),
  text("components/auth/auth-form.tsx"),
  text("app/auth/callback/page.tsx"),
  text("app/assessment/page.tsx"),
  text("app/saved-work/page.tsx"),
  text("app/layout.tsx"),
  text("app/globals.css"),
  text("lib/pdf/layout-safety.ts"),
  text("app/api/hqls/pdf/route.ts"),
  text("app/api/assessment/pdf/route.ts"),
  text("app/api/diagnosis/pdf/route.ts"),
  text("lib/pdf/hqls-lesson-pdf.ts"),
  text("lib/pdf/assessment-pdf.ts"),
  text("lib/pdf/diagnosis-pdf.ts"),
]);

assert(
  openai.includes('return input.schemaName?.includes("repair") ? "medium" : "low";') &&
    openai.includes("reasoning: { effort: reasoningEffort }") &&
    openai.includes("AbortSignal.timeout(timeoutMs)") &&
    openai.includes("KSI_AI_TIMING"),
  "V1 stability must keep low-reasoning first-pass AI generation, stronger repair reasoning, bounded provider waits and timing telemetry.",
);

assert(
  authForm.includes("prepareReturnPath") &&
    authForm.includes("/auth/callback?next=") &&
    authForm.includes("encodeURIComponent(destination)"),
  "External authentication must return through the explicit KSI auth-completion route while preserving a safe role-aware destination.",
);

for (const required of [
  "onAuthStateChange",
  "getSession()",
  "safeInternalPath",
  "postAuthPath",
  "router.replace(destination)",
  "Completing secure sign-in",
]) {
  assert(
    authCallback.includes(required),
    `Auth callback completion guard is missing: ${required}`,
  );
}

assert(
  assessmentPage.includes("ksi-assessment-shell") &&
    assessmentPage.includes("overflow-x-hidden"),
  "Assessment must retain an explicit mobile viewport boundary.",
);

for (const required of [
  ".ksi-assessment-shell select",
  "min-width: 0",
  "max-width: 100%",
  "overflow-wrap: anywhere",
]) {
  assert(
    globals.includes(required),
    `Assessment mobile shrink protection is missing: ${required}`,
  );
}

assert(
  savedWorkPage.includes("ksi-saved-work-shell"),
  "Saved Work must retain its scoped mobile containment shell.",
);

for (const required of [
  ".ksi-saved-work-shell article",
  ".ksi-saved-work-shell main .inline-flex",
  "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)",
  ".ksi-saved-work-shell article > div > div:last-child > button",
]) {
  assert(
    globals.includes(required),
    `Saved Work mobile shrink protection is missing: ${required}`,
  );
}

assert(
  rootLayout.includes("ksi-app-shell") &&
    rootLayout.includes("min-w-0") &&
    rootLayout.includes("max-w-full"),
  "The root KSI shell must opt every route into the product-wide mobile containment contract.",
);

for (const required of [
  "Product-wide mobile containment contract",
  "@media (max-width: 767px)",
  ".ksi-app-shell fieldset",
  "min-inline-size: 0",
  ".ksi-app-shell input:not([type=\"checkbox\"]):not([type=\"radio\"])",
  ".ksi-app-shell table",
  "table-layout: fixed",
  "word-break: break-word",
]) {
  assert(
    globals.includes(required),
    `Product-wide mobile containment is missing: ${required}`,
  );
}

const userInterfaceFiles = [
  ...(await tsxFiles("app")),
  ...(await tsxFiles("components")),
];
const hardWidthRegressions = [];
for (const path of userInterfaceFiles) {
  const source = await readFile(path, "utf8");
  const relativePath = relative(ROOT, path);
  if (/\bw-screen\b/.test(source)) hardWidthRegressions.push(`${relativePath}: w-screen`);
  const arbitraryMinimums = source.match(/\bmin-w-\[[^\]]+\]/g) ?? [];
  for (const token of arbitraryMinimums) {
    hardWidthRegressions.push(`${relativePath}: ${token}`);
  }
}
assert(
  hardWidthRegressions.length === 0,
  `Hard mobile width regressions remain:\n${hardWidthRegressions.join("\n")}`,
);

for (const route of [hqlsPdfRoute, assessmentPdfRoute, diagnosisPdfRoute]) {
  assert(
    route.includes("pdfSafeValue"),
    "Every generated KSI PDF must break unusually long tokens before layout so no word can cross the printable edge.",
  );
}

assert(
  pdfSafety.includes("LONG_TOKEN_THRESHOLD") &&
    pdfSafety.includes("LONG_TOKEN_CHUNK") &&
    pdfSafety.includes("PDF layout patch must preserve byte length") &&
    pdfSafety.includes("Expected PDF layout command was not found"),
  "PDF layout safety helper must keep deterministic long-token wrapping and byte-safe header geometry patches.",
);

assert(
  hqlsPdfRoute.includes('["54 752 487 1.4 re f", "97 752 444 1.4 re f"]'),
  "HQLS PDF header rule must begin after the logo footprint.",
);
assert(
  assessmentPdfRoute.includes('["54 746 487 1.3 re f", "89 746 452 1.3 re f"]'),
  "Assessment PDF header rule must begin after the logo footprint.",
);

assert(
  hqlsPdf.includes("const BOTTOM = 64;") &&
    hqlsPdf.includes("54 30 Tm (KAEC-NG | Human Quest Learning System"),
  "HQLS PDF must retain protected body/footer separation.",
);
assert(
  assessmentPdf.includes("const BOTTOM = 58;") &&
    assessmentPdf.includes("54 30 Tm (KAEC-NG | Assessment Intelligence"),
  "Assessment PDF must retain protected body/footer separation.",
);
assert(
  diagnosisPdf.includes("return this.y - height > 42;") &&
    diagnosisPdf.includes("28 20 Tm (KAEC-NG | Student Diagnosis Intelligence"),
  "Diagnosis PDF flow pages must retain protected body/footer separation.",
);

console.log(
  `V1 stability verification passed: AI latency controls, safe role-aware auth completion, product-wide mobile containment across ${userInterfaceFiles.length} TSX files, and all KSI PDF layout guards are present.`,
);
