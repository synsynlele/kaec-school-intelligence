import { createClient } from "@supabase/supabase-js";

import { generateOpenAIJson, OpenAIProviderError } from "@/lib/ai/openai";
import { getSupabasePublicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const TERMS = ["First Term", "Second Term", "Third Term"] as const;
const CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          class_level: { type: "string", enum: CLASSES },
          term: { type: "string", enum: TERMS },
          week_label: { type: "string" },
          week_number: { type: ["integer", "null"] },
          component_name: { type: "string" },
          topic: { type: "string" },
          learning_objectives: { type: "array", items: { type: "string" } },
          learning_activities: { type: "array", items: { type: "string" } },
          embedded_core_skills: { type: "array", items: { type: "string" } },
          learning_resources: { type: "array", items: { type: "string" } },
          source_page: { type: ["integer", "null"] },
          source_reference: { type: "string" },
        },
      },
    },
  },
} as const;

type ExtractedRow = {
  class_level: string;
  term: string;
  week_label: string;
  week_number: number | null;
  component_name: string;
  topic: string;
  learning_objectives: string[];
  learning_activities: string[];
  embedded_core_skills: string[];
  learning_resources: string[];
  source_page: number | null;
  source_reference: string;
};

type Extraction = { rows: ExtractedRow[] };
type ReviewDocument = {
  id: string;
  filename: string;
  subject: string;
  class_scope: string[];
  metadata?: Record<string, unknown>;
};

type ReviewConsole = { documents?: ReviewDocument[] };

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

async function authenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new Error("Authentication is required.");

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Your session is no longer valid. Sign in again and retry.");
  return supabase;
}

function extractionInstruction(document: ReviewDocument, classLevel: string, term: string) {
  return `You are KSI's source-faithful Scheme of Work extraction utility.

You are given the original supplied PDF registered as "${document.filename}" for ${document.subject}.
Extract ONLY rows belonging to ${classLevel}, ${term}.

The source table may contain these columns: WEEK(S), TOPIC(S), LEARNING OBJECTIVES, LEARNING ACTIVITIES, EMBEDDED CORE SKILLS, LEARNING RESOURCES. Preserve their meaning faithfully.

NON-NEGOTIABLE RULES:
1. This is transcription/extraction, not curriculum writing. Never invent a missing cell.
2. If a source cell is blank or genuinely absent, return an empty array for that field.
3. Preserve every weekly row for the requested class and term, including revision, examination, mid-term or resumption rows when the source contains them.
4. Some subjects contain several component rows in one week. Return each component as a separate row and use component_name where the source identifies one.
5. class_level must be exactly ${classLevel}; term must be exactly ${term}.
6. week_label should preserve the source wording such as "Week 1", "Weeks 4-5" or equivalent. week_number is the first numeric week when unambiguous; otherwise null.
7. topic must be faithful to the PDF. Do not summarise away important subtopics.
8. Split distinct bullets/items in objectives, activities, skills and resources into separate strings when the source visually separates them.
9. source_page is the visible PDF page number when confidently known, otherwise null.
10. source_reference must name the registered file and, when known, the page.
11. Do not treat publisher claims as independent government verification.
12. Return only the requested structured rows. Do not include rows from another class or term.

This extraction will return to Pending human review. It is not approval and not curriculum promotion.`;
}

function errorStatus(caught: unknown) {
  if (caught instanceof OpenAIProviderError) {
    if (caught.code === "AI_PROVIDER_NOT_CONFIGURED") return 503;
    if (caught.code.includes("429")) return 429;
    if (caught.code === "OPENAI_TIMEOUT") return 504;
    return 502;
  }
  const message = caught instanceof Error ? caught.message : "";
  if (/permission|platform curriculum admin|authorit/i.test(message)) return 403;
  if (/authentication|session/i.test(message)) return 401;
  if (/too large/i.test(message)) return 413;
  return 400;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const workspaceId = String(form.get("workspaceId") ?? "").trim();
    const documentId = String(form.get("documentId") ?? "").trim();
    const classLevel = String(form.get("classLevel") ?? "").trim();
    const term = String(form.get("term") ?? "").trim();
    const source = form.get("source");

    if (!workspaceId || !documentId) throw new Error("Choose a registered scheme document first.");
    if (!CLASSES.includes(classLevel as (typeof CLASSES)[number])) throw new Error("Choose a valid class level.");
    if (!TERMS.includes(term as (typeof TERMS)[number])) throw new Error("Choose a valid term.");
    if (!(source instanceof File) || source.type !== "application/pdf") throw new Error("Upload the matching source PDF.");
    if (source.size > MAX_SOURCE_BYTES) throw new Error("The source PDF is too large. Maximum size is 20 MB.");

    const supabase = await authenticatedClient(request);
    const consoleResult = await supabase.rpc("get_scheme_review_console", { target_workspace_id: workspaceId });
    if (consoleResult.error) throw consoleResult.error;
    const reviewConsole = (consoleResult.data ?? {}) as ReviewConsole;
    const document = reviewConsole.documents?.find((item) => item.id === documentId);
    if (!document) throw new Error("The registered scheme document is not available to this curriculum administrator.");
    if (document.metadata?.stage12_review_required === true) throw new Error("This source is quarantined and cannot be automatically re-extracted.");
    if (!document.class_scope?.includes(classLevel)) throw new Error("The selected class does not belong to this source document.");

    const normalisedUpload = source.name.trim().toLowerCase();
    const normalisedRegistered = document.filename.trim().toLowerCase();
    if (normalisedUpload !== normalisedRegistered) {
      throw new Error(`Upload the exact registered source file: ${document.filename}`);
    }

    const bytes = Buffer.from(await source.arrayBuffer());
    const extraction = await generateOpenAIJson<Extraction>({
      systemInstruction: extractionInstruction(document, classLevel, term),
      parts: [
        { text: `Registered subject: ${document.subject}\nRequested slice: ${classLevel} · ${term}\nExtract the source table faithfully.` },
        { inlineData: { mimeType: "application/pdf", data: bytes.toString("base64") } },
      ],
      responseSchema: EXTRACTION_SCHEMA,
      schemaName: "ksi_scheme_source_extraction",
      maxOutputTokens: 18000,
      reasoningEffort: "low",
    });

    const rows = extraction.data.rows.filter((row) => row.class_level === classLevel && row.term === term && row.topic.trim());
    if (rows.length === 0) throw new Error(`No ${classLevel} ${term} rows were found in the uploaded PDF. Nothing was changed.`);

    const saveResult = await supabase.rpc("replace_scheme_term_extraction", {
      target_document_id: documentId,
      target_class_level: classLevel,
      target_term: term,
      target_entries: rows,
      target_extraction_note: `Stage 16 source-faithful re-extraction via ${extraction.model}; source ${document.filename}`,
    });
    if (saveResult.error) throw saveResult.error;

    return json({
      ok: true,
      documentId,
      filename: document.filename,
      classLevel,
      term,
      rows: rows.length,
      model: extraction.model,
      durationMs: extraction.durationMs,
      reviewStatus: "pending",
      promoted: false,
      saved: saveResult.data,
    });
  } catch (caught) {
    return json(
      { error: caught instanceof Error ? caught.message : "Scheme source repair failed. Nothing was promoted." },
      errorStatus(caught),
    );
  }
}
