import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  brand,
  layout,
  setup,
  pdfBrand,
  assessmentPdf,
  assessmentRoute,
  assessmentClient,
  assessmentResult,
  assessmentApi,
  hqlsPdf,
  hqlsRoute,
  diagnosisPdf,
  diagnosisRoute,
  interventionPdf,
  interventionRoute,
  manifest,
  twa,
] = await Promise.all([
  text("components/branding/ksi-brand.tsx"),
  text("app/layout.tsx"),
  text("components/workspace/academic-setup-client.tsx"),
  text("lib/pdf/pdf-branding.ts"),
  text("lib/pdf/assessment-pdf.ts"),
  text("app/api/assessment/pdf/route.ts"),
  text("components/assessment/world-class-assessment-client.tsx"),
  text("components/assessment/assessment-result-client.tsx"),
  text("app/api/assessment-v11/route.ts"),
  text("lib/pdf/hqls-lesson-pdf.ts"),
  text("app/api/hqls/pdf/route.ts"),
  text("lib/pdf/diagnosis-pdf.ts"),
  text("app/api/diagnosis/pdf/route.ts"),
  text("lib/pdf/intervention-pdf.ts"),
  text("app/api/interventions/pdf/route.ts"),
  text("app/manifest.ts"),
  text("android-lite/twa-manifest.production.json"),
]);

for (const required of [
  'src="/ksi-mark.svg"',
  "KAEC School Intelligence",
  "by KAEC-NG",
]) {
  assert(brand.includes(required), `KSI endorsed brand is missing: ${required}`);
}

assert(
  layout.includes('/icon.svg') && layout.includes('themeColor: "#0B3268"'),
  "App metadata must use the new KSI icon and navy product theme.",
);
assert(
  manifest.includes('theme_color: "#0B3268"'),
  "PWA manifest must use the KSI product theme.",
);

for (const required of [
  "prepareSchoolLogo",
  '.update({ logo_url: logoUrl })',
  '.update({ logo_url: null })',
  "School document branding",
  "Upload school logo",
  "New KSI PDFs will use this school branding",
]) {
  assert(
    setup.includes(required),
    `School PDF branding setup is missing: ${required}`,
  );
}

for (const required of [
  "resolvePdfBranding",
  "KSI_PDF_ATTRIBUTION",
  "data:image\\/jpeg;base64",
]) {
  assert(
    pdfBrand.includes(required),
    `Shared PDF branding contract is missing: ${required}`,
  );
}

for (const required of [
  'type AssessmentPdfMode = "exam" | "marking"',
  "OBJECTIVE",
  "SUBJECTIVE / THEORY",
  "CRITICAL THINKING / REASONING",
  "PROJECT / PRACTICAL",
  "Name: ____________________________________________",
  "MARKING GUIDE - NOT FOR STUDENTS",
  'if (this.mode === "exam") this.addExam()',
]) {
  assert(
    assessmentPdf.includes(required),
    `Exam-ready PDF requirement is missing: ${required}`,
  );
}

for (const required of [
  'requestedMode = url.searchParams.get("mode")',
  '["exam", "marking"]',
  '.select("name,logo_url")',
  '.select("name,academic_session")',
  "resolvePdfBranding",
  "academicSession",
  "blueprint.term",
]) {
  assert(
    assessmentRoute.includes(required),
    `Assessment export route is missing: ${required}`,
  );
}

assert(
  assessmentResult.includes('downloadPdf("exam")') &&
    assessmentResult.includes('downloadPdf("marking")') &&
    assessmentResult.includes("Download Exam PDF") &&
    assessmentResult.includes("Download Marking Guide"),
  "Assessment Result must expose separate exam and marking-guide downloads.",
);

assert(
  assessmentClient.includes('label="Academic term"') &&
    assessmentClient.includes("academic_session") &&
    assessmentClient.includes("academicSession: classMatch?.academic_session"),
  "Assessment blueprint must capture term and the selected class academic session.",
);
assert(
  assessmentApi.includes("term: input.term") &&
    assessmentApi.includes("academicSession: input.academicSession"),
  "Assessment persistence must retain term and academic session for printing.",
);

for (const [name, pdf, route] of [
  ["HQLS", hqlsPdf, hqlsRoute],
  ["Diagnosis", diagnosisPdf, diagnosisRoute],
  ["Intervention", interventionPdf, interventionRoute],
]) {
  assert(
    pdf.includes("brandLogoJpegBase64") &&
      pdf.includes("hasSchoolLogo") &&
      pdf.includes("by KAEC-NG"),
    `${name} PDF must use the school-first KSI branding contract.`,
  );
  assert(
    route.includes('.select("name,logo_url")') &&
      route.includes("resolvePdfBranding"),
    `${name} PDF route must load the active school's logo.`,
  );
}

const twaConfig = JSON.parse(twa);
assert(
  twaConfig.themeColor === "#0B3268" &&
    twaConfig.iconUrl === "https://www.ksi.name.ng/pwa/icon-512" &&
    twaConfig.maskableIconUrl === "https://www.ksi.name.ng/pwa/icon-512" &&
    twaConfig.appVersionCode >= 5,
  "KSI Lite native wrapper must use the new product identity.",
);

console.log(
  "KSI brand + school PDF + exam-ready export verification passed.",
);
