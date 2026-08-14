import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database";

export const KHPOS_KSI_CONTRACT_VERSION = "1.0" as const;
const KHPOS_BASE_URL = process.env.KHPOS_INTEGRATION_BASE_URL ?? "https://www.kshc.name.ng";
const SIGNAL_WINDOW_DAYS = 90;

export class KhposIntegrationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposIntegrationError";
  }
}

function receiverUrl(): string {
  return new URL("/api/khpos/integrations/ksi/receive", KHPOS_BASE_URL).toString();
}

export function khposReturnUrl(organisationId: string): string {
  return new URL(`/khpos/${encodeURIComponent(organisationId)}/learning-intelligence`, KHPOS_BASE_URL).toString();
}

function authenticatedClient(accessToken: string) {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type KsiAggregateSignal = {
  contractVersion: "1.0";
  externalWorkspaceId: string;
  sourceGeneratedAt: string;
  windowStart: string;
  windowEnd: string;
  lessonCount: number;
  validatedLessonCount: number;
  fidelityCheckCount: number;
  fidelityPassCount: number;
  fidelityAverageScore: number | null;
  assessmentCount: number;
  validatedAssessmentCount: number;
  assessmentFromLessonCount: number;
  diagnosisCount: number;
  finalDiagnosisCount: number;
  confirmedInterventionCount: number;
  linkedNextLessonCount: number;
};

export type KsiWorkspaceAuthority = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  role: "owner" | "admin";
};

export async function verifyWorkspaceAuthority(
  accessToken: string,
  workspaceId: string,
): Promise<KsiWorkspaceAuthority> {
  const supabase = authenticatedClient(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) throw new KhposIntegrationError("Sign in to KSI to continue.", 401);

  const [{ data: membership, error: membershipError }, { data: workspace, error: workspaceError }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .maybeSingle(),
    supabase
      .from("workspaces")
      .select("id,name,workspace_type")
      .eq("id", workspaceId)
      .eq("workspace_type", "school")
      .maybeSingle(),
  ]);

  if (membershipError || workspaceError) throw new KhposIntegrationError("KSI workspace authority could not be verified.", 500);
  if (!membership || !workspace || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new KhposIntegrationError("Only a KSI school-workspace Owner or Admin can approve this connection.", 403);
  }

  return {
    userId: userData.user.id,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: membership.role,
  };
}

export async function buildKsiAggregateSignal(
  accessToken: string,
  workspaceId: string,
): Promise<{ authority: KsiWorkspaceAuthority; signal: KsiAggregateSignal }> {
  const authority = await verifyWorkspaceAuthority(accessToken, workspaceId);
  const supabase = authenticatedClient(accessToken);
  const generatedAt = new Date();
  const windowStart = new Date(generatedAt.getTime() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const start = windowStart.toISOString();

  const [
    lessons,
    validatedLessons,
    fidelityRows,
    assessments,
    validatedAssessments,
    linkedAssessments,
    diagnoses,
    finalDiagnoses,
    confirmedHandoffs,
    linkedHandoffs,
  ] = await Promise.all([
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "validated").gte("created_at", start),
    supabase.from("hqls_fidelity_checks").select("passed,score").eq("workspace_id", workspaceId).gte("created_at", start),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "validated").gte("created_at", start),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("source_lesson_id", "is", null).gte("created_at", start),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "final").gte("created_at", start),
    supabase.from("intervention_handoffs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "confirmed").gte("created_at", start),
    supabase.from("intervention_handoffs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "confirmed").not("next_lesson_id", "is", null).gte("created_at", start),
  ]);

  const results = [lessons, validatedLessons, fidelityRows, assessments, validatedAssessments, linkedAssessments, diagnoses, finalDiagnoses, confirmedHandoffs, linkedHandoffs];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw new KhposIntegrationError("KSI aggregate learning signals could not be calculated.", 500);

  const fidelity = fidelityRows.data ?? [];
  const scores = fidelity.map((row) => Number(row.score)).filter((value) => Number.isFinite(value));
  const average = scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100 : null;

  return {
    authority,
    signal: {
      contractVersion: KHPOS_KSI_CONTRACT_VERSION,
      externalWorkspaceId: workspaceId,
      sourceGeneratedAt: generatedAt.toISOString(),
      windowStart: start,
      windowEnd: generatedAt.toISOString(),
      lessonCount: lessons.count ?? 0,
      validatedLessonCount: validatedLessons.count ?? 0,
      fidelityCheckCount: fidelity.length,
      fidelityPassCount: fidelity.filter((row) => row.passed).length,
      fidelityAverageScore: average,
      assessmentCount: assessments.count ?? 0,
      validatedAssessmentCount: validatedAssessments.count ?? 0,
      assessmentFromLessonCount: linkedAssessments.count ?? 0,
      diagnosisCount: diagnoses.count ?? 0,
      finalDiagnosisCount: finalDiagnoses.count ?? 0,
      confirmedInterventionCount: confirmedHandoffs.count ?? 0,
      linkedNextLessonCount: linkedHandoffs.count ?? 0,
    },
  };
}

async function postToKhpos(payload: unknown) {
  const response = await fetch(receiverUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.ok !== true) {
    throw new KhposIntegrationError(typeof body.error === "string" ? body.error : "KHP-OS did not accept the KSI signal.", response.status || 502);
  }
  return body;
}

export async function pairWithKhpos(accessToken: string, workspaceId: string, pairingToken: string) {
  const { authority, signal } = await buildKsiAggregateSignal(accessToken, workspaceId);
  const body = await postToKhpos({
    action: "pair",
    pairingToken,
    workspaceName: authority.workspaceName,
    externalActor: authority.userId,
    signal,
  });
  const connectorToken = String(body.connectorToken ?? "");
  const organisationId = String(body.organisationId ?? "");
  if (!connectorToken || !organisationId) throw new KhposIntegrationError("KHP-OS pairing response was incomplete.", 502);
  return { connectorToken, organisationId, workspaceId: authority.workspaceId };
}

export async function syncWithKhpos(accessToken: string, workspaceId: string, connectorToken: string) {
  const { signal } = await buildKsiAggregateSignal(accessToken, workspaceId);
  await postToKhpos({ action: "sync", connectorToken, signal });
}
