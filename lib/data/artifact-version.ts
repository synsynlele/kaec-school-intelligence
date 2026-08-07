import type { SupabaseClient } from "@supabase/supabase-js";

export type ArtifactType = "lesson" | "assessment" | "diagnosis";
export type ArtifactVersionOrigin =
  | "generated"
  | "manual_edit"
  | "regeneration"
  | "review"
  | "finalisation";

export type AppendArtifactVersionInput = {
  workspaceId: string;
  artifactType: ArtifactType;
  artifactId: string;
  snapshot: Record<string, unknown>;
  origin: ArtifactVersionOrigin;
  engineVersion?: string | null;
  promptVersion?: string | null;
};

export async function appendArtifactVersion(
  supabase: SupabaseClient,
  input: AppendArtifactVersionInput,
) {
  const { data, error } = await supabase.rpc("append_artifact_version", {
    target_workspace_id: input.workspaceId,
    target_artifact_type: input.artifactType,
    target_artifact_id: input.artifactId,
    target_snapshot: input.snapshot,
    target_origin: input.origin,
    target_engine_version: input.engineVersion ?? null,
    target_prompt_version: input.promptVersion ?? null,
  });

  if (error) throw error;
  return data as string;
}
