import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

type Body = {
  interventionId?: string;
  action?: "archive" | "delete";
  confirmation?: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    if (!token) return json({ error: "Authentication is required." }, 401);

    const { url, publishableKey } = getSupabasePublicEnv();
    const supabase = createClient<Database>(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "Your session is no longer valid." }, 401);

    const body = (await request.json().catch(() => ({}))) as Body;
    const interventionId = body.interventionId?.trim() ?? "";
    if (!interventionId || (body.action !== "archive" && body.action !== "delete")) {
      return json({ error: "A valid intervention and management action are required." }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_workspace_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.default_workspace_id) return json({ error: "Choose an active workspace first." }, 409);
    const workspaceId = profile.default_workspace_id;

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return json({ error: "Only a workspace Owner or Admin can archive or permanently delete interventions." }, 403);
    }

    const { data: handoff, error: handoffError } = await supabase
      .from("intervention_handoffs")
      .select("id,workspace_id,status,next_lesson_id")
      .eq("id", interventionId)
      .eq("workspace_id", workspaceId)
      .single();
    if (handoffError || !handoff) return json({ error: "Intervention not found in the active workspace." }, 404);

    if (body.action === "archive") {
      if (handoff.status === "archived") return json({ intervention: handoff, alreadyArchived: true });
      const { data, error } = await supabase
        .from("intervention_handoffs")
        .update({ status: "archived" })
        .eq("id", interventionId)
        .eq("workspace_id", workspaceId)
        .select("id,status,next_lesson_id,updated_at")
        .single();
      if (error) throw error;
      return json({ intervention: data });
    }

    if (body.confirmation !== "DELETE") return json({ error: "Type DELETE to confirm permanent deletion." }, 400);
    if (handoff.status !== "archived" && handoff.status !== "draft") {
      return json({ error: "Archive a confirmed intervention before permanent deletion." }, 409);
    }
    if (handoff.next_lesson_id) {
      return json(
        { error: "Permanent deletion is blocked because this intervention is provenance for a linked HQLS lesson. Keep it in Archive." },
        409,
      );
    }

    const { error: deleteError } = await supabase
      .from("intervention_handoffs")
      .delete()
      .eq("id", interventionId)
      .eq("workspace_id", workspaceId);
    if (deleteError) throw deleteError;
    return json({ deleted: true, interventionId });
  } catch (caught) {
    return json(
      { error: caught instanceof Error ? caught.message : "The intervention management action could not be completed." },
      400,
    );
  }
}
