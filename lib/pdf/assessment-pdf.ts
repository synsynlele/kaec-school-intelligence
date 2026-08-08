import type { GeneratedAssessment } from "@/lib/assessment/engine";
import { KAEC_REPORT_LOGO_JPEG_BASE64 } from "@/lib/pdf/kaec-report-logo";

export type AssessmentPdfInput = {
  workspaceName: string;
  subject: string;
  classLevel: string;
  topic: string;
  objective: string;
  durationMinutes: number | null;
  assessment: GeneratedAssessment;
};

type TextOptions = {
  bold?: boolean;
  size?: number;
  color?: [number, number, number];
  indent?: number;
  gapBefore?: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 54;
const RIGHT = 54;
const TOP = 64;
const BOTTOM = 58;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const NAVY: [number, number, number] = [0.05, 0.24, 0.38];
const BLUE: [number, number, number] = [0.03, 0.48, 0.72];
const TEXT: [number, number, number] = [0.12, 0.12, 0.14];
const MUTED: [number, number, number] = [0.38, 0.4, 0.44];
const GREEN: [number, number, number] = [0.03, 0.42, 0.25];

function ascii(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->")
    .replace(/\u2022/g, "-")
    .replace(/\u00d7/g, "x")
    .replace(/\u00f7/g, "/")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return ascii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text: string, maxWidth: number, fontSize: number, bold = false) {
  const clean = ascii(text);
  if (!clean) return [];
  const averageGlyph = fontSize * (bold ? 0.56 : 0.51);
  const maxChars = Math.max(12, Math.floor(maxWidth / averageGlyph));
  const lines: string[] = [];
  for (const paragraph of clean.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function rgb([r, g, b]: [number, number, number]) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

class PdfComposer {
  private pages: string[][] = [];
  private current: string[] = [];
  private y = PAGE_HEIGHT - TOP;

  constructor(private readonly input: AssessmentPdfInput) {
    this.newPage();
  }

  private header() {
    this.current.push("q 34 0 0 34 54 756 cm /Im1 Do Q");
    this.current.push(rgb(NAVY));
    this.current.push("BT /F2 13 Tf 1 0 0 1 101 782 Tm (KAEC-NG) Tj ET");
    this.current.push(rgb(MUTED));
    this.current.push(
      "BT /F1 8.5 Tf 1 0 0 1 101 768 Tm (KAEC School Intelligence - Assessment Intelligence) Tj ET",
    );
    this.current.push(rgb(BLUE));
    this.current.push("54 746 487 1.3 re f");
    this.y = 724;
  }

  private newPage() {
    if (this.current.length) this.pages.push(this.current);
    this.current = [];
    this.header();
  }

  forceNewPage() {
    this.newPage();
  }

  private ensure(height: number) {
    if (this.y - height < BOTTOM + 18) this.newPage();
  }

  line(text: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const indent = options.indent ?? 0;
    const gapBefore = options.gapBefore ?? 0;
    const gapAfter = options.gapAfter ?? 2;
    const wrapped = wrapText(text, CONTENT_WIDTH - indent, size, bold);
    if (!wrapped.length) return;
    const leading = size * 1.35;
    this.ensure(gapBefore + wrapped.length * leading + gapAfter);
    this.y -= gapBefore;
    this.current.push(rgb(options.color ?? TEXT));
    for (const wrappedLine of wrapped) {
      this.current.push(
        `BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf 1 0 0 1 ${(LEFT + indent).toFixed(1)} ${this.y.toFixed(1)} Tm (${pdfEscape(wrappedLine)}) Tj ET`,
      );
      this.y -= leading;
    }
    this.y -= gapAfter;
  }

  rule() {
    this.ensure(8);
    this.current.push("0.850 0.860 0.880 rg");
    this.current.push(`${LEFT} ${this.y.toFixed(1)} ${CONTENT_WIDTH} 0.7 re f`);
    this.y -= 8;
  }

  bullet(text: string) {
    this.line(`- ${text}`, { indent: 12, size: 9.2 });
  }

  addAssessment() {
    const { assessment } = this.input;
    this.line("STUDENT ASSESSMENT", { bold: true, size: 17, color: NAVY });
    this.line(assessment.title, { bold: true, size: 13, gapAfter: 7 });
    this.line(`School / workspace: ${this.input.workspaceName}`, { size: 9.3 });
    this.line(`Subject: ${this.input.subject}    Class: ${this.input.classLevel}`, {
      size: 9.3,
    });
    this.line(
      `Topic: ${this.input.topic}    Total marks: ${assessment.blueprint.totalMarks}${
        this.input.durationMinutes ? `    Duration: ${this.input.durationMinutes} minutes` : ""
      }`,
      { size: 9.3 },
    );
    this.line(`Objective: ${this.input.objective}`, { size: 9.3, gapAfter: 5 });
    this.rule();
    this.line("Instructions", { bold: true, size: 10.5, color: BLUE });
    this.line(assessment.studentInstructions, { size: 9.5, gapAfter: 6 });
    this.rule();

    for (const item of assessment.items) {
      this.line(`${item.position}. ${item.prompt} (${item.marks} mark${item.marks === 1 ? "" : "s"})`, {
        bold: true,
        size: 10.2,
        gapBefore: 5,
        gapAfter: 3,
      });
      if (item.itemType === "objective") {
        item.options.forEach((option, index) =>
          this.line(`${String.fromCharCode(65 + index)}. ${option}`, {
            indent: 14,
            size: 9.6,
          }),
        );
      } else if (item.itemType === "project" && item.deliverable) {
        this.line(`Deliverable: ${item.deliverable}`, {
          size: 9.2,
          color: MUTED,
          indent: 10,
        });
      }
      this.line(" ", { gapAfter: 3 });
    }

    this.forceNewPage();
    this.line("TEACHER ANSWER & MARKING GUIDE", {
      bold: true,
      size: 17,
      color: NAVY,
    });
    this.line(assessment.title, { bold: true, size: 12.5, gapAfter: 6 });
    this.line("HQLS / KAEC assessment validation recorded", {
      bold: true,
      size: 9,
      color: GREEN,
      gapAfter: 7,
    });
    this.rule();

    for (const item of assessment.items) {
      this.line(`Item ${item.position} - ${item.itemType.replaceAll("_", " ")} - ${item.marks} marks`, {
        bold: true,
        size: 10.5,
        color: NAVY,
        gapBefore: 5,
      });
      this.line(`Expected evidence: ${item.expectedEvidence.join("; ")}`, {
        size: 9.2,
      });
      if (item.itemType === "objective") {
        this.line(`Answer: ${item.correctAnswer}`, {
          bold: true,
          size: 9.5,
          color: GREEN,
        });
        if (item.answerRationale) {
          this.line(`Rationale: ${item.answerRationale}`, { size: 9.2 });
        }
      } else {
        this.line("Marking guide", { bold: true, size: 9.5, color: BLUE });
        item.markingGuide.forEach((criterion) => this.bullet(criterion));
        if (item.deliverable) {
          this.line(`Deliverable: ${item.deliverable}`, { size: 9.2 });
        }
      }
      if (item.criticalThinkingType) {
        this.line(
          `KAEC Critical Thinking experience: ${item.criticalThinkingType.replaceAll("_", " ")}`,
          { size: 8.8, color: MUTED },
        );
      }
      this.rule();
    }

    if (this.current.length) this.pages.push(this.current);
    return this.pages;
  }
}

function buildPdfObjects(pageCommands: string[][]) {
  const logo = Buffer.from(KAEC_REPORT_LOGO_JPEG_BASE64, "base64");
  const pageCount = pageCommands.length;
  const objects: Buffer[] = [];
  const pageRefs = pageCommands.map((_, index) => 7 + index * 2);

  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = Buffer.from(
    `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  );
  objects[3] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  objects[4] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  objects[5] = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width 128 /Height 128 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`,
    ),
    logo,
    Buffer.from("\nendstream"),
  ]);

  for (let index = 0; index < pageCount; index += 1) {
    const contentRef = 6 + index * 2;
    const pageRef = 7 + index * 2;
    const footer = [
      rgb(MUTED),
      `BT /F1 7.5 Tf 1 0 0 1 54 30 Tm (KAEC-NG | Assessment Intelligence | Page ${index + 1} of ${pageCount}) Tj ET`,
    ];
    const content = `${pageCommands[index].join("\n")}\n${footer.join("\n")}`;
    const contentBytes = Buffer.from(content, "latin1");
    objects[contentRef] = Buffer.concat([
      Buffer.from(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      Buffer.from("\nendstream"),
    ]);
    objects[pageRef] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents ${contentRef} 0 R >>`,
    );
  }
  return objects;
}

function serializePdf(objects: Buffer[]) {
  const header = Buffer.from("%PDF-1.4\n%KSI\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets: number[] = [0];
  let offset = header.length;
  for (let index = 1; index < objects.length; index += 1) {
    const object = objects[index];
    if (!object) continue;
    offsets[index] = offset;
    const prefix = Buffer.from(`${index} 0 obj\n`, "latin1");
    const suffix = Buffer.from("\nendobj\n", "latin1");
    chunks.push(prefix, object, suffix);
    offset += prefix.length + object.length + suffix.length;
  }
  const xrefOffset = offset;
  const maxObject = objects.length - 1;
  const xref: string[] = ["xref", `0 ${maxObject + 1}`, "0000000000 65535 f "];
  for (let index = 1; index <= maxObject; index += 1) {
    xref.push(`${String(offsets[index] ?? 0).padStart(10, "0")} 00000 n `);
  }
  xref.push(
    "trailer",
    `<< /Size ${maxObject + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  );
  chunks.push(Buffer.from(`${xref.join("\n")}\n`, "latin1"));
  return new Uint8Array(Buffer.concat(chunks));
}

export function createAssessmentPdf(input: AssessmentPdfInput) {
  if (!input.assessment.items.length) {
    throw new Error("A teacher-ready assessment PDF requires assessment items.");
  }
  return serializePdf(buildPdfObjects(new PdfComposer(input).addAssessment()));
}

export function safeAssessmentPdfFilename(title: string) {
  const slug = ascii(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${slug || "kaec-assessment"}.pdf`;
}
