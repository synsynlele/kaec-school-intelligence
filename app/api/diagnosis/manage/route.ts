import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

type Action = "archive" | "delete";

type Body = {
  diagnosisId?: string;
  action?: Action;
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
    const diagnosisId = body.diagnosisId?.trim() ?? "";
    if (!diagnosisId || (body.action !== "archive" && body.action !== "delete")) {
      return json({ error: "A valid diagnosis and management action are required." }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_workspace_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.default_workspace_id) {
      return json({ error: "Choose an active workspace first." }, 409);
    }
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
      return json({ error: "Only a workspace Owner or Admin can archive or permanently delete diagnoses." }, 403);
    }

    const { data: diagnosis, error: diagnosisError } = await supabase
      .from("diagnoses")
      .select("id,workspace_id,status")
      .eq("id", diagnosisId)
      .eq("workspace_id", workspaceId)
      .single();
    if (diagnosisError || !diagnosis) return json({ error: "Diagnosis not found in the active workspace." }, 404);

    const { data: handoff, error: handoffError } = await supabase
      .from("intervention_handoffs")
      .select("id,status,next_lesson_id")
      .eq("diagnosis_id", diagnosisId)
      .maybeSingle();
    if (handoffError) throw handoffError;

    if (body.action === "archive") {
      if (diagnosis.status === "archived") return json({ diagnosis, alreadyArchived: true });
      if (handoff && handoff.status !== "archived") {
        return json(
          { error: "Archive the linked intervention first. KSI will not hide a diagnosis while its intervention remains active." },
          409,
        );
      }
      const { data, error } = await supabase
        .from("diagnoses")
        .update({ status: "archived" })
        .eq("id", diagnosisId)
        .eq("workspace_id", workspaceId)
        .select("id,status,updated_at")
        .single();
      if (error) throw error;
      return json({ diagnosis: data });
    }

    if (body.confirmation !== "DELETE") {
      return json({ error: "Type DELETE to confirm permanent deletion." }, 400);
    }
    if (diagnosis.status !== "archived") {
      return json({ error: "Archive this diagnosis before permanent deletion." }, 409);
    }
    if (handoff) {
      return json(
        { error: "Permanent deletion is blocked while an intervention record still depends on this diagnosis. Delete an eligible archived intervention first, or retain both records in Archive for provenance." },
        409,
      );
    }

    const { error: deleteError } = await supabase
      .from("diagnoses")
      .delete()
      .eq("id", diagnosisId)
      .eq("workspace_id", workspaceId);
    if (deleteError) throw deleteError;
    return json({ deleted: true, diagnosisId });
  } catch (caught) {
    return json(
      { error: caught instanceof Error ? caught.message : "The diagnosis management action could not be completed." },
      400,
    );
  }
}
