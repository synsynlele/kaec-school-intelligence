import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

type Audience = { workspace: string; classId: string; session: string | null; subjects: string[] };
type ClassLink = { campus: string; classLabel: string; section?: string };

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "Sign in to see your timetable." }, 401);
  const { url, publishableKey } = getSupabasePublicEnv();
  const client = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("get_learning_timetable_audience");
  if (error) return reply({ error: "Your timetable is temporarily unavailable." }, 503);
  const audience = data as Audience | null;
  if (!audience) return reply({ error: "An active learner account with a class is required." }, 403);
  if (!audience.session || !audience.subjects.length) {
    return reply({ entries: [], message: "Your school needs to finish setting up your subject enrolment." });
  }

  try {
    const key = process.env.KSI_TIMETABLE_BRIDGE_KEY?.trim();
    const links = JSON.parse(process.env.KSI_TIMETABLE_CLASS_LINKS ?? "{}") as Record<string, ClassLink>;
    const link = links[audience.classId];
    if (!key || !link) return reply({ entries: [], message: "Your school has yet to connect this class to its published timetable." });
    const endpoint = new URL(process.env.KHPOS_TIMETABLE_URL || "https://www.kshc.name.ng/api/khpos/integrations/ksi/timetable");
    if (endpoint.protocol !== "https:") throw new Error("HTTPS timetable endpoint required");
    const response = await fetch(endpoint, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace: audience.workspace, campus: link.campus, classLabel: link.classLabel,
        section: link.section ?? "", session: audience.session, subjects: audience.subjects,
      }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Timetable bridge unavailable");
    return reply(await response.json());
  } catch {
    return reply({ error: "Your timetable is temporarily unavailable. Please try again." }, 503);
  }
}
