export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiCandidatePart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiCandidatePart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

export class GeminiProviderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GeminiProviderError";
    this.code = code;
  }
}

export type GenerateGeminiJsonInput = {
  systemInstruction: string;
  parts: GeminiPart[];
  responseSchema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
};

export type GenerateGeminiJsonResult<T> = {
  data: T;
  provider: "google";
  model: string;
};

export async function generateGeminiJson<T>(
  input: GenerateGeminiJsonInput,
): Promise<GenerateGeminiJsonResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiProviderError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "HQLS AI generation is not configured yet. Add GEMINI_API_KEY to the server environment and redeploy.",
    );
  }

  const model = process.env.KSI_AI_MODEL?.trim() || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: input.parts,
        },
      ],
      generationConfig: {
        temperature: input.temperature ?? 0.35,
        maxOutputTokens: input.maxOutputTokens ?? 8192,
        responseMimeType: "application/json",
        responseJsonSchema: input.responseSchema,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const safeDetail = detail.slice(0, 500);
    throw new GeminiProviderError(
      `GEMINI_HTTP_${response.status}`,
      `Gemini generation failed (${response.status}). ${safeDetail || "Please try again."}`,
    );
  }

  const payload = (await response.json()) as GeminiResponse;
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    const blocked = payload.promptFeedback?.blockReason;
    throw new GeminiProviderError(
      blocked ? "GEMINI_BLOCKED" : "GEMINI_EMPTY_RESPONSE",
      blocked
        ? `Gemini blocked this generation request: ${blocked}. Adjust the lesson context and try again.`
        : "Gemini returned no structured lesson content. Please try again.",
    );
  }

  try {
    return {
      data: JSON.parse(text) as T,
      provider: "google",
      model,
    };
  } catch {
    throw new GeminiProviderError(
      "GEMINI_INVALID_JSON",
      "Gemini returned an invalid structured response. Please try again.",
    );
  }
}
