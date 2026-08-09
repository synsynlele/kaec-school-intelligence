const LONG_TOKEN_THRESHOLD = 42;
const LONG_TOKEN_CHUNK = 34;

/**
 * PDF composers use simple Helvetica width estimation. Very long uninterrupted
 * tokens (URLs, IDs or generated compounds) can otherwise exceed the printable
 * column even when ordinary prose wraps correctly. Insert printable break
 * opportunities only for PDF rendering; persisted artifact content is untouched.
 */
export function pdfSafeText(value: string) {
  return value.replace(/\S{42,}/g, (token) => {
    if (token.length < LONG_TOKEN_THRESHOLD) return token;
    const parts: string[] = [];
    for (let index = 0; index < token.length; index += LONG_TOKEN_CHUNK) {
      parts.push(token.slice(index, index + LONG_TOKEN_CHUNK));
    }
    return parts.join(" ");
  });
}

export function pdfSafeValue<T>(value: T): T {
  if (typeof value === "string") return pdfSafeText(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => pdfSafeValue(item)) as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = pdfSafeValue(item);
    }
    return output as T;
  }
  return value;
}

/**
 * These KSI PDFs are deliberately assembled as fixed-length PDF content streams.
 * Header geometry patches therefore MUST preserve byte length so PDF object
 * offsets and stream lengths remain valid. The helper refuses unsafe patches.
 */
export function patchPdfCommands(
  pdf: Uint8Array,
  patches: ReadonlyArray<readonly [search: string, replacement: string]>,
) {
  const output = Buffer.from(pdf);

  for (const [search, replacement] of patches) {
    const searchBytes = Buffer.from(search, "latin1");
    const replacementBytes = Buffer.from(replacement, "latin1");
    if (searchBytes.length !== replacementBytes.length) {
      throw new Error("PDF layout patch must preserve byte length.");
    }

    let index = output.indexOf(searchBytes);
    if (index < 0) {
      throw new Error(`Expected PDF layout command was not found: ${search}`);
    }

    while (index >= 0) {
      replacementBytes.copy(output, index);
      index = output.indexOf(searchBytes, index + replacementBytes.length);
    }
  }

  return output;
}
