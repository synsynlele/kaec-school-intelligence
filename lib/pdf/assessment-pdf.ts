import type {
  GeneratedAssessment,
  GeneratedAssessmentItem,
} from "@/lib/assessment/engine";
import { KSI_PDF_ATTRIBUTION } from "@/lib/pdf/pdf-branding";

export type AssessmentPdfMode = "exam" | "marking";

export type AssessmentPdfInput = {
  workspaceName: string;
  brandLogoJpegBase64: string;
  hasSchoolLogo: boolean;
  subject: string;
  classLevel: string;
  academicSession?: string | null;
  term?: string | null;
  topic: string;
  objective: string;
  durationMinutes: number | null;
  assessmentType?: string | null;
  overallDifficulty?: string | null;
  topicCoverage?: string[];
  assessment: GeneratedAssessment;
};

type TextOptions = {
  bold?: boolean;
  size?: number;
  color?: [number, number, number];
  indent?: number;
  gapBefore?: number;
  gapAfter?: number;
  maxWidth?: number;
};

type SectionDefinition = {
  type: GeneratedAssessmentItem["itemType"];
  title: string;
  instruction: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const RIGHT = 48;
const TOP = 48;
const BOTTOM = 52;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const NAVY: [number, number, number] = [0.043, 0.196, 0.408];
const TEAL: [number, number, number] = [0.063, 0.725, 0.604];
const TEXT: [number, number, number] = [0.11, 0.12, 0.14];
const MUTED: [number, number, number] = [0.38, 0.4, 0.44];
const GREEN: [number, number, number] = [0.02, 0.42, 0.25];

const SECTIONS: SectionDefinition[] = [
  {
    type: "objective",
    title: "OBJECTIVE",
    instruction: "Choose the best answer for each question.",
  },
  {
    type: "subjective",
    title: "SUBJECTIVE / THEORY",
    instruction: "Answer the questions according to the instructions on this paper.",
  },
  {
    type: "critical_thinking",
    title: "CRITICAL THINKING / REASONING",
    instruction: "Read each situation carefully and show your reasoning in your answers.",
  },
  {
    type: "project",
    title: "PROJECT / PRACTICAL",
    instruction: "Complete the required task or deliverable as instructed.",
  },
];

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

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  bold = false,
) {
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

function rgb([r, g, b]: [number, number, number]) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function assessmentLabel(value: string | null | undefined) {
  if (!value) return "Assessment";
  if (value === "exam") return "Examination";
  return titleCase(value);
}

function groupedItems(assessment: GeneratedAssessment) {
  return SECTIONS.map((section) => ({
    ...section,
    items: assessment.items.filter((item) => item.itemType === section.type),
  })).filter((section) => section.items.length > 0);
}

class PdfComposer {
  private pages: string[][] = [];
  private current: string[] = [];
  private y = PAGE_HEIGHT - TOP;

  constructor(
    private readonly input: AssessmentPdfInput,
    private readonly mode: AssessmentPdfMode,
  ) {
    this.newPage();
  }

  private header() {
    if (this.input.hasSchoolLogo) {
      this.current.push("q 42 0 0 42 48 751 cm /Im1 Do Q");
    } else {
      this.current.push(rgb(NAVY));
      this.current.push("BT /F2 18 Tf 1 0 0 1 48 780 Tm (KSI) Tj ET");
      this.current.push(rgb(TEAL));
      this.current.push("48 757 34 4 re f");
    }

    const schoolX = this.input.hasSchoolLogo ? 101 : 48;
    this.current.push(rgb(NAVY));
    this.current.push(
      `BT /F2 12.5 Tf 1 0 0 1 ${schoolX} 780 Tm (${pdfEscape(this.input.workspaceName.toUpperCase())}) Tj ET`,
    );
    this.current.push(rgb(MUTED));
    this.current.push(
      `BT /F1 7.8 Tf 1 0 0 1 ${schoolX} 766 Tm (KSI | KAEC School Intelligence | by KAEC-NG) Tj ET`,
    );
    this.current.push(rgb(TEAL));
    this.current.push("48 744 499 1.4 re f");
    this.y = 724;
  }

  private newPage() {
    if (this.current.length) this.pages.push(this.current);
    this.current = [];
    this.header();
  }

  private ensure(height: number) {
    if (this.y - height < BOTTOM + 18) this.newPage();
  }

  private line(text: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const indent = options.indent ?? 0;
    const gapBefore = options.gapBefore ?? 0;
    const gapAfter = options.gapAfter ?? 2;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH - indent;
    const wrapped = wrapText(text, maxWidth, size, bold);
    if (!wrapped.length) return;

    const leading = size * 1.34;
    this.y -= gapBefore;
    for (const wrappedLine of wrapped) {
      this.ensure(leading + gapAfter);
      this.current.push(rgb(options.color ?? TEXT));
      this.current.push(
        `BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf 1 0 0 1 ${(
          LEFT + indent
        ).toFixed(1)} ${this.y.toFixed(1)} Tm (${pdfEscape(wrappedLine)}) Tj ET`,
      );
      this.y -= leading;
    }
    this.y -= gapAfter;
  }

  private rule(gap = 8) {
    this.ensure(gap + 2);
    this.current.push("0.850 0.860 0.880 rg");
    this.current.push(`${LEFT} ${this.y.toFixed(1)} ${CONTENT_WIDTH} 0.7 re f`);
    this.y -= gap;
  }

  private sectionHeading(index: number, title: string, instruction: string) {
    this.ensure(42);
    const letter = String.fromCharCode(65 + index);
    this.current.push(rgb(NAVY));
    this.current.push(`${LEFT} ${(this.y - 24).toFixed(1)} ${CONTENT_WIDTH} 31 re f`);
    this.current.push("1 1 1 rg");
    this.current.push(
      `BT /F2 11 Tf 1 0 0 1 ${LEFT + 12} ${(this.y - 5).toFixed(1)} Tm (SECTION ${letter} - ${pdfEscape(title)}) Tj ET`,
    );
    this.current.push("0.900 0.950 0.970 rg");
    this.current.push(
      `BT /F1 8 Tf 1 0 0 1 ${LEFT + 12} ${(this.y - 18).toFixed(1)} Tm (${pdfEscape(instruction)}) Tj ET`,
    );
    this.y -= 42;
  }

  private examFrontMatter() {
    const { assessment } = this.input;
    this.line(assessmentLabel(this.input.assessmentType).toUpperCase(), {
      bold: true,
      size: 10,
      color: TEAL,
      gapAfter: 4,
    });
    this.line(assessment.title, {
      bold: true,
      size: 16,
      color: NAVY,
      gapAfter: 7,
    });

    this.line("Name: ____________________________________________    Date: ____________________", {
      size: 9.3,
      gapAfter: 7,
    });
    this.line(
      `Subject: ${this.input.subject}    Class: ${this.input.classLevel}    Total Marks: ${assessment.blueprint.totalMarks}`,
      { bold: true, size: 9.2 },
    );
    this.line(
      `Session: ${this.input.academicSession || "Not specified"}    Term: ${this.input.term || "Not specified"}    Duration: ${
        this.input.durationMinutes ? `${this.input.durationMinutes} minutes` : "Not specified"
      }`,
      { size: 9.2, gapAfter: 7 },
    );
    this.rule();

    this.line("GENERAL INSTRUCTIONS", {
      bold: true,
      size: 9.5,
      color: NAVY,
      gapAfter: 3,
    });
    this.line(assessment.studentInstructions || "Answer all questions as instructed.", {
      size: 9.1,
      gapAfter: 7,
    });
    this.rule();
  }

  private examQuestion(item: GeneratedAssessmentItem) {
    this.line(
      `${item.position}. ${item.prompt} [${item.marks} mark${item.marks === 1 ? "" : "s"}]`,
      {
        bold: item.itemType !== "critical_thinking",
        size: 9.8,
        gapBefore: 4,
        gapAfter: 3,
      },
    );

    if (item.itemType === "objective") {
      item.options.forEach((option, index) => {
        this.line(`${String.fromCharCode(65 + index)}. ${option}`, {
          indent: 16,
          size: 9.2,
          gapAfter: 1,
        });
      });
    }

    if (item.itemType === "project" && item.deliverable) {
      this.line(`Deliverable: ${item.deliverable}`, {
        indent: 10,
        size: 8.9,
        color: MUTED,
      });
    }

    this.y -= 4;
  }

  private addExam() {
    this.examFrontMatter();
    groupedItems(this.input.assessment).forEach((section, index) => {
      this.sectionHeading(index, section.title, section.instruction);
      section.items.forEach((item) => this.examQuestion(item));
      this.y -= 5;
    });
  }

  private addMarkingGuide() {
    const { assessment } = this.input;
    this.line("MARKING GUIDE - NOT FOR STUDENTS", {
      bold: true,
      size: 14,
      color: NAVY,
      gapAfter: 4,
    });
    this.line(assessment.title, { bold: true, size: 12, gapAfter: 4 });
    this.line(
      `${this.input.subject} | ${this.input.classLevel} | ${this.input.academicSession || "Session not specified"} | ${this.input.term || "Term not specified"}`,
      { size: 8.8, color: MUTED, gapAfter: 7 },
    );
    this.line("KSI assessment quality validation recorded.", {
      bold: true,
      size: 8.8,
      color: GREEN,
      gapAfter: 6,
    });
    this.rule();

    for (const item of assessment.items) {
      this.line(
        `Item ${item.position} - ${titleCase(item.itemType)} - ${item.marks} mark${item.marks === 1 ? "" : "s"}`,
        { bold: true, size: 10.1, color: NAVY, gapBefore: 5 },
      );
      this.line(item.prompt, { size: 9.1, gapAfter: 3 });

      if (item.itemType === "objective") {
        this.line(`Answer: ${item.correctAnswer}`, {
          bold: true,
          size: 9.2,
          color: GREEN,
        });
        if (item.answerRationale) {
          this.line(`Rationale: ${item.answerRationale}`, { size: 8.9 });
        }
      } else {
        if (item.expectedEvidence.length) {
          this.line("Expected evidence", { bold: true, size: 8.9, color: TEAL });
          item.expectedEvidence.forEach((entry) =>
            this.line(`- ${entry}`, { indent: 10, size: 8.8 }),
          );
        }
        if (item.markingGuide.length) {
          this.line("Marking criteria", { bold: true, size: 8.9, color: TEAL });
          item.markingGuide.forEach((entry) =>
            this.line(`- ${entry}`, { indent: 10, size: 8.8 }),
          );
        }
      }

      if (item.criticalThinkingType) {
        this.line(
          `Critical-thinking experience: ${titleCase(item.criticalThinkingType)}`,
          { size: 8.3, color: MUTED },
        );
      }
      this.rule(7);
    }
  }

  compose() {
    if (this.mode === "exam") this.addExam();
    else this.addMarkingGuide();

    if (this.current.length) this.pages.push(this.current);
    return this.pages;
  }
}

function buildPdfObjects(
  pageCommands: string[][],
  logoJpegBase64: string,
  hasSchoolLogo: boolean,
) {
  const logo = Buffer.from(logoJpegBase64, "base64");
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
  const dimension = hasSchoolLogo ? 480 : 1;
  objects[5] = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${dimension} /Height ${dimension} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`,
    ),
    logo,
    Buffer.from("\nendstream"),
  ]);

  for (let index = 0; index < pageCount; index += 1) {
    const contentRef = 6 + index * 2;
    const pageRef = 7 + index * 2;
    const footer = [
      rgb(MUTED),
      `BT /F1 7.2 Tf 1 0 0 1 48 28 Tm (${pdfEscape(KSI_PDF_ATTRIBUTION)} | Page ${index + 1} of ${pageCount}) Tj ET`,
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
  const xref: string[] = [
    "xref",
    `0 ${maxObject + 1}`,
    "0000000000 65535 f ",
  ];

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

export function createAssessmentPdf(
  input: AssessmentPdfInput,
  mode: AssessmentPdfMode = "exam",
) {
  if (!input.assessment.items.length) {
    throw new Error("A teacher-ready assessment PDF requires assessment items.");
  }

  const commands = new PdfComposer(input, mode).compose();
  return serializePdf(
    buildPdfObjects(commands, input.brandLogoJpegBase64, input.hasSchoolLogo),
  );
}

function safeSlug(title: string) {
  return (
    ascii(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 68) || "ksi-assessment"
  );
}

export function safeAssessmentPdfFilename(
  title: string,
  mode: AssessmentPdfMode = "exam",
) {
  return `${safeSlug(title)}-${mode === "exam" ? "exam-paper" : "marking-guide"}.pdf`;
}
