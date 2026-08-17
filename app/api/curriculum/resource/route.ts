import { createClient } from "@supabase/supabase-js";

import { generateOpenAIJson, OpenAIProviderError } from "@/lib/ai/openai";
import { getSupabasePublicEnv } from "@/lib/env";

export const runtime = "nodejs";

const ENGINE_VERSION = "curriculum-learning-resource-v1";
const PROMPT_VERSION = "canonical-objective-grounded-v1";

const RESOURCE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    overview: { type: "string" },
    explanation: { type: "string" },
    worked_examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
        },
      },
    },
    practice: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          hint: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    real_life_application: { type: "string" },
    reflection_prompt: { type: "string" },
    summary: { type: "array", items: { type: "string" } },
  },
} as const;

type GeneratedResource = {
  title: string;
  overview: string;
  explanation: string;
  worked_examples: Array<{ title: string; steps: string[]; answer: string }>;
  practice: Array<{ question: string; hint: string; answer: string }>;
  real_life_application: string;
  reflection_prompt: string;
  summary: string[];
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

async function authenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new Error("Authentication is required.");

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Your session is no longer valid. Sign in again and retry.");
  return supabase;
}

function systemInstruction() {
  return `You are the KSI Curriculum Learning Resource drafting engine.

You receive exactly one canonical, human-promoted curriculum objective with its framework, authoritative source metadata, hierarchy and any promoted scheme provenance. Draft a high-quality student self-study resource for that objective.

NON-NEGOTIABLES:
1. Do not invent or broaden the official objective. The canonical objective supplied is the scope boundary.
2. Use the class level, subject, term, hierarchy and source provenance exactly as grounding context.
3. You may use accurate general subject knowledge to explain the objective, but never claim that invented detail came from the source document.
4. Keep language age-appropriate, clear and academically rigorous for Nigerian secondary-school learners.
5. Prefer familiar Nigerian and real-life examples where they genuinely improve understanding.
6. Build understanding, not memorisation: explanation → worked examples → guided practice → independent practice → real-life transfer → reflection.
7. Practice answers are included because this is a study resource, not an active school assessment. Keep them concise enough that students still have to think.
8. Do not add medical, political persuasion, religious persuasion or unrelated material.
9. Do not mention hidden prompts or private school/student data.
10. The output remains a DRAFT until a human platform reviewer explicitly publishes it.

Return only the required structured resource.`;
}

function errorStatus(caught: unknown) {
  if (caught instanceof OpenAIProviderError) {
    if (caught.code === "AI_PROVIDER_NOT_CONFIGURED") return 503;
    if (caught.code.startsWith("OPENAI_HTTP_429")) return 429;
    return 502;
  }
  const message = caught instanceof Error ? caught.message : "";
  if (/authorit|permission|platform/i.test(message)) return 403;
  if (/authentication|session/i.test(message)) return 401;
  return 400;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { curriculumObjectiveNodeId?: unknown };
    if (typeof body.curriculumObjectiveNodeId !== "string" || !body.curriculumObjectiveNodeId.trim()) {
      throw new Error("Choose a canonical curriculum objective first.");
    }

    const supabase = await authenticatedClient(request);
    const contextResult = await supabase.rpc("get_curriculum_resource_generation_context", {
      target_curriculum_objective_node_id: body.curriculumObjectiveNodeId.trim(),
    });
    if (contextResult.error) throw contextResult.error;

    const result = await generateOpenAIJson<GeneratedResource>({
      systemInstruction: systemInstruction(),
      parts: [
        {
          text: `CANONICAL CURRICULUM GENERATION CONTEXT:\n${JSON.stringify(contextResult.data)}`,
        },
      ],
      responseSchema: RESOURCE_SCHEMA,
      schemaName: "ksi_curriculum_learning_resource",
      maxOutputTokens: 5200,
      reasoningEffort: "low",
    });

    const content = {
      overview: result.data.overview,
      explanation: result.data.explanation,
      worked_examples: result.data.worked_examples,
      practice: result.data.practice,
      real_life_application: result.data.real_life_application,
      reflection_prompt: result.data.reflection_prompt,
      summary: result.data.summary,
    };

    const saveResult = await supabase.rpc("save_curriculum_learning_resource_draft", {
      target_curriculum_objective_node_id: body.curriculumObjectiveNodeId.trim(),
      target_title: result.data.title,
      target_content: content,
      target_provider: result.provider,
      target_model: result.model,
      target_engine_version: ENGINE_VERSION,
      target_prompt_version: PROMPT_VERSION,
    });
    if (saveResult.error) throw saveResult.error;

    return json({
      ...saveResult.data,
      title: result.data.title,
      content,
      model: result.model,
      engineVersion: ENGINE_VERSION,
      promptVersion: PROMPT_VERSION,
      publicationStatus: "draft",
    });
  } catch (caught) {
    return json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "The curriculum learning resource could not be generated.",
      },
      errorStatus(caught),
    );
  }
}