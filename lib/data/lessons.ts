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

  const { data: lessonId, error: createError } = await supabase.rpc(
    "create_hqls_lesson_draft",
    {
      target_workspace_id: input.workspaceId,
      target_title: input.title,
      target_topic: input.topic,
      target_objective: input.objective,
      target_age_range: input.ageRange ?? null,
      target_duration_minutes: input.durationMinutes ?? null,
      target_class_id: input.classId ?? null,
      target_subject_id: input.subjectId ?? null,
      target_source_context: input.sourceContext ?? [],
    },
  );

  if (createError) throw createError;
  if (typeof lessonId !== "string") {
    throw new Error("HQLS lesson draft did not return a lesson id.");
  }

  try {
    if (input.engineVersion || input.promptVersion) {
      const { error: provenanceError } = await supabase
        .from("lessons")
        .update({
          engine_version: input.engineVersion ?? null,
          prompt_version: input.promptVersion ?? null,
        })
        .eq("id", lessonId);

      if (provenanceError) throw provenanceError;
    }

    if (input.stages) {
      await Promise.all(
        input.stages.map(async (stage) => {
          const { error } = await supabase
            .from("lesson_stages")
            .update({
              content: stage.content,
              validation: stage.validation ?? {},
            })
            .eq("lesson_id", lessonId)
            .eq("stage_number", stage.index)
            .eq("stage_key", stage.key);

          if (error) throw error;
        }),
      );
    }

    const [{ data: lesson, error: lessonError }, { data: stages, error: stagesError }] =
      await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).single(),
        supabase
          .from("lesson_stages")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("stage_number"),
      ]);

    if (lessonError) throw lessonError;
    if (stagesError) throw stagesError;

    await appendArtifactVersion(supabase, {
      workspaceId: input.workspaceId,
      artifactType: "lesson",
      artifactId: lessonId,
      snapshot: { lesson, stages },
      origin: input.engineVersion ? "generated" : "manual_edit",
      engineVersion: input.engineVersion,
      promptVersion: input.promptVersion,
    });

    return { lesson, stages };
  } catch (caught) {
    await supabase.from("lessons").delete().eq("id", lessonId);
    throw caught;
  }
}
