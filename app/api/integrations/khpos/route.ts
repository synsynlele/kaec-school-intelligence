import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  KhposIntegrationError,
  khposReturnUrl,
  pairWithKhpos,
  syncWithKhpos,
} from "@/lib/integrations/khpos";

export const runtime = "nodejs";

const CONNECTOR_COOKIE = "ksi_khpos_connector";
const WORKSPACE_COOKIE = "ksi_khpos_workspace";
const LAST_SYNC_COOKIE = "ksi_khpos_last_sync";
const CONNECTOR_MAX_AGE = 60 * 60 * 24 * 90;
const SYNC_INTERVAL_MS = 60 * 60 * 1000;

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  return value.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

function secureCookieOptions(maxAge = CONNECTOR_MAX_AGE) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "KHP-OS integration could not complete this request.";
  const status = error instanceof KhposIntegrationError ? error.status : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ ok: false, error: "Sign in to KSI to continue." }, { status: 401 });

  let payload: { action?: "pair" | "sync"; workspaceId?: string; pairingToken?: string } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid KHP-OS integration request." }, { status: 400 });
  }

  const cookieStore = await cookies();

  try {
    if (payload.action === "pair") {
      const workspaceId = payload.workspaceId?.trim() ?? "";
      const pairingToken = payload.pairingToken?.trim() ?? "";
      if (workspaceId.length < 8 || pairingToken.length < 32) {
        throw new KhposIntegrationError("Choose a school workspace and use a valid KHP-OS pairing link.", 400);
      }

      const paired = await pairWithKhpos(accessToken, workspaceId, pairingToken);
      const response = NextResponse.json({
        ok: true,
        connected: true,
        returnTo: khposReturnUrl(paired.organisationId),
      });
      response.cookies.set(CONNECTOR_COOKIE, paired.connectorToken, secureCookieOptions());
      response.cookies.set(WORKSPACE_COOKIE, paired.workspaceId, secureCookieOptions());
      response.cookies.set(LAST_SYNC_COOKIE, String(Date.now()), secureCookieOptions());
      return response;
    }

    if (payload.action === "sync") {
      const connectorToken = cookieStore.get(CONNECTOR_COOKIE)?.value ?? "";
      const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? "";
      if (!connectorToken || !workspaceId) {
        return NextResponse.json({ ok: true, connected: false, skipped: true });
      }

      const lastSync = Number(cookieStore.get(LAST_SYNC_COOKIE)?.value ?? "0");
      if (Number.isFinite(lastSync) && lastSync > 0 && Date.now() - lastSync < SYNC_INTERVAL_MS) {
        return NextResponse.json({ ok: true, connected: true, skipped: true, reason: "throttled" });
      }

      await syncWithKhpos(accessToken, workspaceId, connectorToken);
      const response = NextResponse.json({ ok: true, connected: true, synced: true });
      response.cookies.set(LAST_SYNC_COOKIE, String(Date.now()), secureCookieOptions());
      return response;
    }

    throw new KhposIntegrationError("Choose a valid KHP-OS integration operation.", 400);
  } catch (error) {
    const response = errorResponse(error);
    if (payload.action === "sync" && error instanceof KhposIntegrationError && [400, 401, 403].includes(error.status)) {
      response.cookies.delete(CONNECTOR_COOKIE);
      response.cookies.delete(WORKSPACE_COOKIE);
      response.cookies.delete(LAST_SYNC_COOKIE);
    }
    return response;
  }
}
