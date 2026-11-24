export type OpenAIPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type OpenAIContentPart = {
  type?: string;
  text?: string;
  refusal?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContentPart[];
};

type OpenAIResponse = {
  id?: string;
  status?: string;
  output?: OpenAIOutputItem[];
  error?: { code?: string; message?: string };
  model?: string;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
    total_tokens?: number;
  };
  incomplete_details?: { reason?: string };
};

export class OpenAIProviderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpenAIProviderError";
    this.code = code;
  }
}

export type OpenAIReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type OpenAITextVerbosity = "low" | "medium" | "high";

export type GenerateOpenAIJsonInput = {
  systemInstruction: string;
  parts: OpenAIPart[];
  responseSchema: Record<string, unknown>;
  schemaName?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
  promptCacheKey?: string;
  promptCacheTtl?: "30m";
  textVerbosity?: OpenAITextVerbosity;
};

export type GenerateOpenAIJsonResult<T> = {
  data: T;
  provider: "openai";
  model: string;
  responseId?: string;
  durationMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strictifySchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strictifySchema);
  }
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = strictifySchema(child);
  }

  if (next.type === "object" && isRecord(next.properties)) {
    next.additionalProperties = false;
    next.required = Object.keys(next.properties);
  }

  return next;
}

function mimeExtension(mimeType: string) {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "application/json":
      return "json";
    case "text/plain":
      return "txt";
    case "text/csv":
      return "csv";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/vnd.ms-powerpoint":
      return "ppt";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return "pptx";
    case "application/vnd.ms-excel":
      return "xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    default:
      return "bin";
  }
}

function toOpenAIInputContent(parts: OpenAIPart[]) {
  return parts.map((part, index) => {
    if ("text" in part) {
      return { type: "input_text", text: part.text };
    }

    const { mimeType, data } = part.inlineData;
    const dataUrl = `data:${mimeType};base64,${data}`;
    if (mimeType.startsWith("image/")) {
      return {
        type: "input_image",
        image_url: dataUrl,
        detail: "auto",
      };
    }

    return {
      type: "input_file",
      filename: `ksi-source-${index + 1}.${mimeExtension(mimeType)}`,
      file_data: dataUrl,
      ...(mimeType === "application/pdf" ? { detail: "auto" } : {}),
    };
  });
}

