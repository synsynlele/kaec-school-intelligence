import { createClient } from "@supabase/supabase-js";

import { parseGeneratedDiagnosis } from "@/lib/diagnosis/engine";
import { getSupabasePublicEnv } from "@/lib/env";
import {
  createDiagnosisPdf,
  safeDiagnosisPdfFilename,
} from "@/lib/pdf/diagnosis-pdf";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

function diagnosisFromRow(
  row: Database["public"]["Tables"]["diagnoses"]["Row"],
) {
  return parseGeneratedDiagnosis({
    observedEvidence: row.observed_evidence,
    detectedPatterns: row.detected_patterns,
    possibleInterpretations: row.possible_interpretations,
    academicSkillStrengths: row.academic_strengths,
    academicSkillChallenges: row.academic_challenges,
    characterStrengths: row.character_strengths,
    characterChallenges: row.character_challenges,
    conciseDiagnosis:
      row.concise_diagnosis ||
      "The current evidence has been translated into the actions below.",
    schoolAcademicActions: row.school_academic_actions,
    parentAcademicActions: row.parent_academic_actions,
    schoolCharacterActions: row.school_character_actions,
    parentCharacterActions: row.parent_character_actions,
    builderGrowthDirection: row.builder_growth_direction ?? "",
    encouragementNote: row.encouragement_note ?? "",
    evidenceLimitations: row.evidence_limitations,
  });
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    if (!token) {
      return Response.json(
        { error: "Authentication is required." },
        { status: 401 },
      );
    }

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
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return Response.json(
        { error: "Your session is no longer valid." },
        { status: 401 },
      );
    }

    const diagnosisId = new URL(request.url).searchParams.get("id")?.trim();
    if (!diagnosisId) {
      return Response.json(
        { error: "Diagnosis id is required." },
        { status: 400 },
      );
    }

    const { data: diagnosis, error } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("id", diagnosisId)
      .single();
    if (error || !diagnosis) {
      return Response.json({ error: "Diagnosis not found." }, { status: 404 });
    }
    if (
      !["final", "archived"].includes(diagnosis.status) ||
      !diagnosis.reviewed_at ||
      !diagnosis.finalised_at
    ) {
      return Response.json(
        {
          error:
            "Parent PDF download is available only after human review and school approval.",
        },
        { status: 409 },
      );
    }

    const [workspaceResult, studentResult, assessmentResult] = await Promise.all([
      supabase
        .from("workspaces")
        .select("name")
        .eq("id", diagnosis.workspace_id)
        .single(),
      supabase
        .from("students")
        .select("display_name,class_id")
        .eq("id", diagnosis.student_id)
        .single(),
      diagnosis.assessment_id
        ? supabase
            .from("assessments")
            .select("title")
            .eq("id", diagnosis.assessment_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (
      workspaceResult.error ||
      studentResult.error ||
      !workspaceResult.data ||
      !studentResult.data
    ) {
      throw (
        workspaceResult.error ??
        studentResult.error ??
        new Error("Report context is unavailable.")
      );
    }

    let className = "Class not linked";
    let classSession = "";
    if (studentResult.data.class_id) {
      const { data: classRow } = await supabase
        .from("classes")
        .select("name,academic_session")
        .eq("id", studentResult.data.class_id)
        .maybeSingle();
      if (classRow?.name) className = classRow.name;
      if (classRow?.academic_session) classSession = classRow.academic_session;
    }

    const academicSession = diagnosis.academic_session || classSession;
    if (!academicSession || !diagnosis.term) {
      return Response.json(
        {
          error:
            "This diagnosis does not yet have its Academic Session and Term. Set the report period before final parent export.",
        },
        { status: 409 },
      );
    }

    const bytes = createDiagnosisPdf({
      workspaceName: workspaceResult.data.name,
      studentName: studentResult.data.display_name,
      className,
      academicSession,
      term: diagnosis.term,
      diagnosisMode: diagnosis.diagnosis_mode,
      assessmentTitle: assessmentResult.data?.title ?? "",
      diagnosis: diagnosisFromRow(diagnosis),
      reviewedAt: diagnosis.reviewed_at,
      finalisedAt: diagnosis.finalised_at,
    });

    return new Response(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeDiagnosisPdfFilename(studentResult.data.display_name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Parent report could not be generated.";
    return Response.json({ error: message }, { status: 400 });
  }
}
