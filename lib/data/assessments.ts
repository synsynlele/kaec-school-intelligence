import type { SupabaseClient } from "@supabase/supabase-js";

import { appendArtifactVersion } from "@/lib/data/artifact-version";
import type {
  AssessmentItemType,
  KaecCriticalThinkingExperienceType,
} from "@/lib/domain/assessment";

export type AssessmentMode = AssessmentItemType | "mixed";

export type AssessmentItemInput = {
  position: number;
  itemType: AssessmentItemType;
  criticalThinkingType?: KaecCriticalThinkingExperienceType | null;
  topic?: string | null;
  objective?: string | null;
  difficulty?: string | null;
  marks?: number | null;
  content: Record<string, unknown>;
  answerKey?: Record<string, unknown> | null;
  markingGuide?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type CreateAssessmentInput = {
  workspaceId: string;
  userId: string;
  title: string;
  mode: AssessmentMode;
  sourceLessonId?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  blueprint?: Record<string, unknown>;
  sourceContext?: unknown[];
  engineVersion?: string | null;
  promptVersion?: string | null;
  items: AssessmentItemInput[];
};

function assertAssessmentItems(items: AssessmentItemInput[]) {
  if (!items.length) {
    throw new Error("An assessment must contain at least one question or task.");
  }

  const positions = items.map((item) => item.position);
  const uniquePositions = new Set(positions);
  if (uniquePositions.size !== positions.length || positions.some((value) => value < 1)) {
    throw new Error("Assessment item positions must be unique positive numbers.");
  }
}

export async function createAssessment(
  supabase: SupabaseClient,
  input: CreateAssessmentInput,
) {
  assertAssessmentItems(input.items);

  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      source_lesson_id: input.sourceLessonId ?? null,
      class_id: input.classId ?? null,
      subject_id: input.subjectId ?? null,
      title: input.title.trim(),
      assessment_mode: input.mode,
      status: "draft",
      blueprint: input.blueprint ?? {},
      engine_version: input.engineVersion ?? null,
      prompt_version: input.promptVersion ?? null,
      source_context: input.sourceContext ?? [],
    })
    .select("*")
    .single();

  if (assessmentError) throw assessmentError;

  try {
    const { error: itemError } = await supabase.from("assessment_items").insert(
      input.items.map((item) => ({
        assessment_id: assessment.id,
        position: item.position,
        item_type: item.itemType,
        critical_thinking_type: item.criticalThinkingType ?? null,
        topic: item.topic ?? null,
        objective: item.objective ?? null,
        difficulty: item.difficulty ?? null,
        marks: item.marks ?? null,
        content: item.content,
        answer_key: item.answerKey ?? null,
        marking_guide: item.markingGuide ?? null,
        metadata: item.metadata ?? {},
      })),
    );

    if (itemError) throw itemError;

    await appendArtifactVersion(supabase, {
      workspaceId: input.workspaceId,
      artifactType: "assessment",
      artifactId: assessment.id,
      snapshot: {
        assessment,
        items: input.items,
      },
      origin: input.engineVersion ? "generated" : "manual_edit",
      engineVersion: input.engineVersion,
      promptVersion: input.promptVersion,
    });

    return assessment;
  } catch (caught) {
    await supabase.from("assessments").delete().eq("id", assessment.id);
    throw caught;
  }
}
