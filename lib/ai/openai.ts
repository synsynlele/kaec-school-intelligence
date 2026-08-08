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

export type GenerateOpenAIJsonInput = {
  systemInstruction: string;
  parts: OpenAIPart[];
  responseSchema: Record<string, unknown>;
  schemaName?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type GenerateOpenAIJsonResult<T> = {
  data: T;
  provider: "openai";
  model: string;
  responseId?: string;
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

  // KSI uses GPT-5 mini for core educational generation. The existing
  // environment override is retained so deployments can be changed deliberately
  // without exposing model configuration to the browser.
  const model =
    process.env.KSI_OPENAI_MODEL?.trim() ||
    process.env.KSI_AI_MODEL?.trim() ||
    "gpt-5-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
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
      },
      max_output_tokens: input.maxOutputTokens ?? 12000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OpenAIProviderError(
      `OPENAI_HTTP_${response.status}`,
      `OpenAI generation failed (${response.status}). ${detail.slice(0, 500) || "Please try again."}`,
    );
  }

  const payload = (await response.json()) as OpenAIResponse;
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
    };
  } catch {
    throw new OpenAIProviderError(
      "OPENAI_INVALID_JSON",
      "OpenAI returned an invalid structured response. Please try again.",
    );
  }
}
