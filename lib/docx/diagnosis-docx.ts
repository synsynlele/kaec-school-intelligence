import type { DiagnosisPdfInput } from "@/lib/pdf/diagnosis-pdf";
import { paragraph, schoolLogo, zip } from "@/lib/docx/assessment-docx";

function heading(text: string) {
  return paragraph(text.toUpperCase(), { bold: true, size: 22, color: "0B3268", keepNext: true, spaceAfter: 110 });
}

function body(text: string, bold = false) {
  return paragraph(text || "Not recorded.", { bold, size: 20, spaceAfter: 110 });
}

function itemList(values: readonly string[]) {
  return values.length
    ? values.map((item) => paragraph("• " + item, { size: 19, spaceAfter: 80 })).join("")
    : paragraph("Insufficient evidence to state a supported finding.", { size: 19, color: "667085" });
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

/** Editable .docx with the same approved report evidence and action sections as the PDF. */
export function createDiagnosisDocx(input: DiagnosisPdfInput): Uint8Array {
  if (!input.reviewedAt || !input.finalisedAt) {
    throw new Error("Parent diagnosis Word export requires completed review and school approval.");
  }
  if (!input.academicSession || !input.term) {
    throw new Error("Parent diagnosis Word export requires Academic Session and Term.");
  }

  const diagnosis = input.diagnosis;
  const parts: string[] = [];
  if (input.hasSchoolLogo) parts.push(schoolLogo());
  parts.push(paragraph(input.workspaceName.toUpperCase(), { bold: true, size: 25, color: "0B3268", spaceAfter: 70 }));
  parts.push(paragraph("KSI SCHOOL INTELLIGENCE  |  by KAEC-NG", { bold: true, size: 16, color: "667085", spaceAfter: 190 }));
  parts.push(paragraph("STUDENT DIAGNOSIS & GROWTH REPORT", { bold: true, size: 28, color: "17633D", spaceAfter: 210 }));
  parts.push(body(`Learner: ${input.studentName}    |    Class: ${input.className}`, true));
  parts.push(body(`Academic session: ${input.academicSession}    |    Term: ${input.term}`));
  parts.push(heading("Parent summary"));
  parts.push(body(diagnosis.conciseDiagnosis));

  const findings: Array<[string, { statement: string }[]]> = [
    ["Academic / skill strengths", diagnosis.academicSkillStrengths],
    ["Academic / skill challenges", diagnosis.academicSkillChallenges],
    ["Character strengths", diagnosis.characterStrengths],
    ["Character challenges", diagnosis.characterChallenges],
  ];
  for (const [title, entries] of findings) {
    parts.push(heading(title), itemList(entries.map((entry) => entry.statement)));
  }

  const actions: Array<[string, { action: string; timeframe: string }[]]> = [
    ["School: academic / skills actions", diagnosis.schoolAcademicActions],
    ["Parent: academic / skills actions", diagnosis.parentAcademicActions],
    ["School: character actions", diagnosis.schoolCharacterActions],
    ["Parent: character actions", diagnosis.parentCharacterActions],
  ];
  parts.push(heading("Agreed growth action plan"));
  for (const [title, entries] of actions) {
    parts.push(paragraph(title, { bold: true, size: 20, color: "17633D", keepNext: true }));
    parts.push(itemList(entries.map((entry) => `${entry.action} — ${entry.timeframe}`)));
  }

  parts.push(heading("Builder growth direction"), body(diagnosis.builderGrowthDirection));
  parts.push(heading("Encouragement note"), body(diagnosis.encouragementNote));
  parts.push(heading("Evidence limitations"), itemList(diagnosis.evidenceLimitations));
  parts.push(heading("Supporting observations"), itemList(diagnosis.observedEvidence.map((entry) => `${entry.domain}: ${entry.statement}${entry.metric ? ` (${entry.metric})` : ""}`)));
  parts.push(heading("Detected patterns"), itemList(diagnosis.detectedPatterns.map((entry) => `${entry.statement} — ${entry.confidence} confidence`)));
  parts.push(heading("Possible interpretations (not established facts)"), itemList(diagnosis.possibleInterpretations.map((entry) => `${entry.statement} ${entry.uncertaintyNote}`)));
  parts.push(heading("Report basis"), body(`Diagnosis mode: ${input.diagnosisMode.replaceAll("_", " ")}`));
  if (input.assessmentTitle) parts.push(body(`Assessment evidence: ${input.assessmentTitle}`));
  parts.push(body("This report reflects school-observed evidence and agreed growth priorities. It is not a medical, psychiatric or psychological diagnosis."));
  parts.push(heading("Human review & school approval"));
  parts.push(body(`Teacher review recorded: ${dateLabel(input.reviewedAt)}`));
  parts.push(body(`School approval recorded: ${dateLabel(input.finalisedAt)}`));
  parts.push(paragraph("Prepared through KSI · KAEC School Intelligence · by KAEC-NG", { size: 16, color: "667085", spaceAfter: 100 }));

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${parts.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="950" w:right="950" w:bottom="950" w:left="950"/></w:sectPr></w:body></w:document>`;
  const types = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${input.hasSchoolLogo ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const entries: Array<[string, Buffer]> = [
    ["[Content_Types].xml", Buffer.from(types)],
    ["_rels/.rels", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')],
    ["word/document.xml", Buffer.from(document, "utf8")],
  ];
  if (input.hasSchoolLogo) {
    entries.push(["word/_rels/document.xml.rels", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/school-logo.jpg"/></Relationships>')]);
    entries.push(["word/media/school-logo.jpg", Buffer.from(input.brandLogoJpegBase64, "base64")]);
  }
  return zip(entries);
}
