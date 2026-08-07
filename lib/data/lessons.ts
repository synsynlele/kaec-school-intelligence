import type { SupabaseClient } from "@supabase/supabase-js";

import { appendArtifactVersion } from "@/lib/data/artifact-version";
import { HQLS_STAGES, type HqlsStageKey } from "@/lib/domain/hqls";

export type LessonStageInput = {
  index: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  key: HqlsStageKey;
  content: Record<string, unknown>;
  validation?: Record<string, unknown>;
};

export type CreateLessonInput = {
  workspaceId: string;
  userId: string;
  title: string;
  topic: string;
  objective: string;
  ageRange?: string | null;
  durationMinutes?: number | null;
  classId?: string | null;
  subjectId?: string | null;
  engineVersion?: string | null;
  promptVersion?: string | null;
  sourceContext?: unknown[];
  stages?: LessonStageInput[];
};

export function assertCompleteHqlsStages(stages: LessonStageInput[]) {
  if (stages.length !== HQLS_STAGES.length) {
    throw new Error("A complete generated HQLS lesson must contain all seven stages.");
  }

  HQLS_STAGES.forEach((definition, position) => {
    const stage = stages[position];
    if (stage.index !== definition.index || stage.key !== definition.key) {
      throw new Error(
        `HQLS stage ${definition.index} must be ${definition.title} and remain in constitutional order.`,
      );
    }
  });
}

export async function createLesson(
  supabase: SupabaseClient,
  input: CreateLessonInput,
) {
  if (input.stages) assertCompleteHqlsStages(input.stages);

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      class_id: input.classId ?? null,
      subject_id: input.subjectId ?? null,
      title: input.title.trim(),
      topic: input.topic.trim(),
      age_range: input.ageRange ?? null,
      duration_minutes: input.durationMinutes ?? null,
      objective: input.objective.trim(),
      status: "draft",
      engine_version: input.engineVersion ?? null,
      prompt_version: input.promptVersion ?? null,
      source_context: input.sourceContext ?? [],
    })
    .select("*")
    .single();

  if (lessonError) throw lessonError;

  try {
    if (input.stages?.length) {
      const { error: stageError } = await supabase.from("lesson_stages").insert(
        input.stages.map((stage) => ({
          lesson_id: lesson.id,
          stage_number: stage.index,
          stage_key: stage.key,
          content: stage.content,
          validation: stage.validation ?? {},
        })),
      );

      if (stageError) throw stageError;
    }

    await appendArtifactVersion(supabase, {
      workspaceId: input.workspaceId,
      artifactType: "lesson",
      artifactId: lesson.id,
      snapshot: {
        lesson,
        stages: input.stages ?? [],
      },
      origin: input.engineVersion ? "generated" : "manual_edit",
      engineVersion: input.engineVersion,
      promptVersion: input.promptVersion,
    });

    return lesson;
  } catch (caught) {
    await supabase.from("lessons").delete().eq("id", lesson.id);
    throw caught;
  }
}
