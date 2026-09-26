import { deflateRawSync } from "node:zlib";

import type { GeneratedAssessmentItem } from "@/lib/assessment/engine";
import {
  assessmentAnswerLines,
  type AssessmentPdfInput,
  type AssessmentPdfMode,
} from "@/lib/pdf/assessment-pdf";

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraph(
  value: string,
  options: { bold?: boolean; size?: number; color?: string; spaceAfter?: number; keepNext?: boolean; rule?: boolean } = {},
) {
  const properties = [
    options.keepNext ? "<w:keepNext/>" : "",
    options.rule ? '<w:spacing w:after="0" w:line="390" w:lineRule="exact"/>' : `<w:spacing w:after="${options.spaceAfter ?? 110}"/>`,
    options.rule ? '<w:pBdr><w:bottom w:val="single" w:sz="4" w:color="C5CDD6"/><w:between w:val="single" w:sz="4" w:color="C5CDD6"/></w:pBdr>' : "",
  ].join("");
  const run = [
    options.bold ? "<w:b/>" : "",
    `<w:sz w:val="${options.size ?? 20}"/>`,
    `<w:color w:val="${options.color ?? "202634"}"/>`,
  ].join("");
  return `<w:p><w:pPr>${properties}</w:pPr><w:r><w:rPr>${run}</w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
}

const sectionLabels: Array<[GeneratedAssessmentItem["itemType"], string]> = [
  ["objective", "Objective"],
  ["subjective", "Subjective and theory"],
  ["critical_thinking", "Critical thinking and reasoning"],
  ["project", "Project and practical"],
];

function schoolLogo() {
  return '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="457200" cy="457200"/><wp:docPr id="1" name="School logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="School logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function examBody(input: AssessmentPdfInput) {
  const blocks: string[] = [
    paragraph(input.assessment.title, { bold: true, size: 32, color: "0B3268", spaceAfter: 220 }),
    paragraph("Name: ____________________________________   Date: __________________", { spaceAfter: 160 }),
    paragraph(`Subject: ${input.subject}    Class: ${input.classLevel}    Total marks: ${input.assessment.blueprint.totalMarks}`, { bold: true }),
    paragraph(`Session: ${input.academicSession || "Not specified"}    Term: ${input.term || "Not specified"}    Duration: ${input.durationMinutes ? `${input.durationMinutes} minutes` : "Not specified"}`, { spaceAfter: 220 }),
    paragraph("GENERAL INSTRUCTIONS", { bold: true, color: "0B3268", keepNext: true }),
    paragraph(input.assessment.studentInstructions || "Answer all questions as instructed."),
    paragraph("Use the space provided. Continue on an attached sheet if necessary and label each answer with its question number.", { spaceAfter: 260 }),
  ];

  for (const [type, title] of sectionLabels) {
    const items = input.assessment.items.filter((item) => item.itemType === type);
    if (!items.length) continue;
    blocks.push(paragraph(title.toUpperCase(), { bold: true, size: 23, color: "0B3268", spaceAfter: 160, keepNext: true }));
    for (const item of items) {
      blocks.push(paragraph(`${item.position}. ${item.prompt} [${item.marks} mark${item.marks === 1 ? "" : "s"}]`, { bold: true, keepNext: true, spaceAfter: 90 }));
      if (type === "objective") {
        item.options.forEach((option, index) => blocks.push(paragraph(`     ${String.fromCharCode(65 + index)}. ${option}`, { spaceAfter: 45 })));
      } else {
        if (type === "project" && item.deliverable) blocks.push(paragraph(`Deliverable: ${item.deliverable}`, { spaceAfter: 90, keepNext: true }));
        blocks.push(paragraph(type === "project" ? "Working and planning space:" : "Answer:", { size: 18, color: "667085", keepNext: true, spaceAfter: 60 }));
        for (let i = 0; i < assessmentAnswerLines(item); i += 1) {
          blocks.push(paragraph(" ", { rule: true }));
        }
      }
    }
  }
  return blocks.join("");
}

function markingBody(input: AssessmentPdfInput) {
  const blocks = [
    paragraph("MARKING GUIDE  NOT FOR STUDENTS", { bold: true, size: 26, color: "0B3268", spaceAfter: 160 }),
    paragraph(input.assessment.title, { bold: true, size: 24 }),
    paragraph(`${input.subject}  |  ${input.classLevel}  |  ${input.academicSession || "Session not specified"}  |  ${input.term || "Term not specified"}`, { spaceAfter: 230 }),
  ];
  for (const item of input.assessment.items) {
    blocks.push(paragraph(`Question ${item.position}  |  ${item.marks} marks`, { bold: true, color: "0B3268", keepNext: true }));
    blocks.push(paragraph(item.prompt));
    if (item.itemType === "objective") {
      blocks.push(paragraph(`Answer: ${item.correctAnswer}`, { bold: true }));
      if (item.answerRationale) blocks.push(paragraph(`Rationale: ${item.answerRationale}`));
    } else {
      if (item.expectedEvidence.length) blocks.push(paragraph(`Expected evidence: ${item.expectedEvidence.join("; ")}`));
      item.markingGuide.forEach((criterion) => blocks.push(paragraph(`• ${criterion}`)));
    }
  }
  return blocks.join("");
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<[string, Buffer]>) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const filename = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(content);
    const crc = crc32(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const directoryBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, directoryBytes, end]));
}

export function createAssessmentDocx(input: AssessmentPdfInput, mode: AssessmentPdfMode) {
  const hasLogo = input.hasSchoolLogo;
  const body = mode === "exam" ? examBody(input) : markingBody(input);
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${hasLogo ? schoolLogo() : ""}${paragraph(input.workspaceName.toUpperCase(), { bold: true, size: 25, color: "0B3268", spaceAfter: 60 })}${paragraph("KSI School Intelligence  |  by KAEC-NG", { size: 16, color: "667085", spaceAfter: 240 })}${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr></w:body></w:document>`;
  const types = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${hasLogo ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const entries: Array<[string, Buffer]> = [
    ["[Content_Types].xml", Buffer.from(types)],
    ["_rels/.rels", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')],
    ["word/document.xml", Buffer.from(document)],
  ];
  if (hasLogo) {
    entries.push(["word/_rels/document.xml.rels", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/school-logo.jpg"/></Relationships>')]);
    entries.push(["word/media/school-logo.jpg", Buffer.from(input.brandLogoJpegBase64, "base64")]);
  }
  return zip(entries);
}
