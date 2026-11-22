import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { ResultReport } from "@/lib/learning/result-report";
import { createLearningResultPdf } from "@/lib/pdf/diagnosis-pdf";
import { pdfSafeValue } from "@/lib/pdf/layout-safety";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return Response.json({ error: "Sign in to download your result." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const assignmentId = params.get("assignment") ?? "";
  const learnerId = params.get("learner");
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (!uuid.test(assignmentId) || (learnerId !== null && !uuid.test(learnerId))) {
    return Response.json({ error: "Choose a published result." }, { status: 400 });
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const client = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = learnerId
    ? await client.rpc("get_my_parent_learning_report", { assignment_id: assignmentId, target_learner: learnerId })
    : await client.rpc("get_my_learning_result_report", { assignment_id: assignmentId });
  if (error || !data) {
    return Response.json({ error: "Published result unavailable." }, { status: 404 });
  }

  try {
    const report = data as unknown as ResultReport;
    const bytes = createLearningResultPdf(pdfSafeValue(report));
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="ksi-assessment-result.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "Could not prepare the result PDF." }, { status: 500 });
  }
}
