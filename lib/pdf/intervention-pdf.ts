import { KAEC_REPORT_LOGO_JPEG_BASE64 } from "@/lib/pdf/kaec-report-logo";

export type InterventionPdfAction = {
  domain: string;
  action: string;
  timeframe?: string | null;
};

export type InterventionPdfInput = {
  workspaceName: string;
  studentName: string;
  className: string;
  status: string;
  diagnosisSummary: string;
  priorityGrowthTarget: string;
  evidenceBasis: string;
  schoolIntervention: InterventionPdfAction[];
  parentIntervention: InterventionPdfAction[];
  timeframe: string;
  successIndicator: string;
  reviewDate: string | null;
  nextLearningAdjustment: string;
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
const GREEN: [number, number, number] = [0.03, 0.42, 0.25];
const TEXT: [number, number, number] = [0.12, 0.12, 0.14];
const MUTED: [number, number, number] = [0.38, 0.4, 0.44];

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

class PdfComposer {
  private pages: string[][] = [];
  private current: string[] = [];
  private y = PAGE_HEIGHT - TOP;

  constructor(private readonly input: InterventionPdfInput) {
    this.newPage();
  }

  private header() {
    this.current.push("q 34 0 0 34 54 756 cm /Im1 Do Q");
    this.current.push(rgb(NAVY));
    this.current.push("BT /F2 13 Tf 1 0 0 1 101 782 Tm (KAEC-NG) Tj ET");
    this.current.push(rgb(MUTED));
    this.current.push(
      "BT /F1 8.5 Tf 1 0 0 1 101 768 Tm (KAEC School Intelligence - Action & Intervention) Tj ET",
    );
    this.current.push(rgb(GREEN));
    this.current.push("54 746 487 1.3 re f");
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

  section(title: string, text: string) {
    if (!text.trim()) return;
    this.line(title, { bold: true, size: 10.5, color: BLUE, gapBefore: 4 });
    this.line(text, { size: 9.5, gapAfter: 5 });
  }

  actions(title: string, actions: InterventionPdfAction[]) {
    this.line(title, { bold: true, size: 10.5, color: BLUE, gapBefore: 4 });
    if (!actions.length) {
      this.line("No action recorded.", { size: 9.3, color: MUTED, gapAfter: 5 });
      return;
    }
    actions.forEach((item, index) => {
      const timeframe = item.timeframe?.trim() ? ` | Timeframe: ${item.timeframe.trim()}` : "";
      this.line(
        `${index + 1}. [${titleCase(item.domain || "academic")}] ${item.action}${timeframe}`,
        { size: 9.4, indent: 8, gapAfter: 3 },
      );
    });
    this.line(" ", { gapAfter: 3 });
  }

  compose() {
    this.line("ACTION & INTERVENTION PLAN", { bold: true, size: 17, color: NAVY });
    this.line(this.input.studentName, { bold: true, size: 13, gapAfter: 5 });
    this.line(`School / workspace: ${this.input.workspaceName}`, { size: 9.3 });
    this.line(`Class: ${this.input.className}`, { size: 9.3 });
    this.line(`Status: ${titleCase(this.input.status)}`, { size: 9.3, color: GREEN });
    this.rule();

    this.section("Approved diagnosis baseline", this.input.diagnosisSummary);
    this.section("Priority growth target", this.input.priorityGrowthTarget);
    this.section("Evidence basis", this.input.evidenceBasis);
    this.rule();

    this.actions("School intervention", this.input.schoolIntervention);
    this.actions("Parent intervention", this.input.parentIntervention);
    this.rule();

    this.section("Overall timeframe", this.input.timeframe);
    this.section("Success indicator", this.input.successIndicator);
    if (this.input.reviewDate) this.section("Review date", this.input.reviewDate);
    this.section("Next learning adjustment", this.input.nextLearningAdjustment);

    this.line(
      "This plan is generated from an approved diagnosis and should be reviewed against new first-hand evidence at the stated checkpoint.",
      { size: 8.8, color: MUTED, gapBefore: 8 },
    );

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
      `BT /F1 7.5 Tf 1 0 0 1 54 30 Tm (KAEC-NG | Action & Intervention | Page ${index + 1} of ${pageCount}) Tj ET`,
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

export function createInterventionPdf(input: InterventionPdfInput) {
  if (!input.priorityGrowthTarget.trim()) {
    throw new Error("An intervention PDF requires a priority growth target.");
  }
  return serializePdf(buildPdfObjects(new PdfComposer(input).compose()));
}

export function safeInterventionPdfFilename(studentName: string) {
  const slug = ascii(studentName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "student"}-intervention-plan.pdf`;
}
