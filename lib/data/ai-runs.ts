import type { SupabaseClient } from "@supabase/supabase-js";

import type { ArtifactType } from "@/lib/data/artifact-version";

export type StartAiRunInput = {
  workspaceId: string;
  userId: string;
  engine: string;
  engineVersion: string;
  promptVersion: string;
  provider?: string | null;
  model?: string | null;
  artifactType?: ArtifactType | null;
  artifactId?: string | null;
  inputSummary?: Record<string, unknown>;
};

export async function startAiRun(
  supabase: SupabaseClient,
  input: StartAiRunInput,
) {
  const { data, error } = await supabase
    .from("ai_runs")
    .insert({
      workspace_id: input.workspaceId,
      initiated_by: input.userId,
      engine: input.engine,
      engine_version: input.engineVersion,
      prompt_version: input.promptVersion,
      provider: input.provider ?? null,
      model: input.model ?? null,
      artifact_type: input.artifactType ?? null,
      artifact_id: input.artifactId ?? null,
      status: "started",
      input_summary: input.inputSummary ?? {},
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function completeAiRun(
  supabase: SupabaseClient,
  runId: string,
  status: "succeeded" | "failed" | "cancelled",
  errorCode?: string | null,
) {
  const { error } = await supabase
    .from("ai_runs")
    .update({
      status,
      error_code: errorCode ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) throw error;
}
