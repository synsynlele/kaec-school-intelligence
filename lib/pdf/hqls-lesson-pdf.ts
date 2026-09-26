import { HQLS_STAGES } from "@/lib/domain/hqls";
import type { HqlsStageContent } from "@/lib/hqls/engine";
import { KSI_PDF_ATTRIBUTION } from "@/lib/pdf/pdf-branding";

export type HqlsLessonPdfInput = {
  workspaceName: string;
  brandLogoJpegBase64: string;
  hasSchoolLogo: boolean;
  title: string;
  subject: string;
  classLevel: string;
  ageRange: string | null;
  durationMinutes: number | null;
  topic: string;
  objective: string;
  fidelityScore: number | null;
  sources: string[];
  stages: HqlsStageContent[];
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 54;
const RIGHT = 54;
const TOP = 64;
const BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const NAVY: [number, number, number] = [0.05, 0.24, 0.38];
const BLUE: [number, number, number] = [0.03, 0.48, 0.72];
const RED: [number, number, number] = [0.82, 0.19, 0.2];
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
    .replace(/\u00b2/g, "^2")
    .replace(/\u00b3/g, "^3")
    .replace(/\u2074/g, "^4")
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
  const paragraphs = clean.split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) {
        line = next;
      } else {
        if (line) lines.push(line);
        if (word.length <= maxChars) {
          line = word;
        } else {
          for (let index = 0; index < word.length; index += maxChars) {
            const part = word.slice(index, index + maxChars);
            if (part.length === maxChars) lines.push(part);
            else line = part;
          }
        }
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function canonicalStageDefinition(stageNumber: number) {
  return HQLS_STAGES[stageNumber - 1] ?? HQLS_STAGES[0];
}

function rgb([r, g, b]: [number, number, number]) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function strokeRgb([r, g, b]: [number, number, number]) {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`;
}

class PdfComposer {
  private pages: string[][] = [];
  private current: string[] = [];
  private y = PAGE_HEIGHT - TOP;

  constructor(private readonly input: HqlsLessonPdfInput) {
    this.newPage();
  }

  private header() {
    if (this.input.hasSchoolLogo) {
      this.current.push("q 42 0 0 42 54 744 cm /Im1 Do Q");
    } else {
      this.current.push(rgb(NAVY));
      this.current.push("BT /F2 17 Tf 1 0 0 1 54 781 Tm (KSI) Tj ET");
    }
    const schoolX = this.input.hasSchoolLogo ? 108 : 54;
    this.current.push(rgb(NAVY));
    this.current.push(
      `BT /F2 13 Tf 1 0 0 1 ${schoolX} 783 Tm (${pdfEscape(this.input.workspaceName.toUpperCase())}) Tj ET`,
    );
    this.current.push(rgb(MUTED));
    this.current.push(
      `BT /F1 8.2 Tf 1 0 0 1 ${schoolX} 768 Tm (HQLS Lesson | Powered by KSI | by KAEC-NG) Tj ET`,
    );
    this.current.push(rgb(BLUE));
    this.current.push("54 752 487 1.4 re f");
    this.y = 729;
  }

  private newPage() {
    if (this.current.length) this.pages.push(this.current);
    this.current = [];
    this.header();
  }

  private ensure(height: number) {
    if (this.y - height < BOTTOM + 20) this.newPage();
  }

  line(text: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const indent = options.indent ?? 0;
    const gapBefore = options.gapBefore ?? 0;
    const gapAfter = options.gapAfter ?? 2;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH - indent;
    const wrapped = wrapText(text, maxWidth, size, bold);
    if (!wrapped.length) return;

    const leading = size * 1.35;
    this.ensure(gapBefore + leading + gapAfter);
    this.y -= gapBefore;

    for (const wrappedLine of wrapped) {
      this.ensure(leading + gapAfter);
      this.current.push(rgb(options.color ?? TEXT));
      this.current.push(
        `BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf 1 0 0 1 ${(LEFT + indent).toFixed(1)} ${this.y.toFixed(1)} Tm (${pdfEscape(wrappedLine)}) Tj ET`,
      );
      this.y -= leading;
    }

    this.y -= gapAfter;
  }

  rule(color: [number, number, number] = [0.84, 0.85, 0.87]) {
    this.ensure(9);
    this.current.push(rgb(color));
    this.current.push(
      `${LEFT} ${this.y.toFixed(1)} ${CONTENT_WIDTH} 0.7 re f`,
    );
    this.y -= 9;
  }

  bullet(text: string, color: [number, number, number] = TEXT) {
    this.line(`- ${text}`, {
      indent: 12,
      maxWidth: CONTENT_WIDTH - 12,
      color,
      size: 9.4,
    });
  }

  detailSection(
    label: string,
    value: string | string[],
    options: { color?: [number, number, number]; bullets?: boolean } = {},
  ) {
    const items = Array.isArray(value)
      ? value.map((item) => ascii(item)).filter(Boolean)
      : [ascii(value)].filter(Boolean);
    if (!items.length) return;

    this.line(label, {
      bold: true,
      size: 9.8,
      color: options.color ?? BLUE,
      gapBefore: 2,
      gapAfter: 2,
    });

    if (Array.isArray(value) || options.bullets) {
      items.forEach((item) => this.bullet(item, options.color === RED ? RED : TEXT));
    } else {
      this.line(items[0], { size: 9.4, gapAfter: 5 });
    }
  }

  teachingNote(text: string) {
    const blocks = ascii(text)
      .split(/\n+/)
      .map((block) => block.trim())
      .filter(Boolean);

    for (const block of blocks) {
      if (block.startsWith("- ")) {
        this.bullet(block.slice(2));
        continue;
      }

      const looksLikeHeading =
        block.length <= 72 &&
        block.endsWith(":") &&
        !/[.!?]/.test(block.slice(0, -1));

      this.line(block, {
        bold: looksLikeHeading,
        size: looksLikeHeading ? 9.8 : 9.5,
        color: looksLikeHeading ? BLUE : TEXT,
        gapBefore: looksLikeHeading ? 3 : 0,
        gapAfter: looksLikeHeading ? 2 : 5,
      });
    }
  }

  teacherFollowUpPanel(sections: Array<{
    label: string;
    value: string | string[];
    labelColor?: [number, number, number];
  }>) {
    const prepared = sections
      .map((section) => ({
        ...section,
        items: Array.isArray(section.value)
          ? section.value.map((item) => ascii(item)).filter(Boolean)
          : [ascii(section.value)].filter(Boolean),
      }))
      .filter((section) => section.items.length > 0);

    if (!prepared.length) return;

    const bodySize = 7.8;
    const bodyLeading = 10.4;
    const innerWidth = CONTENT_WIDTH - 24;
    const rows = prepared.map((section) => ({
      ...section,
      lines: section.items.flatMap((item) =>
        wrapText(item, innerWidth, bodySize).map((line, index) =>
          section.items.length > 1 && index === 0 ? `- ${line}` : line,
        ),
      ),
    }));

    const height =
      28 +
      rows.reduce(
        (total, row) => total + 10 + row.lines.length * bodyLeading + 6,
        0,
      );

    this.ensure(height + 8);

    const top = this.y;
    const bottom = top - height;

    this.current.push("q 0.973 0.978 0.982 rg");
    this.current.push(
      `${LEFT} ${bottom.toFixed(1)} ${CONTENT_WIDTH} ${height.toFixed(1)} re f Q`,
    );
    this.current.push(`q ${strokeRgb([0.82, 0.84, 0.87])} 0.7 w`);
    this.current.push(
      `${LEFT} ${bottom.toFixed(1)} ${CONTENT_WIDTH} ${height.toFixed(1)} re S Q`,
    );

    let cursor = top - 13;
    this.current.push(rgb(NAVY));
    this.current.push(
      `BT /F2 8.4 Tf 1 0 0 1 ${(LEFT + 10).toFixed(1)} ${cursor.toFixed(1)} Tm (Teacher follow-up guide) Tj ET`,
    );
    cursor -= 15;

    for (const row of rows) {
      this.current.push(rgb(row.labelColor ?? MUTED));
      this.current.push(
        `BT /F2 7.6 Tf 1 0 0 1 ${(LEFT + 10).toFixed(1)} ${cursor.toFixed(1)} Tm (${pdfEscape(row.label)}) Tj ET`,
      );
      cursor -= 10;

      this.current.push(rgb(TEXT));
      for (const line of row.lines) {
        this.current.push(
          `BT /F1 ${bodySize.toFixed(1)} Tf 1 0 0 1 ${(LEFT + 10).toFixed(1)} ${cursor.toFixed(1)} Tm (${pdfEscape(line)}) Tj ET`,
        );
        cursor -= bodyLeading;
      }
      cursor -= 5;
    }

    this.y = bottom - 7;
  }

  addLesson() {
    this.line("HQLS LESSON PLAN", {
      bold: true,
      size: 18,
      color: NAVY,
      gapAfter: 4,
    });
    this.line(this.input.title, {
      bold: true,
      size: 13.5,
      color: TEXT,
      gapAfter: 8,
    });

    const fidelity =
      this.input.fidelityScore === null
        ? "HQLS validation recorded"
        : `HQLS VALIDATED - Fidelity ${this.input.fidelityScore}/100`;
    this.line(fidelity, {
      bold: true,
      size: 9,
      color: [0.03, 0.42, 0.25],
      gapAfter: 8,
    });

    this.rule();
    this.line(`Workspace: ${this.input.workspaceName}`, {
      bold: true,
      size: 9.5,
    });
    this.line(
      `Subject: ${this.input.subject}    Class: ${this.input.classLevel}`,
      { size: 9.5 },
    );
    this.line(
      `Topic: ${this.input.topic}    Age: ${this.input.ageRange || "Not specified"}    Duration: ${this.input.durationMinutes ? `${this.input.durationMinutes} minutes` : "Not specified"}`,
      { size: 9.5 },
    );
    this.line(`Objective: ${this.input.objective}`, {
      size: 9.5,
      gapAfter: 6,
    });
    if (this.input.sources.length) {
      this.line(`Authorised sources: ${this.input.sources.join(", ")}`, {
        size: 8.5,
        color: MUTED,
        gapAfter: 8,
      });
    }
    this.rule();

    for (const stage of this.input.stages) {
      const definition = canonicalStageDefinition(stage.stageNumber);
      this.ensure(115);
      this.line(`STAGE ${stage.stageNumber} - ${definition.title}`, {
        bold: true,
        size: 13,
        color: NAVY,
        gapBefore: 7,
        gapAfter: 3,
      });
      this.line(definition.purpose, {
        size: 9,
        color: MUTED,
        gapAfter: 6,
      });

      if (stage.stageNumber !== 5 && stage.experience) {
        this.detailSection("What happens in this stage", stage.experience);
      }

      if (stage.stageNumber !== 5 && stage.teacherPrompts.length) {
        this.detailSection(
          "What the teacher says or does",
          stage.teacherPrompts,
          { bullets: true },
        );
      }

      if (stage.stageNumber === 5 && stage.teachingContent) {
        this.line("Full Illumination - complete teaching note", {
          bold: true,
          size: 10.4,
          color: NAVY,
          gapBefore: 3,
          gapAfter: 2,
        });
        this.line("Teach this after learners have made their first attempt.", {
          size: 8.7,
          color: MUTED,
          gapAfter: 4,
        });
        this.teachingNote(stage.teachingContent);
      }

      if (stage.respondsToFirstAttempt) {
        this.detailSection(
          "How this connects to the first attempt",
          stage.respondsToFirstAttempt,
        );
      }

      if (stage.learnerActions.length) {
        this.detailSection(
          "What learners should do",
          stage.learnerActions,
          { bullets: true },
        );
      }

      this.teacherFollowUpPanel([
        {
          label: "Expected struggle",
          value: stage.productiveStruggle,
          labelColor: RED,
        },
        {
          label: "What the teacher must not do",
          value: stage.guideGuardrails,
          labelColor: RED,
        },
        {
          label: "What the teacher should look for",
          value: stage.evidenceToNotice,
        },
      ]);

      if (stage.reflectionPrompt) {
        this.detailSection("Reflection questions", stage.reflectionPrompt);
      }
      if (stage.transferTask) {
        this.detailSection(
          "Real-life follow-up / transfer task",
          stage.transferTask,
        );
      }
      this.rule();
    }

    if (this.current.length) this.pages.push(this.current);
    return this.pages;
  }
}

function buildPdfObjects(pageCommands: string[][], input: HqlsLessonPdfInput) {
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
      `BT /F1 7.5 Tf 1 0 0 1 54 30 Tm (${pdfEscape(KSI_PDF_ATTRIBUTION)} | HQLS | Page ${index + 1} of ${pageCount}) Tj ET`,
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

export function createHqlsLessonPdf(input: HqlsLessonPdfInput) {
  if (input.stages.length !== 7) {
    throw new Error("A teacher-ready HQLS PDF requires all seven lesson stages.");
  }
  const pages = new PdfComposer(input).addLesson();
  return serializePdf(buildPdfObjects(pages, input));
}

export function safePdfFilename(title: string) {
  const slug = ascii(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${slug || "hqls-lesson"}.pdf`;
}
