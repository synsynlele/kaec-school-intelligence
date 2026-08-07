import type { KsiSupabaseClient } from "@/lib/supabase/database";

// Shared resource constants intentionally live in a server-safe module. This file has
// no `use client` boundary so server routes can use the canonical bucket name while
// the functions below remain callable from browser code through their callers.
export const KSI_RESOURCE_BUCKET = "ksi-resources";
export const KSI_RESOURCE_MAX_BYTES = 20 * 1024 * 1024;

export type ResourceType =
  | "curriculum"
  | "scheme"
  | "notes"
  | "reference"
  | "other";

export type ResourceVisibility = "private" | "workspace";

export type UploadWorkspaceResourceInput = {
  workspaceId: string;
  userId: string;
  file: File;
  title?: string;
  resourceType: ResourceType;
  visibility: ResourceVisibility;
};

export type StoredResource = {
  id: string;
  storagePath: string;
  title: string;
};

function safeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);

  return cleaned || "resource";
}

export async function uploadWorkspaceResource(
  supabase: KsiSupabaseClient,
  input: UploadWorkspaceResourceInput,
): Promise<StoredResource> {
  if (input.file.size > KSI_RESOURCE_MAX_BYTES) {
    throw new Error("Resource files must be 20 MB or smaller.");
  }

  const fileName = `${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const storagePath = `${input.workspaceId}/${input.userId}/${fileName}`;
  const title = input.title?.trim() || input.file.name;

  const { data: resource, error: metadataError } = await supabase
    .from("resources")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title,
      resource_type: input.resourceType,
      visibility: input.visibility,
      storage_path: storagePath,
      mime_type: input.file.type || null,
      status: "processing",
    })
    .select("id,title")
    .single();

  if (metadataError) throw metadataError;

  const resourceId = resource.id;

  try {
    const { error: uploadError } = await supabase.storage
      .from(KSI_RESOURCE_BUCKET)
      .upload(storagePath, input.file, {
        contentType: input.file.type || undefined,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { error: readyError } = await supabase
      .from("resources")
      .update({ status: "uploaded" })
      .eq("id", resourceId);

    if (readyError) throw readyError;

    return { id: resourceId, storagePath, title };
  } catch (caught) {
    await supabase.storage.from(KSI_RESOURCE_BUCKET).remove([storagePath]);
    await supabase.from("resources").delete().eq("id", resourceId);
    throw caught;
  }
}

export async function downloadWorkspaceResource(
  supabase: KsiSupabaseClient,
  storagePath: string,
) {
  const { data, error } = await supabase.storage
    .from(KSI_RESOURCE_BUCKET)
    .download(storagePath);

  if (error) throw error;
  return data;
}

export async function deleteWorkspaceResource(
  supabase: KsiSupabaseClient,
  resourceId: string,
  storagePath: string,
) {
  const { error: storageError } = await supabase.storage
    .from(KSI_RESOURCE_BUCKET)
    .remove([storagePath]);

  if (storageError) throw storageError;

  const { error: metadataError } = await supabase
    .from("resources")
    .delete()
    .eq("id", resourceId);

  if (metadataError) throw metadataError;
}
