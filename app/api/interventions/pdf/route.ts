import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import {
  createInterventionPdf,
  safeInterventionPdfFilename,
  type InterventionPdfAction,
} from "@/lib/pdf/intervention-pdf";
import { pdfSafeValue } from "@/lib/pdf/layout-safety";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

function responseError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function actions(value: unknown): InterventionPdfAction[] {
  if (!Array.isArray(value)) return [];
  const output: InterventionPdfAction[] = [];
  for (const item of value) {
    const row = record(item);
    if (!row || typeof row.action !== "string" || !row.action.trim()) continue;
    output.push({
      domain: typeof row.domain === "string" ? row.domain : "academic",
      action: row.action.trim(),
      timeframe: typeof row.timeframe === "string" ? row.timeframe : "",
    });
  }
  return output;
}

async function authenticatedClient(request: Request) {
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
  return supabase;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const interventionId = url.searchParams.get("interventionId")?.trim();
    if (!interventionId) return responseError("Intervention id is required.", 400);

    const supabase = await authenticatedClient(request);
    const { data: handoff, error: handoffError } = await supabase
      .from("intervention_handoffs")
      .select("*")
      .eq("id", interventionId)
      .single();
    if (handoffError || !handoff) {
      return responseError("That intervention is not available in this workspace.", 404);
    }
    if (handoff.status !== "confirmed" && handoff.status !== "archived") {
      return responseError("Confirm the intervention before downloading its PDF.", 409);
    }

    const [workspaceResult, studentResult, diagnosisResult] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", handoff.workspace_id).single(),
      supabase
        .from("students")
        .select("display_name,class_id")
        .eq("workspace_id", handoff.workspace_id)
        .eq("id", handoff.student_id)
        .maybeSingle(),
      supabase
        .from("diagnoses")
        .select("concise_diagnosis")
        .eq("workspace_id", handoff.workspace_id)
        .eq("id", handoff.diagnosis_id)
        .maybeSingle(),
    ]);
    if (workspaceResult.error || !workspaceResult.data) {
      return responseError("The intervention workspace could not be resolved.", 409);
    }
    if (studentResult.error) throw studentResult.error;
    if (diagnosisResult.error) throw diagnosisResult.error;

    let className = "Class not linked";
    if (studentResult.data?.class_id) {
      const { data, error } = await supabase
        .from("classes")
        .select("name")
        .eq("workspace_id", handoff.workspace_id)
        .eq("id", studentResult.data.class_id)
        .maybeSingle();
      if (error) throw error;
      if (data?.name) className = data.name;
    }

    const studentName = studentResult.data?.display_name || "Student";
    const pdf = createInterventionPdf(
      pdfSafeValue({
        workspaceName: workspaceResult.data.name,
        studentName,
        className,
        status: handoff.status,
        diagnosisSummary: diagnosisResult.data?.concise_diagnosis || "Approved diagnosis source",
        priorityGrowthTarget: handoff.priority_growth_target,
        evidenceBasis: handoff.evidence_basis,
        schoolIntervention: actions(handoff.school_intervention),
        parentIntervention: actions(handoff.parent_intervention),
        timeframe: handoff.timeframe,
        successIndicator: handoff.success_indicator,
        reviewDate: handoff.review_date,
        nextLearningAdjustment: handoff.next_learning_adjustment,
      }),
    );

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeInterventionPdfFilename(studentName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "The intervention PDF could not be prepared.";
    const status = /session|authentication/i.test(message) ? 401 : 400;
    return responseError(message, status);
  }
}
