import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import { parseHqlsStageContent } from "@/lib/hqls/engine";
import { createHqlsLessonPdf, safePdfFilename } from "@/lib/pdf/hqls-lesson-pdf";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

function responseError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function sourceLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const title = (item as Record<string, unknown>).title;
      return typeof title === "string" && title.trim() ? title.trim() : null;
    })
    .filter((item): item is string => Boolean(item));
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
  if (error || !user) throw new Error("Your session is no longer valid. Sign in again and retry.");
  return supabase;
}

export async function POST(request: Request) {
  try {
    const supabase = await authenticatedClient(request);
    const body = (await request.json().catch(() => null)) as { lessonId?: unknown } | null;
    const lessonId = typeof body?.lessonId === "string" ? body.lessonId.trim() : "";
    if (!lessonId) return responseError("Choose a saved HQLS lesson to export.", 400);

    const [lessonResult, stageResult, fidelityResult] = await Promise.all([
      supabase.from("lessons").select("*").eq("id", lessonId).single(),
      supabase
        .from("lesson_stages")
        .select("stage_number,stage_key,content")
        .eq("lesson_id", lessonId)
        .order("stage_number"),
      supabase
        .from("hqls_fidelity_checks")
        .select("passed,score,created_at")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (lessonResult.error || !lessonResult.data) {
      return responseError("That saved lesson is not available in this workspace.", 404);
    }
    if (stageResult.error || !stageResult.data || stageResult.data.length !== 7) {
      return responseError("This lesson is incomplete and cannot be exported yet.", 409);
    }
    if (fidelityResult.error) throw fidelityResult.error;

    const lesson = lessonResult.data;
    if (lesson.status !== "validated" || !fidelityResult.data?.passed) {
      return responseError(
        "Only a saved HQLS-validated lesson can be downloaded as a teacher-ready PDF.",
        409,
      );
    }

    const [workspaceResult, subjectResult, classResult] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", lesson.workspace_id).single(),
      lesson.subject_id
        ? supabase.from("subjects").select("name").eq("id", lesson.subject_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      lesson.class_id
        ? supabase.from("classes").select("name").eq("id", lesson.class_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (workspaceResult.error || !workspaceResult.data) {
      return responseError("The lesson workspace could not be resolved.", 409);
    }
    if (subjectResult.error) throw subjectResult.error;
    if (classResult.error) throw classResult.error;

    const stages = stageResult.data.map((stage, index) =>
      parseHqlsStageContent(stage.content, index + 1),
    );
    const pdf = createHqlsLessonPdf({
      workspaceName: workspaceResult.data.name,
      title: lesson.title,
      subject: subjectResult.data?.name ?? "General",
      classLevel: classResult.data?.name ?? "Not linked",
      ageRange: lesson.age_range,
      durationMinutes: lesson.duration_minutes,
      topic: lesson.topic,
      objective: lesson.objective,
      fidelityScore: Number(fidelityResult.data.score ?? 0),
      sources: sourceLabels(lesson.source_context),
      stages,
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safePdfFilename(lesson.title)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The HQLS PDF could not be prepared.";
    const status = /session|authentication/i.test(message) ? 401 : 400;
    return responseError(message, status);
  }
}
