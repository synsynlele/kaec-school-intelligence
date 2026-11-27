import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

type Link = { id: string; name: string; school: string | null; learner: string | null };
type Fee = { id: string; total: number; paid: number; outstanding: number };

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return Response.json(null, { status: 401, headers });
  const { url, publishableKey } = getSupabasePublicEnv();
  const db = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await db.rpc("get_my_parent_fee_links");
  if (error) return Response.json(null, { status: 503, headers });
  if (!data) return Response.json(null, { status: 403, headers });
  const links = data.learners as Link[];
  if (!links.length) return Response.json({ fees: [] }, { headers });
  try {
    const endpoint = new URL("/api/khpos/ops/parent-fees", process.env.KHPOS_ROSTER_ORIGIN || "https://www.kshc.name.ng");
    const key = process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
    if (!key || key.length < 32 || endpoint.protocol !== "https:") throw new Error();
    const response = await fetch(endpoint, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: data.workspace, learners: links.map(({ id, school, learner }) => ({ id, school, learner })) }),
    });
    if (!response.ok) throw new Error();
    const { fees } = await response.json() as { fees: Fee[] };
    const linked = new Map(links.map(link => [link.id, link.name]));
    return Response.json({ fees: fees.flatMap(({ id, paid, total, outstanding }) => {
      const name = linked.get(id);
      return name ? [{ id, name, paid, total, outstanding }] : [];
    }) }, { headers });
  } catch {
    return Response.json(null, { status: 503, headers });
  }
}
