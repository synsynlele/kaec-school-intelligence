import type { SupabaseClient } from "@supabase/supabase-js";

export type ResourceType =
  | "curriculum"
  | "scheme"
  | "notes"
  | "reference"
  | "other";

export type ResourceVisibility = "private" | "workspace";

function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120);

  return cleaned || "resource";
}

export async function uploadWorkspaceResource(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    userId: string;
    file: File;
    title?: string;
    resourceType: ResourceType;
    visibility?: ResourceVisibility;
  },
): Promise<{ id: string; storagePath: string }> {
  const storagePath = `${input.workspaceId}/${input.userId}/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;

  const { data: resource, error: resourceError } = await client
    .from("resources")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title: input.title?.trim() || input.file.name,
      resource_type: input.resourceType,
      visibility: input.visibility ?? "workspace",
      storage_path: storagePath,
      mime_type: input.file.type || null,
      status: "processing",
    })
    .select("id")
    .single();

  if (resourceError) throw resourceError;
  if (!resource?.id) throw new Error("Resource metadata did not return an id.");

  const resourceId = resource.id as string;

  const { error: uploadError } = await client.storage
    .from("ksi-resources")
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || undefined,
    });

  if (uploadError) {
    await client
      .from("resources")
      .update({ status: "failed" })
      .eq("id", resourceId);
    throw uploadError;
  }

  const { error: statusError } = await client
    .from("resources")
    .update({ status: "uploaded" })
    .eq("id", resourceId);

  if (statusError) throw statusError;

  return { id: resourceId, storagePath };
}

export async function downloadWorkspaceResource(
  client: SupabaseClient,
  storagePath: string,
): Promise<Blob> {
  const { data, error } = await client.storage
    .from("ksi-resources")
    .download(storagePath);

  if (error) throw error;
  if (!data) throw new Error("Resource download returned no file.");
  return data;
}

export async function deleteWorkspaceResource(
  client: SupabaseClient,
  input: { resourceId: string; storagePath: string },
): Promise<void> {
  // Storage deletion must happen first because the storage RLS policy checks the
  // matching resource metadata row before authorising object deletion.
  const { error: storageError } = await client.storage
    .from("ksi-resources")
    .remove([input.storagePath]);

  if (storageError) throw storageError;

  const { error: metadataError } = await client
    .from("resources")
    .delete()
    .eq("id", input.resourceId);

  if (metadataError) throw metadataError;
}
