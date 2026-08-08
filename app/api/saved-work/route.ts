import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database, KsiSupabaseClient } from "@/lib/supabase/database";

export const runtime = "nodejs";

type SavedWorkType = "lesson" | "assessment";
type SavedWorkAction = "archive" | "restore" | "delete";

type LifecycleBody = {
  artifactType?: unknown;
  artifactId?: unknown;
  action?: unknown;
  confirmation?: unknown;
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function errorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "The saved-work request could not be completed.";
}

async function getAuthenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new Error("Authentication is required.");

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error("Your session is no longer valid. Sign in again and retry.");
  }
  return { supabase, user };
}

async function getWorkspaceContext(
  supabase: KsiSupabaseClient,
  userId: string,
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) {
    throw new Error("Choose an active workspace before managing saved work.");
  }

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (workspaceResult.error || !workspaceResult.data) {
    throw workspaceResult.error ?? new Error("The active workspace is unavailable.");
  }
  if (membershipResult.error) throw membershipResult.error;

  const role = membershipResult.data?.role ?? "member";
  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    canAdmin: role === "owner" || role === "admin",
  };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient(request);
    const workspace = await getWorkspaceContext(supabase, user.id);

    const [lessonResult, assessmentResult, archivedResult] = await Promise.all([
      supabase
        .from("lessons")
        .select("id,title,status,topic,updated_at,created_by")
        .eq("workspace_id", workspace.workspaceId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("assessments")
        .select("id,title,status,assessment_mode,updated_at,created_by")
        .eq("workspace_id", workspace.workspaceId)
        .order("updated_at", { ascending: false }),
      supabase.rpc("list_archived_saved_work", {
        target_workspace_id: workspace.workspaceId,
      }),
    ]);

    const firstError =
      lessonResult.error ?? assessmentResult.error ?? archivedResult.error;
    if (firstError) throw firstError;

    const lessons = (lessonResult.data ?? []).map((item) => ({
      artifactType: "lesson" as const,
      artifactId: item.id,
      title: item.title,
      status: item.status,
      detail: item.topic,
      updatedAt: item.updated_at,
      dependencyCount: 0,
      canManage: workspace.canAdmin || item.created_by === user.id,
      canPermanentlyDelete: false,
    }));

    const assessments = (assessmentResult.data ?? []).map((item) => ({
      artifactType: "assessment" as const,
      artifactId: item.id,
      title: item.title,
      status: item.status,
      detail: item.assessment_mode.replaceAll("_", " "),
      updatedAt: item.updated_at,
      dependencyCount: 0,
      canManage: workspace.canAdmin || item.created_by === user.id,
      canPermanentlyDelete: false,
    }));

    const archived = (archivedResult.data ?? []).map((item) => ({
      artifactType: item.artifact_type as SavedWorkType,
      artifactId: item.artifact_id,
      title: item.title,
      status: "archived" as const,
      detail: item.artifact_type === "lesson" ? "HQLS lesson" : "Assessment",
      updatedAt: item.updated_at,
      dependencyCount: Number(item.dependency_count ?? 0),
      canManage: Boolean(item.can_manage),
      canPermanentlyDelete: Boolean(item.can_permanently_delete),
    }));

    return json({
      workspace: {
        id: workspace.workspaceId,
        name: workspace.workspaceName,
      },
      active: [...lessons, ...assessments].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
      archived,
    });
  } catch (caught) {
    return json({ error: errorMessage(caught) }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await getAuthenticatedClient(request);
    const body = (await request.json()) as LifecycleBody;

    const artifactType =
      typeof body.artifactType === "string" ? body.artifactType.trim() : "";
    const artifactId =
      typeof body.artifactId === "string" ? body.artifactId.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!(["lesson", "assessment"] as string[]).includes(artifactType)) {
      throw new Error("Select a valid saved-work type.");
    }
    if (!artifactId) throw new Error("Saved-work id is required.");
    if (!(["archive", "restore", "delete"] as string[]).includes(action)) {
      throw new Error("Select a valid saved-work action.");
    }
    if (action === "delete" && body.confirmation !== "DELETE") {
      throw new Error("Type DELETE to confirm permanent deletion.");
    }

    const { data, error } = await supabase.rpc("manage_saved_artifact", {
      target_artifact_type: artifactType,
      target_artifact_id: artifactId,
      target_action: action,
    });
    if (error) throw error;

    return json({ result: data });
  } catch (caught) {
    return json({ error: errorMessage(caught) }, 400);
  }
}
