import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import fontkit, { type Font } from "@pdf-lib/fontkit";

/** Preserve educational notation; only discard non-printing control characters. */
export function normalizePdfText(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function escapePdfText(value: string) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

type FontSource = { bytes: Buffer; font: Font };
let cachedFonts: FontSource[] | undefined;
function fonts() {
  cachedFonts ??= ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map((name) => {
    const bytes = readFileSync(join(process.cwd(), "public", "fonts", name));
    return { bytes, font: fontkit.create(bytes) };
  });
  return cachedFonts;
}

function stream(bytes: Buffer, attributes = "") {
  const compressed = deflateSync(bytes);
  return Buffer.concat([Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode ${attributes} >>\nstream\n`), compressed, Buffer.from("\nendstream")]);
}
function utf16Hex(value: string) {
  return Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).padStart(4, "0")).join("");
}

/** Compile the composers' text commands to embedded Unicode fonts before xref serialization.
 * Maps belong to this document, never to a shared user/workspace cache.
 */
export function embedUnicodePdfFonts(objects: Buffer[]) {
  const sources = fonts();
  const maps = [new Map<string, number>(), new Map<string, number>()];
  for (let index = 1; index < objects.length; index++) {
    const raw = objects[index].toString("utf8");
    if (!raw.startsWith("<< /Length ") || !raw.includes("\nstream\n")) continue;
    const start = raw.indexOf("\nstream\n") + 8;
    const end = raw.lastIndexOf("\nendstream");
    let fontIndex = 0;
    const content = raw.slice(start, end).replace(/\/(F[12])\s+[\d.]+\s+Tf|\(((?:\\[\s\S]|[^\\)])*)\)\s*Tj/g, (match, selected: string | undefined, literal: string | undefined) => {
      if (selected) { fontIndex = selected === "F2" ? 1 : 0; return match; }
      const text = literal!.replace(/\\([\\()])/g, "$1");
      let encoded = "";
      for (const character of text) {
        const codePoint = character.codePointAt(0)!;
        if (!sources[fontIndex].font.hasGlyphForCodePoint(codePoint)) {
          throw new Error(`PDF font cannot display ${character} (U+${codePoint.toString(16).toUpperCase()}). Replace it with an accessible description before exporting; no content was removed.`);
        }
        const map = maps[fontIndex];
        if (!map.has(character)) map.set(character, map.size + 1);
        encoded += map.get(character)!.toString(16).padStart(4, "0");
      }
      return `<${encoded}> Tj`;
    });
    const bytes = Buffer.from(content, "ascii");
    objects[index] = Buffer.concat([Buffer.from(`<< /Length ${bytes.length} >>\nstream\n`), bytes, Buffer.from("\nendstream")]);
  }

  sources.forEach(({ bytes, font }, index) => {
    const map = maps[index];
    const first = objects.length;
    const cidRef = first, descriptorRef = first + 1, fontRef = first + 2, glyphRef = first + 3, unicodeRef = first + 4;
    const name = index === 0 ? "DejaVuSans" : "DejaVuSans-Bold";
    const scale = 1000 / font.unitsPerEm;
    const glyphMap = Buffer.alloc((map.size + 1) * 2);
    const widths: string[] = [];
    const mappings: string[] = [];
    for (const [character, cid] of map) {
      const glyph = font.glyphForCodePoint(character.codePointAt(0)!);
      glyphMap.writeUInt16BE(glyph.id, cid * 2);
      widths.push(`${cid} [${Math.round(glyph.advanceWidth * scale)}]`);
      mappings.push(`<${cid.toString(16).padStart(4, "0")}> <${utf16Hex(character)}>`);
    }
    const chunks: string[] = [];
    for (let i = 0; i < mappings.length; i += 100) {
      const chunk = mappings.slice(i, i + 100);
      chunks.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
    }
    const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /KSIUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
    objects[3 + index] = Buffer.from(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cidRef} 0 R] /ToUnicode ${unicodeRef} 0 R >>`);
    objects[cidRef] = Buffer.from(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorRef} 0 R /CIDToGIDMap ${glyphRef} 0 R /DW 600 /W [${widths.join(" ")}] >>`);
    const box = [font.bbox.minX, font.bbox.minY, font.bbox.maxX, font.bbox.maxY].map((n) => Math.round(n * scale)).join(" ");
    objects[descriptorRef] = Buffer.from(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${box}] /ItalicAngle 0 /Ascent ${Math.round(font.ascent * scale)} /Descent ${Math.round(font.descent * scale)} /CapHeight ${Math.round(font.capHeight * scale)} /StemV ${index ? 120 : 80} /FontFile2 ${fontRef} 0 R >>`);
    objects[fontRef] = stream(bytes, `/Length1 ${bytes.length}`);
    objects[glyphRef] = stream(glyphMap);
    objects[unicodeRef] = stream(Buffer.from(cmap));
  });
  return objects;
}

/** Wrap with the embedded font's real advances, including IPA and mathematical notation. */
export function wrapPdfText(value: string, maxWidth: number, size: number, bold = false) {
  const font = fonts()[bold ? 1 : 0].font;
  const width = (text: string) => Array.from(text).reduce((total, character) =>
    total + font.glyphForCodePoint(character.codePointAt(0)!).advanceWidth * size / font.unitsPerEm, 0);
  const lines: string[] = [];
  for (const paragraph of normalizePdfText(value).split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (width(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && width(line + character) > maxWidth) { lines.push(line); line = ""; }
        line += character;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
