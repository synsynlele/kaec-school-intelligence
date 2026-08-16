import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database, KsiSupabaseClient } from "@/lib/supabase/database";

export const runtime = "nodejs";

const CONTRACT_VERSION = "1.0" as const;
const SIGNAL_WINDOW_DAYS = 90;
const KHPOS_RECEIVER_URL =
  process.env.KHPOS_KSI_RECEIVER_URL?.trim() ||
  "https://www.kshc.name.ng/api/khpos/integrations/ksi/receive";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class IntegrationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

type PairBody = {
  action?: "pair";
  pairingToken?: string;
  workspaceId?: string;
};

type AggregateSignal = {
  contractVersion: typeof CONTRACT_VERSION;
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

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

async function authenticatedClient(request: Request) {
  const token = bearerToken(request);
  if (!token) throw new IntegrationError("Sign in to KSI to continue.", 401);

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
    throw new IntegrationError(
      "Your KSI session is no longer valid. Sign in again and retry.",
      401,
    );
  }

  return { supabase, user };
}

async function authorisedSchoolWorkspace(
  supabase: KsiSupabaseClient,
  userId: string,
  workspaceId: string,
) {
  const [workspaceResult, membershipResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id,name,workspace_type")
      .eq("id", workspaceId)
      .eq("workspace_type", "school")
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (workspaceResult.error || !workspaceResult.data) {
    throw new IntegrationError(
      "Choose a school workspace that is available to your KSI account.",
      404,
    );
  }
  if (membershipResult.error || !membershipResult.data) {
    throw new IntegrationError(
      "Your KSI workspace membership could not be verified.",
      403,
    );
  }
  if (!['owner', 'admin'].includes(membershipResult.data.role)) {
    throw new IntegrationError(
      "Only a KSI workspace Owner or Admin can approve this connection.",
      403,
    );
  }

  return workspaceResult.data;
}

async function countQuery(
  query: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
  label: string,
) {
  const result = await query;
  if (result.error) {
    throw new IntegrationError(
      `${label} could not be summarised for the KHP-OS connection.`,
      500,
    );
  }
  return result.count ?? 0;
}

async function buildSignal(
  supabase: KsiSupabaseClient,
  workspaceId: string,
): Promise<AggregateSignal> {
  const sourceGeneratedAt = new Date();
  const windowStart = new Date(
    sourceGeneratedAt.getTime() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const sourceIso = sourceGeneratedAt.toISOString();
  const startIso = windowStart.toISOString();

  const [
    lessonCount,
    validatedLessonCount,
    fidelityResult,
    assessmentCount,
    validatedAssessmentCount,
    assessmentFromLessonCount,
    diagnosisCount,
    finalDiagnosisCount,
    confirmedInterventionCount,
    linkedNextLessonCount,
  ] = await Promise.all([
    countQuery(
      supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Lesson activity",
    ),
    countQuery(
      supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "validated")
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Validated lesson activity",
    ),
    supabase
      .from("hqls_fidelity_checks")
      .select("passed,score")
      .eq("workspace_id", workspaceId)
      .gte("created_at", startIso)
      .lte("created_at", sourceIso),
    countQuery(
      supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Assessment activity",
    ),
    countQuery(
      supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "validated")
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Validated assessment activity",
    ),
    countQuery(
      supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .not("source_lesson_id", "is", null)
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Lesson-linked assessment activity",
    ),
    countQuery(
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Diagnosis activity",
    ),
    countQuery(
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "final")
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Final diagnosis activity",
    ),
    countQuery(
      supabase
        .from("intervention_handoffs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "confirmed")
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Confirmed intervention activity",
    ),
    countQuery(
      supabase
        .from("intervention_handoffs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "confirmed")
        .not("next_lesson_id", "is", null)
        .gte("created_at", startIso)
        .lte("created_at", sourceIso),
      "Closed-loop intervention activity",
    ),
  ]);

  if (fidelityResult.error) {
    throw new IntegrationError(
      "HQLS fidelity activity could not be summarised for the KHP-OS connection.",
      500,
    );
  }

  const fidelityRows = fidelityResult.data ?? [];
  const fidelityScores = fidelityRows
    .map((row) => (row.score === null ? null : Number(row.score)))
    .filter((score): score is number =>
      score !== null && Number.isFinite(score),
    );
  const fidelityAverageScore = fidelityScores.length
    ? Math.round(
        (fidelityScores.reduce((sum, score) => sum + score, 0) /
          fidelityScores.length) *
          100,
      ) / 100
    : null;

  return {
    contractVersion: CONTRACT_VERSION,
    externalWorkspaceId: workspaceId,
    sourceGeneratedAt: sourceIso,
    windowStart: startIso,
    windowEnd: sourceIso,
    lessonCount,
    validatedLessonCount,
    fidelityCheckCount: fidelityRows.length,
    fidelityPassCount: fidelityRows.filter((row) => row.passed).length,
    fidelityAverageScore,
    assessmentCount,
    validatedAssessmentCount,
    assessmentFromLessonCount,
    diagnosisCount,
    finalDiagnosisCount,
    confirmedInterventionCount,
    linkedNextLessonCount,
  };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await authenticatedClient(request);
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id,role,status")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipError) {
      throw new IntegrationError(
        "Your authorised KSI workspaces could not be loaded.",
        500,
      );
    }

    const allowed = (memberships ?? []).filter((membership) =>
      ["owner", "admin"].includes(membership.role),
    );
    const workspaceIds = allowed.map((membership) => membership.workspace_id);
    if (!workspaceIds.length) {
      return json({ ok: true, workspaces: [] });
    }

    const { data: workspaces, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id,name,workspace_type")
      .in("id", workspaceIds)
      .eq("workspace_type", "school")
      .order("name", { ascending: true });
    if (workspaceError) {
      throw new IntegrationError(
        "Your authorised school workspaces could not be loaded.",
        500,
      );
    }

    const roleByWorkspace = new Map(
      allowed.map((membership) => [membership.workspace_id, membership.role]),
    );
    return json({
      ok: true,
      workspaces: (workspaces ?? []).map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        role: roleByWorkspace.get(workspace.id) ?? "",
      })),
    });
  } catch (caught) {
    const status = caught instanceof IntegrationError ? caught.status : 500;
    const message =
      caught instanceof Error
        ? caught.message
        : "KHP-OS connection could not be prepared.";
    return json({ ok: false, error: message }, status);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticatedClient(request);
    let body: PairBody;
    try {
      body = (await request.json()) as PairBody;
    } catch {
      throw new IntegrationError("Invalid KHP-OS pairing request.", 400);
    }

    const pairingToken = body.pairingToken?.trim() ?? "";
    const workspaceId = body.workspaceId?.trim() ?? "";
    if (body.action !== "pair") {
      throw new IntegrationError("Choose a valid KHP-OS connection action.", 400);
    }
    if (pairingToken.length < 32 || pairingToken.length > 128) {
      throw new IntegrationError(
        "This KHP-OS pairing request is missing, invalid or expired.",
        400,
      );
    }
    if (!UUID_RE.test(workspaceId)) {
      throw new IntegrationError("Choose a valid KSI school workspace.", 400);
    }

    const workspace = await authorisedSchoolWorkspace(
      supabase,
      user.id,
      workspaceId,
    );
    const signal = await buildSignal(supabase, workspace.id);

    const receiverResponse = await fetch(KHPOS_RECEIVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "pair",
        pairingToken,
        workspaceName: workspace.name,
        externalActor: `ksi-user:${user.id}`,
        signal,
      }),
    });

    const receiverBody = (await receiverResponse.json().catch(() => null)) as
      | {
          ok?: boolean;
          organisationId?: string;
          contractVersion?: string;
          error?: string;
        }
      | null;
    if (!receiverResponse.ok || !receiverBody?.ok || !receiverBody.organisationId) {
      throw new IntegrationError(
        receiverBody?.error ||
          "KHP-OS did not accept this KSI pairing request. Start a new connection from KHP-OS and try again.",
        receiverResponse.status >= 400 ? receiverResponse.status : 502,
      );
    }

    return json({
      ok: true,
      organisationId: receiverBody.organisationId,
      workspace: { id: workspace.id, name: workspace.name },
      contractVersion: receiverBody.contractVersion ?? CONTRACT_VERSION,
      sourceGeneratedAt: signal.sourceGeneratedAt,
      windowStart: signal.windowStart,
      windowEnd: signal.windowEnd,
    });
  } catch (caught) {
    const status = caught instanceof IntegrationError ? caught.status : 500;
    const message =
      caught instanceof Error
        ? caught.message
        : "The secure KHP-OS connection could not be completed.";
    return json({ ok: false, error: message }, status);
  }
}
