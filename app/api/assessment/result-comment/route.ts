import { createClient } from "@supabase/supabase-js";

import { generateOpenAIJson } from "@/lib/ai/openai";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database";

const sections = [
  ["objective", "CBT"],
  ["subjective", "Subjective"],
  ["critical_thinking", "Critical Thinking"],
  ["project", "Project"],
] as const;

type Section = (typeof sections)[number][0];
type Review = {
  status: string;
  can_review: boolean;
  maxima: Record<Section, number>;
  roster: ({ id: string } & Record<Section, number | null>)[];
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return Response.json({ error: "Sign in to draft a comment." }, { status: 401 });
  }
  const input = await request.json().catch(() => null);
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (typeof input?.assessmentId !== "string" || !uuid.test(input.assessmentId)
    || typeof input?.learnerId !== "string" || !uuid.test(input.learnerId)) {
    return Response.json({ error: "Choose an assessment and learner." }, { status: 400 });
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("get_learning_result_review", { source_id: input.assessmentId });
  const sheet = data as unknown as Review | null;
  const learner = sheet?.roster.find(({ id }) => id === input.learnerId);
  if (error || !sheet?.can_review || sheet.status !== "submitted" || !learner) {
    return Response.json({ error: "This learner’s scores are unavailable for leadership review." }, { status: 403 });
  }

  const marks = sections.flatMap(([key, label]) => {
    const score = learner[key];
    return sheet.maxima[key] > 0 && score !== null ? [{ label, score, maximum: sheet.maxima[key] }] : [];
  });
  if (!marks.length) return Response.json({ error: "No scores are available." }, { status: 422 });

  const ranked = [...marks].sort((a, b) => b.score / b.maximum - a.score / a.maximum);
  const strongest = ranked[0];
  const focus = ranked[ranked.length - 1];
  const suggested = focus.score / focus.maximum < strongest.score / strongest.maximum
    ? `The learner earned ${strongest.score}/${strongest.maximum} in ${strongest.label}, their strongest section by percentage. Review the feedback for ${focus.label} and practise one similar task before the next assessment.`
    : "Review the assessment feedback and practise one similar task to consolidate learning.";

  if (process.env.KSI_ENABLE_RESULT_COMMENT_AI === "true") {
    try {
      const { data } = await generateOpenAIJson<{ comment: string }>({
        systemInstruction: "Draft an administrative school report comment of at most two short sentences. Use only the provided scores and suggest one grounded next step. Never infer attendance, effort, behaviour, diagnoses, or improvement over time. Do not invent details or a name. Use respectful language.",
        parts: [{ text: JSON.stringify(marks) }],
        responseSchema: { type: "object", properties: { comment: { type: "string" } } },
        schemaName: "ksi_result_comment",
        maxOutputTokens: 250,
        timeoutMs: 10000,
      });
      if (typeof data.comment === "string" && data.comment.trim() && data.comment.length <= 500) {
        return Response.json({ comment: data.comment.trim(), generatedBy: "ai" });
      }
    } catch {
      // A score-based suggestion keeps the review usable if the provider fails.
    }
  }

  return Response.json({ comment: suggested, generatedBy: "scores" });
}
