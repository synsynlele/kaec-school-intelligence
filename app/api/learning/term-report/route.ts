import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { ResultReport, TermReport } from "@/lib/learning/result-report";
import { createLearningTermPdf } from "@/lib/pdf/diagnosis-pdf";
import { pdfSafeValue } from "@/lib/pdf/layout-safety";
import type { Database } from "@/lib/supabase/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return Response.json({ error: "Sign in to download reports." }, { status: 401, headers });
  const query = new URL(request.url).searchParams;
  const reportId = query.get("report") ?? "";
  if (!query.has("target_class") && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(reportId)) {
    return Response.json({ error: "Choose a published report." }, { status: 400, headers });
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const client = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  if (query.has("target_class")) {
    const { data, error } = await client.rpc("get_published_learning_class_reports", {
      school_id: query.get("school_id") ?? "",
      target_class: query.get("target_class") ?? "",
      school_session: query.get("school_session") ?? "",
      school_term: query.get("school_term") ?? "",
      report_kind: query.get("report_kind") ?? "",
    });
    const reports = data as unknown as TermReport[] | null;
    if (error || !reports?.length) return Response.json({ error: "No published class reports available." }, { status: 404, headers });
    try {
      return new Response(createLearningTermPdf(pdfSafeValue(reports)) as BodyInit, { headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="ksi-class-reports.pdf"',
      } });
    } catch {
      return Response.json({ error: "Could not prepare the class PDF." }, { status: 500, headers });
    }
  }

  const parent = await client.rpc("get_my_parent_term_reports", { report_id: reportId });
  const parentReport = (parent.data as unknown as TermReport[] | null)?.[0];
  const learner = parentReport ? null : await client.rpc("get_my_learner_term_reports", { report_id: reportId });
  const report = parentReport ?? (learner?.data as unknown as TermReport[] | null)?.[0];
  if (!report) return Response.json({ error: "Published report unavailable." }, { status: 404, headers });

  try {
    const bundle = Boolean(parentReport) && query.get("combined") === "1";
    let reports = [report];
    let diagnoses: ResultReport[] = [];
    if (bundle) {
      const [otherReports, diagnosisList] = await Promise.all([
        client.rpc("get_my_parent_term_reports", {}),
        client.rpc("get_my_parent_learning_diagnoses", {}),
      ]);
      if (otherReports.error || diagnosisList.error) throw new Error("Could not read approved reports.");
      const samePeriod = (item: { learner_id?: string; academic_session: string | null; term: string | null }) =>
        item.learner_id === report.learner_id && item.academic_session === report.academic_session
        && item.term?.trim().toLowerCase() === report.term.trim().toLowerCase();
      const relatedReports = (otherReports.data as unknown as TermReport[]).filter((item) => item.id !== reportId && samePeriod(item));
      const relatedDiagnoses = (diagnosisList.data as unknown as ResultReport[]).filter(samePeriod);
      const [resultRows, diagnosisRows] = await Promise.all([
        Promise.all(relatedReports.map(({ id }) => client.rpc("get_my_parent_term_reports", { report_id: id }))),
        Promise.all(relatedDiagnoses.map(({ id }) => client.rpc("get_my_parent_learning_diagnoses", { diagnosis_id: id }))),
      ]);
      if ([...resultRows, ...diagnosisRows].some((item) => item.error || !Array.isArray(item.data) || item.data.length !== 1)) {
        throw new Error("Approved reports changed. Try again.");
      }
      reports = reports.concat(resultRows.flatMap(({ data }) => data as unknown as TermReport[]));
      reports.sort((a, b) => a.kind.localeCompare(b.kind));
      diagnoses = diagnosisRows.flatMap(({ data }) => data as unknown as ResultReport[]);
    }

    const bytes = createLearningTermPdf(pdfSafeValue(reports), pdfSafeValue(diagnoses));
    return new Response(bytes as BodyInit, { headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ksi-${bundle ? "combined-term" : report.kind}-report.pdf"`,
    } });
  } catch {
    return Response.json({ error: "Could not prepare the report PDF." }, { status: 500, headers });
  }
}
