import type { GeneratedDiagnosis } from "@/lib/diagnosis/engine";
import { KAEC_REPORT_LOGO_JPEG_BASE64 } from "@/lib/pdf/kaec-report-logo";

export type DiagnosisPdfInput = {
  workspaceName: string;
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
const CREAM: Color = [0.965, 0.94, 0.84];
const TEXT: Color = [0.10, 0.10, 0.11];
const MUTED: Color = [0.38, 0.39, 0.40];
const BORDER: Color = [0.78, 0.79, 0.77];
const SOFT: Color = [0.975, 0.975, 0.968];

function ascii(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->")
    .replace(/\u2022/g, "-")
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

function rgb([r, g, b]: Color) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function strokeRgb([r, g, b]: Color) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`;
}

function wrapText(text: string, maxWidth: number, fontSize: number, bold = false) {
  const clean = ascii(text);
  if (!clean) return [];
  const averageGlyph = fontSize * (bold ? 0.56 : 0.51);
  const maxChars = Math.max(10, Math.floor(maxWidth / averageGlyph));
  const lines: string[] = [];
  for (const paragraph of clean.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
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

function rectTop(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  fill: Color | null,
  stroke: Color | null = BORDER,
) {
  const y = PAGE_HEIGHT - top - height;
  if (fill) {
    commands.push(rgb(fill));
    commands.push(`${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re f`);
  }
  if (stroke) {
    commands.push(strokeRgb(stroke));
    commands.push("0.7 w");
    commands.push(`${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re S`);
  }
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

function listInCell(
  commands: string[],
  items: string[],
  x: number,
  top: number,
  width: number,
  height: number,
) {
  const content = items.length
    ? items.map((item) => `- ${ascii(item)}`).join("\n")
    : "- Insufficient Evidence to state a supported finding at this time.";
  boxedText(commands, content, x, top, width, height, {
    size: 8.15,
    padding: 7,
  });
}

function groupedMatrix(
  commands: string[],
  top: number,
  groupLeft: string,
  groupRight: string,
  subheads: [string, string, string, string],
  columns: [string[], string[], string[], string[]],
  contentHeight: number,
) {
  const colWidth = CONTENT_WIDTH / 4;
  const groupHeight = 24;
  const subHeight = 22;
  const left = MARGIN_X;

  rectTop(commands, left, top, colWidth * 2, groupHeight, FOREST, FOREST);
  rectTop(
    commands,
    left + colWidth * 2,
    top,
    colWidth * 2,
    groupHeight,
    FOREST,
    FOREST,
  );
  textAtTop(commands, groupLeft, left + 12, top + 5, 9.5, true, [1, 1, 1]);
  textAtTop(
    commands,
    groupRight,
    left + colWidth * 2 + 12,
    top + 5,
    9.5,
    true,
    [1, 1, 1],
  );

  for (let index = 0; index < 4; index += 1) {
    const x = left + colWidth * index;
    rectTop(commands, x, top + groupHeight, colWidth, subHeight, CREAM, BORDER);
    const headerWidth = wrapText(subheads[index], colWidth - 12, 8.2, true)[0] ?? subheads[index];
    textAtTop(commands, headerWidth, x + 7, top + groupHeight + 5, 8.2, true);
    rectTop(
      commands,
      x,
      top + groupHeight + subHeight,
      colWidth,
      contentHeight,
      [1, 1, 1],
      BORDER,
    );
    listInCell(
      commands,
      columns[index],
      x,
      top + groupHeight + subHeight,
      colWidth,
      contentHeight,
    );
  }

  return groupHeight + subHeight + contentHeight;
}

function firstPage(input: DiagnosisPdfInput) {
  const commands: string[] = [];
  const diagnosis = input.diagnosis;

  commands.push("q 42 0 0 42 30 520 cm /Im1 Do Q");
  textAtTop(commands, input.workspaceName.toUpperCase(), 82, 28, 10.5, true, FOREST);
  textAtTop(
    commands,
    "STUDENT DIAGNOSIS",
    PAGE_WIDTH - 196,
    29,
    18,
    true,
    FOREST,
  );

  rectTop(commands, 190, 23, 410, 55, [1, 1, 1], TEXT);
  textAtTop(commands, `NAME: ${input.studentName}`, 202, 32, 9.2, true);
  textAtTop(commands, `CLASS: ${input.className}`, 410, 32, 9.2, true);
  textAtTop(
    commands,
    `SESSION: ${input.academicSession || "Not specified"}`,
    202,
    54,
    9.2,
    true,
  );
  textAtTop(
    commands,
    `TERM: ${input.term || "Not specified"}`,
    410,
    54,
    9.2,
    true,
  );

  rectTop(commands, MARGIN_X, 88, CONTENT_WIDTH, 58, CREAM, BORDER);
  textAtTop(commands, "DIAGNOSIS:", MARGIN_X + 10, 98, 10, true, FOREST);
  boxedText(
    commands,
    diagnosis.conciseDiagnosis,
    MARGIN_X + 92,
    93,
    CONTENT_WIDTH - 102,
    48,
    { size: 8.6, padding: 4 },
  );

  const findingsHeight = groupedMatrix(
    commands,
    156,
    "ACADEMICS / SKILLS",
    "CHARACTER (Discipline)",
    ["Strengths", "Challenges", "Strengths", "Challenges"],
    [
      diagnosis.academicSkillStrengths.map((item) => item.statement),
      diagnosis.academicSkillChallenges.map((item) => item.statement),
      diagnosis.characterStrengths.map((item) => item.statement),
      diagnosis.characterChallenges.map((item) => item.statement),
    ],
    137,
  );

  groupedMatrix(
    commands,
    156 + findingsHeight + 10,
    "ACTION PLAN (Academics / Skills)",
    "ACTION PLAN (Character)",
    ["SCHOOL", "PARENTS", "SCHOOL", "PARENTS"],
    [
      diagnosis.schoolAcademicActions.map(
        (item) => `${item.action} (${item.timeframe})`,
      ),
      diagnosis.parentAcademicActions.map(
        (item) => `${item.action} (${item.timeframe})`,
      ),
      diagnosis.schoolCharacterActions.map(
        (item) => `${item.action} (${item.timeframe})`,
      ),
      diagnosis.parentCharacterActions.map(
        (item) => `${item.action} (${item.timeframe})`,
      ),
    ],
    137,
  );

  textAtTop(
    commands,
    "SCHOOL APPROVAL: Digitally approved through KAEC School Intelligence",
    MARGIN_X,
    565,
    7.8,
    true,
    MUTED,
  );
  textAtTop(
    commands,
    dateLabel(input.finalisedAt),
    PAGE_WIDTH - 118,
    565,
    7.8,
    false,
    MUTED,
  );

  return commands;
}

class FlowPage {
  readonly commands: string[] = [];
  private y = 516;

  constructor(private readonly input: DiagnosisPdfInput) {
    this.commands.push("q 36 0 0 36 30 523 cm /Im1 Do Q");
    textAtTop(this.commands, input.workspaceName.toUpperCase(), 78, 31, 10, true, FOREST);
    textAtTop(
      this.commands,
      "GROWTH & REVIEW NOTES",
      PAGE_WIDTH - 220,
      30,
      15,
      true,
      FOREST,
    );
    this.commands.push(rgb(FOREST));
    this.commands.push(`28 ${PAGE_HEIGHT - 76} ${CONTENT_WIDTH} 1.2 re f`);
  }

  private ensure(height: number) {
    return this.y - height > 42;
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
    const required = gapBefore + lines.length * leading + gapAfter;
    if (!this.ensure(required)) return;
    this.y -= gapBefore;
    this.commands.push(rgb(options.color ?? TEXT));
    for (const line of lines) {
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
      "Prepared through KAEC School Intelligence. This is an educational growth report, not a medical, psychiatric or psychological diagnosis.",
      { size: 8.5, color: MUTED, gapBefore: 12 },
    );

    return this.commands;
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
      `BT /F1 7.2 Tf 1 0 0 1 28 20 Tm (KAEC-NG | Student Diagnosis Intelligence | Page ${index + 1} of ${pageCount}) Tj ET`,
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

  const pages = [firstPage(input), new FlowPage(input).build()];
  return serializePdf(buildPdfObjects(pages));
}

export function safeDiagnosisPdfFilename(studentName: string) {
  const slug = ascii(studentName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "student"}-kaec-diagnosis.pdf`;
}
