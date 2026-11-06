import { normalizePdfText, escapePdfText, embedUnicodePdfFonts, wrapPdfText } from "@/lib/pdf/unicode-fonts";
import type { GeneratedDiagnosis } from "@/lib/diagnosis/engine";
import { KSI_PDF_ATTRIBUTION } from "@/lib/pdf/pdf-branding";

export type DiagnosisPdfInput = {
  workspaceName: string;
  brandLogoJpegBase64: string;
  hasSchoolLogo: boolean;
  studentName: string;
  className: string;
  academicSession: string;
  term: string;
  diagnosisMode: string;
  assessmentTitle: string;
  diagnosis: GeneratedDiagnosis;
  reviewedAt: string;
  finalisedAt: string;
};

type Color = [number, number, number];

type FlowTextOptions = {
  bold?: boolean;
  size?: number;
  color?: Color;
  gapBefore?: number;
  gapAfter?: number;
  indent?: number;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_X = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOREST: Color = [0.015, 0.22, 0.09];
const TEXT: Color = [0.10, 0.10, 0.11];
const MUTED: Color = [0.38, 0.39, 0.40];


const ascii = normalizePdfText;

const pdfEscape = escapePdfText;

function rgb([r, g, b]: Color) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function wrapText(text: string, maxWidth: number, fontSize: number, bold = false) {
  return wrapPdfText(text, maxWidth, fontSize, bold);
}

function dateLabel(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function textAtTop(
  commands: string[],
  value: string,
  x: number,
  top: number,
  size = 9,
  bold = false,
  color: Color = TEXT,
) {
  const y = PAGE_HEIGHT - top - size;
  commands.push(rgb(color));
  commands.push(
    `BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(value)}) Tj ET`,
  );
}

function boxedText(
  commands: string[],
  value: string,
  x: number,
  top: number,
  width: number,
  height: number,
  options: {
    size?: number;
    bold?: boolean;
    color?: Color;
    padding?: number;
    maxLines?: number;
    prefix?: string;
  } = {},
) {
  const size = options.size ?? 8.2;
  const bold = options.bold ?? false;
  const padding = options.padding ?? 7;
  const leading = size * 1.28;
  const possibleLines = Math.max(
    1,
    Math.floor((height - padding * 2) / leading),
  );
  const maxLines = Math.min(options.maxLines ?? possibleLines, possibleLines);
  const prefix = options.prefix ?? "";
  const lines = wrapText(`${prefix}${value}`, width - padding * 2, size, bold);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) {
    const last = shown.length - 1;
    shown[last] = `${shown[last].replace(/[. ]+$/g, "")}...`;
  }
  shown.forEach((line, index) => {
    textAtTop(
      commands,
      line,
      x + padding,
      top + padding + index * leading,
      size,
      bold,
      options.color ?? TEXT,
    );
  });
}

function brandName(
  commands: string[],
  workspaceName: string,
  x: number,
  top: number,
  width: number,
  height: number,
  size = 8.6,
) {
  boxedText(commands, workspaceName.toUpperCase(), x, top, width, height, {
    size,
    bold: true,
    color: FOREST,
    padding: 2,
    maxLines: 3,
  });
}

class FlowPage {
  commands: string[] = [];
  private pages: string[][] = [];
  private y = PAGE_HEIGHT - 102;

  constructor(private readonly input: DiagnosisPdfInput) {
    this.header();
  }

  private header() {
    const input = this.input;
    if (input.hasSchoolLogo) {
      this.commands.push("q 36 0 0 36 30 523 cm /Im1 Do Q");
    } else {
      textAtTop(this.commands, "KSI", 30, 29, 15, true, FOREST);
    }
    brandName(this.commands, input.workspaceName, 74, 25, 170, 48, 8.4);
    textAtTop(
      this.commands,
      "STUDENT DIAGNOSIS",
      PAGE_WIDTH - 260,
      30,
      12,
      true,
      FOREST,
    );
    this.commands.push(rgb(FOREST));
    this.commands.push(
      `${MARGIN_X.toFixed(1)} ${(PAGE_HEIGHT - 82).toFixed(1)} ${CONTENT_WIDTH.toFixed(1)} 1.2 re f`,
    );
  }

  private ensure(height: number) {
    if (this.y - height <= 42) {
      this.pages.push(this.commands);
      this.commands = [];
      this.y = PAGE_HEIGHT - 102;
      this.header();
    }
  }

  line(value: string, options: FlowTextOptions = {}) {
    const size = options.size ?? 9.5;
    const bold = options.bold ?? false;
    const gapBefore = options.gapBefore ?? 0;
    const gapAfter = options.gapAfter ?? 3;
    const indent = options.indent ?? 0;
    const lines = wrapText(value, CONTENT_WIDTH - indent, size, bold);
    if (!lines.length) return;
    const leading = size * 1.35;
    this.ensure(gapBefore + leading + gapAfter);
    this.y -= gapBefore;
    for (const line of lines) {
      this.ensure(leading + gapAfter);
      this.commands.push(rgb(options.color ?? TEXT));
      this.commands.push(
        `BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf 1 0 0 1 ${(MARGIN_X + indent).toFixed(1)} ${this.y.toFixed(1)} Tm (${pdfEscape(line)}) Tj ET`,
      );
      this.y -= leading;
    }
    this.y -= gapAfter;
  }

  section(title: string) {
    this.line(title, {
      bold: true,
      size: 11,
      color: FOREST,
      gapBefore: 8,
      gapAfter: 4,
    });
  }

  bullet(value: string) {
    this.line(`- ${value}`, { size: 9.2, indent: 8, gapAfter: 2 });
  }

  build() {
    const diagnosis = this.input.diagnosis;
    this.line(
      `${this.input.studentName} | ${this.input.className} | ${this.input.academicSession} | ${this.input.term}`,
      { bold: true, size: 9.6, color: MUTED, gapAfter: 8 },
    );

    this.section("Diagnosis");
    this.line(diagnosis.conciseDiagnosis);
    const findings = [
      ["Academic / Skill Strengths", diagnosis.academicSkillStrengths],
      ["Academic / Skill Challenges", diagnosis.academicSkillChallenges],
      ["Character Strengths", diagnosis.characterStrengths],
      ["Character Challenges", diagnosis.characterChallenges],
    ] as const;
    for (const [label, items] of findings) {
      this.section(label);
      if (!items.length) this.line("Insufficient evidence to state a supported finding.");
      items.forEach((item) => this.bullet(item.statement));
    }
    const actions = [
      ["School: Academics / Skills", diagnosis.schoolAcademicActions],
      ["Parents: Academics / Skills", diagnosis.parentAcademicActions],
      ["School: Character", diagnosis.schoolCharacterActions],
      ["Parents: Character", diagnosis.parentCharacterActions],
    ] as const;
    for (const [label, items] of actions) {
      if (!items.length) continue;
      this.section(label);
      items.forEach((item) => this.bullet(`${item.action} (${item.timeframe})`));
    }
    if (diagnosis.observedEvidence.length) this.section("Observed Evidence");
    diagnosis.observedEvidence.forEach((item) => this.bullet(item.statement));
    if (diagnosis.detectedPatterns.length) this.section("Detected Patterns");
    diagnosis.detectedPatterns.forEach((item) => this.bullet(item.statement));
    if (diagnosis.possibleInterpretations.length) this.section("Possible Interpretations (not established facts)");
    diagnosis.possibleInterpretations.forEach((item) => this.bullet(`${item.statement} ${item.uncertaintyNote}`));

    this.section("Builder Growth Direction");
    this.line(diagnosis.builderGrowthDirection, { size: 10 });

    this.section("Encouragement Note");
    this.line(diagnosis.encouragementNote, { size: 10, color: FOREST });

    this.section("Evidence Limitations");
    diagnosis.evidenceLimitations.forEach((item) => this.bullet(item));

    this.section("Report Basis");
    this.line(`Diagnosis mode: ${titleCase(this.input.diagnosisMode)}`, {
      size: 9.2,
    });
    if (this.input.assessmentTitle) {
      this.line(`Assessment evidence: ${this.input.assessmentTitle}`, { size: 9.2 });
    }
    this.line(
      "The parent sheet summarises first-hand school evidence, saved assessment evidence where used, and the actions agreed for the learner's next growth period.",
      { size: 9.2 },
    );

    this.section("Human Review & Approval");
    this.line(`Teacher review recorded: ${dateLabel(this.input.reviewedAt)}`, {
      size: 9.2,
    });
    this.line(`School approval recorded: ${dateLabel(this.input.finalisedAt)}`, {
      size: 9.2,
    });

    this.line(
      "Prepared through KSI - KAEC School Intelligence, by KAEC-NG. This is an educational growth report, not a medical, psychiatric or psychological diagnosis.",
      { size: 8.5, color: MUTED, gapBefore: 12 },
    );

    return [...this.pages, this.commands];
  }
}

function buildPdfObjects(pageCommands: string[][], input: DiagnosisPdfInput) {
  const logo = Buffer.from(input.brandLogoJpegBase64, "base64");
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
      `<< /Type /XObject /Subtype /Image /Width ${input.hasSchoolLogo ? 480 : 1} /Height ${input.hasSchoolLogo ? 480 : 1} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`,
    ),
    logo,
    Buffer.from("\nendstream"),
  ]);

  for (let index = 0; index < pageCount; index += 1) {
    const contentRef = 6 + index * 2;
    const pageRef = 7 + index * 2;
    const footer = [
      rgb(MUTED),
      `BT /F1 7.2 Tf 1 0 0 1 28 20 Tm (${pdfEscape(KSI_PDF_ATTRIBUTION)} | Diagnosis | Page ${index + 1} of ${pageCount}) Tj ET`,
    ];
    const content = `${pageCommands[index].join("\n")}\n${footer.join("\n")}`;
    const contentBytes = Buffer.from(content, "utf8");
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
  embedUnicodePdfFonts(objects);
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
  const xref = ["xref", `0 ${maxObject + 1}`, "0000000000 65535 f "];
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

export function createDiagnosisPdf(input: DiagnosisPdfInput) {
  if (!input.reviewedAt || !input.finalisedAt) {
    throw new Error(
      "Parent diagnosis PDF requires completed human review and approval.",
    );
  }
  if (!input.academicSession || !input.term) {
    throw new Error("Parent diagnosis PDF requires Academic Session and Term.");
  }

  const pages = new FlowPage(input).build();
  return serializePdf(buildPdfObjects(pages, input));
}

export function safeDiagnosisPdfFilename(studentName: string) {
  const slug = ascii(studentName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "student"}-diagnosis-report.pdf`;
}
