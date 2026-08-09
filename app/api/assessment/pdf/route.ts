import { createClient } from "@supabase/supabase-js";

import {
  parseGeneratedAssessment,
  type GeneratedAssessmentItem,
} from "@/lib/assessment/engine";
import { getSupabasePublicEnv } from "@/lib/env";
import {
  createAssessmentPdf,
  safeAssessmentPdfFilename,
} from "@/lib/pdf/assessment-pdf";
import { patchPdfCommands, pdfSafeValue } from "@/lib/pdf/layout-safety";
import type { Database, KsiSupabaseClient } from "@/lib/supabase/database";

export const runtime = "nodejs";

type AssessmentRow = Database["public"]["Tables"]["assessments"]["Row"];
type AssessmentItemRow =
  Database["public"]["Tables"]["assessment_items"]["Row"];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function requestedTopicCoverage(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = record(entry);
      if (typeof row.topic !== "string" || !row.topic.trim()) return null;
      const objectives = strings(row.objectives);
      const weight =
        typeof row.weight === "number" && Number.isFinite(row.weight)
          ? `${row.weight}%`
          : "weight not specified";
      const objectiveText = objectives.length
        ? ` - Objectives: ${objectives.join("; ")}`
        : "";
      return `${row.topic} - ${weight}${objectiveText}`;
    })
    .filter((entry): entry is string => Boolean(entry));
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
  return supabase;
}

async function fetchAssessment(
  supabase: KsiSupabaseClient,
  assessmentId: string,
) {
  const [assessmentResult, itemResult] = await Promise.all([
    supabase.from("assessments").select("*").eq("id", assessmentId).single(),
    supabase
      .from("assessment_items")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("position"),
  ]);
  if (assessmentResult.error) throw assessmentResult.error;
  if (itemResult.error) throw itemResult.error;
  if (!assessmentResult.data || !itemResult.data?.length) {
    throw new Error("The saved assessment is incomplete.");
  }
  return {
    assessment: assessmentResult.data as AssessmentRow,
    items: itemResult.data as AssessmentItemRow[],
  };
}

function itemFromRow(row: AssessmentItemRow): GeneratedAssessmentItem {
  const content = record(row.content);
  const answer = record(row.answer_key);
  const marking = record(row.marking_guide);
  const difficulty =
    row.difficulty === "easy" ||
    row.difficulty === "moderate" ||
    row.difficulty === "challenging"
      ? row.difficulty
      : "moderate";
  return {
    position: row.position,
    itemType: row.item_type,
    criticalThinkingType: row.critical_thinking_type ?? "",
    topic: row.topic ?? "",
    objective: row.objective ?? "",
    competency: typeof content.competency === "string" ? content.competency : "",
    difficulty,
    marks: Number(row.marks ?? 0),
    prompt: typeof content.prompt === "string" ? content.prompt : "",
    options: strings(content.options),
    correctAnswer:
      typeof answer.correctAnswer === "string" ? answer.correctAnswer : "",
    answerRationale:
      typeof content.answerRationale === "string"
        ? content.answerRationale
        : typeof answer.rationale === "string"
          ? answer.rationale
          : "",
    expectedEvidence: strings(content.expectedEvidence),
    markingGuide: strings(marking.criteria),
    deliverable:
      typeof content.deliverable === "string" ? content.deliverable : "",
    constraints: strings(content.constraints),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assessmentId = url.searchParams.get("assessmentId")?.trim();
    if (!assessmentId) throw new Error("Assessment id is required.");

    const supabase = await getAuthenticatedClient(request);
    const rows = await fetchAssessment(supabase, assessmentId);
    if (rows.assessment.status !== "validated") {
      throw new Error("Only a saved validated assessment can be exported.");
    }

    const blueprint = record(rows.assessment.blueprint);
    const generated = parseGeneratedAssessment({
      title: rows.assessment.title,
      studentInstructions:
        typeof blueprint.studentInstructions === "string"
          ? blueprint.studentInstructions
          : "Answer all questions as instructed.",
      blueprint,
      items: rows.items.map(itemFromRow),
    });

    const [
      { data: workspace, error: workspaceError },
      subjectResult,
      classResult,
    ] = await Promise.all([
      supabase
        .from("workspaces")
        .select("name")
        .eq("id", rows.assessment.workspace_id)
        .single(),
      rows.assessment.subject_id
        ? supabase
            .from("subjects")
            .select("name")
            .eq("id", rows.assessment.subject_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      rows.assessment.class_id
        ? supabase
            .from("classes")
            .select("name")
            .eq("id", rows.assessment.class_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (workspaceError || !workspace) {
      throw new Error("The assessment workspace is unavailable.");
    }
    if (subjectResult.error) throw subjectResult.error;
    if (classResult.error) throw classResult.error;

    const pdf = createAssessmentPdf(
      pdfSafeValue({
        workspaceName: workspace.name,
        subject: subjectResult.data?.name ?? "Not linked",
        classLevel: classResult.data?.name ?? "Not linked",
        topic:
          typeof blueprint.topic === "string"
            ? blueprint.topic
            : generated.items[0]?.topic ?? "",
        objective:
          typeof blueprint.objective === "string"
            ? blueprint.objective
            : generated.items[0]?.objective ?? "",
        durationMinutes:
          typeof blueprint.durationMinutes === "number"
            ? blueprint.durationMinutes
            : null,
        assessmentType:
          typeof blueprint.assessmentKind === "string"
            ? blueprint.assessmentKind
            : null,
        overallDifficulty:
          typeof blueprint.overallDifficulty === "string"
            ? blueprint.overallDifficulty
            : null,
        topicCoverage: requestedTopicCoverage(blueprint.requestedTopics),
        assessment: generated,
      }),
    );
    const protectedPdf = patchPdfCommands(pdf, [
      ["54 746 487 1.3 re f", "89 746 452 1.3 re f"],
    ]);
    const filename = safeAssessmentPdfFilename(rows.assessment.title);

    return new Response(protectedPdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (caught) {
    return Response.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "The assessment PDF could not be prepared.",
      },
      { status: 400 },
    );
  }
}