function extractOutputText(payload: OpenAIResponse) {
  const refusal = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((part) => part.type === "refusal" && part.refusal)?.refusal;
  if (refusal) {
    throw new OpenAIProviderError(
      "OPENAI_REFUSAL",
      `OpenAI declined this generation request: ${refusal}`,
    );
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter(
        (part) => part.type === "output_text" && typeof part.text === "string",
      )
      .map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

export function configuredOpenAIModel() {
  return (
    process.env.KSI_OPENAI_MODEL?.trim() ||
    process.env.KSI_AI_MODEL?.trim() ||
    "gpt-6-luna"
  );
}

function configuredReasoningEffort(model: string, schemaName?: string): OpenAIReasoningEffort | undefined {
  if (!/^gpt-[56](?:[.-]|$)/.test(model) && !/^o\d/.test(model)) return;

  const supportsNoReasoning = /^gpt-6(?:[.-]|$)/.test(model) || model.startsWith("gpt-5.6");
  const isQuick = schemaName === "ksi_result_comment";
  const isRepair = schemaName?.includes("repair");
  const configured = (
    isQuick ? process.env.KSI_AI_REASONING_QUICK :
    isRepair ? process.env.KSI_AI_REASONING_REPAIR :
    process.env.KSI_AI_REASONING_STANDARD
  )?.trim();

  switch (configured) {
    case "none":
      if (supportsNoReasoning) return configured;
      break;
    case "low":
    case "medium":
    case "high":
      return configured;
    case "xhigh":
    case "max":
      if (/^gpt-6-luna(?:-|$)/.test(model)) return configured;
      break;
  }

  if (isQuick) return supportsNoReasoning ? "none" : "minimal";
  if (schemaName === "ksi_hqls_lesson" && model.startsWith("gpt-5.6")) return "none";
  if (schemaName?.startsWith("ksi_hqls_")) return "low";
  return isRepair ? "medium" : "low";
}

function configuredTimeoutMs() {
  const configured = Number(process.env.KSI_AI_TIMEOUT_MS ?? "150000");
  if (!Number.isFinite(configured)) return 150_000;
  return Math.min(180_000, Math.max(30_000, Math.round(configured)));
}

function isTimeoutError(caught: unknown) {
  return (
    caught instanceof Error &&
    (caught.name === "TimeoutError" || caught.name === "AbortError")
  );
}

export async function generateOpenAIJson<T>(
  input: GenerateOpenAIJsonInput,
): Promise<GenerateOpenAIJsonResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIProviderError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "HQLS AI generation is not configured yet. Add OPENAI_API_KEY to the server environment and redeploy.",
    );
  }

  const model = input.model?.trim() || configuredOpenAIModel();
  const reasoningEffort = configuredReasoningEffort(model, input.schemaName);
  const supportsGpt6 = /^gpt-6(?:[.-]|$)/.test(model);
  const timeoutMs = input.timeoutMs === undefined ? configuredTimeoutMs()
    : Math.min(configuredTimeoutMs(), Math.max(5000, input.timeoutMs));
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: input.systemInstruction }],
          },
          {
            role: "user",
            content: toOpenAIInputContent(input.parts),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName ?? "ksi_hqls_response",
            strict: true,
            schema: strictifySchema(input.responseSchema),
          },
          ...(input.textVerbosity && (supportsGpt6 || model.startsWith("gpt-5"))
            ? { verbosity: input.textVerbosity }
            : {}),
        },
        ...(reasoningEffort
          ? { reasoning: { effort: reasoningEffort } }
          : {}),
        ...(input.promptCacheKey
          ? { prompt_cache_key: input.promptCacheKey }
          : {}),
        ...(input.promptCacheKey && (supportsGpt6 || model.startsWith("gpt-5.6"))
          ? { prompt_cache_options: { ttl: input.promptCacheTtl ?? "30m" } }
          : {}),
        max_output_tokens: input.maxOutputTokens ?? 12000,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (caught) {
    const durationMs = Date.now() - startedAt;
    console.error(
      "KSI_AI_TIMING",
      JSON.stringify({
        schema: input.schemaName ?? "ksi_hqls_response",
        model,
        reasoningEffort: reasoningEffort ?? "not_applicable",
        durationMs,
        status: isTimeoutError(caught) ? "timeout" : "network_error",
      }),
    );

    if (isTimeoutError(caught)) {
      throw new OpenAIProviderError(
        "OPENAI_TIMEOUT",
        "AI generation took too long to complete. Nothing partial was saved; please retry.",
      );
    }

    throw new OpenAIProviderError(
      "OPENAI_NETWORK_ERROR",
      "The AI provider could not be reached. Please retry in a moment.",
    );
  }

  const payload = response.ok ? (await response.json()) as OpenAIResponse : null;
  const durationMs = Date.now() - startedAt;
  console.info(
    "KSI_AI_TIMING",
    JSON.stringify({
      schema: input.schemaName ?? "ksi_hqls_response",
      model,
      resolvedModel: payload?.model,
      reasoningEffort: reasoningEffort ?? "not_applicable",
      durationMs,
      status: response.status,
      responseStatus: payload?.status,
      ok: response.ok,
      inputTokens: payload?.usage?.input_tokens,
      cachedInputTokens: payload?.usage?.input_tokens_details?.cached_tokens,
      cacheWriteTokens: payload?.usage?.input_tokens_details?.cache_write_tokens,
      outputTokens: payload?.usage?.output_tokens,
      reasoningTokens: payload?.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: payload?.usage?.total_tokens,
    }),
  );

  if (!payload) {
    const detail = await response.text().catch(() => "");
    throw new OpenAIProviderError(
      `OPENAI_HTTP_${response.status}`,
      `OpenAI generation failed (${response.status}). ${detail.slice(0, 500) || "Please try again."}`,
    );
  }

  if (payload.error?.message) {
    throw new OpenAIProviderError(
      payload.error.code
        ? `OPENAI_${payload.error.code}`
        : "OPENAI_RESPONSE_ERROR",
      payload.error.message,
    );
  }
  if (payload.status === "incomplete") {
    throw new OpenAIProviderError(
      "OPENAI_INCOMPLETE_RESPONSE",
      `OpenAI could not finish the structured lesson${payload.incomplete_details?.reason ? `: ${payload.incomplete_details.reason}` : "."}`,
    );
  }

  const text = extractOutputText(payload);
  if (!text) {
    throw new OpenAIProviderError(
      "OPENAI_EMPTY_RESPONSE",
      "OpenAI returned no structured lesson content. Please try again.",
    );
  }

  try {
    return {
      data: JSON.parse(text) as T,
      provider: "openai",
      model,
      responseId: payload.id,
      durationMs,
    };
  } catch {
    throw new OpenAIProviderError(
      "OPENAI_INVALID_JSON",
      "OpenAI returned an invalid structured response. Please try again.",
    );
  }
}
