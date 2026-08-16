"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const PAIRING_CODE_KEY = "ksi:khpos:pairing-code";
const AUTH_RETURN_KEY = "ksi:auth:returnTo";

type Workspace = {
  id: string;
  name: string;
  role: string;
};

type PairingSuccess = {
  organisationId: string;
  workspaceName: string;
  sourceGeneratedAt: string;
  windowStart: string;
  windowEnd: string;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

export function KhposPairingClient() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [pairingCode, setPairingCode] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PairingSuccess | null>(null);

  useEffect(() => {
    let active = true;

    async function prepare() {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const incomingCode = hash.get("code")?.trim() ?? "";
        if (incomingCode) {
          window.sessionStorage.setItem(PAIRING_CODE_KEY, incomingCode);
          window.history.replaceState(null, "", window.location.pathname);
        }
        const code = incomingCode || window.sessionStorage.getItem(PAIRING_CODE_KEY) || "";
        if (!code) {
          throw new Error(
            "This pairing request is missing or has already been used. Start a new KSI connection from KHP-OS.",
          );
        }
        if (!active) return;
        setPairingCode(code);

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session?.access_token) {
          window.sessionStorage.setItem(AUTH_RETURN_KEY, "/integrations/khpos");
          router.replace("/sign-in");
          return;
        }

        const response = await fetch("/api/integrations/khpos", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as {
          ok?: boolean;
          workspaces?: Workspace[];
          error?: string;
        };
        if (!response.ok || !body.ok || !Array.isArray(body.workspaces)) {
          throw new Error(body.error ?? "Your KSI school workspaces could not be loaded.");
        }
        if (!active) return;
        setWorkspaces(body.workspaces);
        if (body.workspaces.length === 1) setWorkspaceId(body.workspaces[0].id);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "The secure KHP-OS connection could not be prepared.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void prepare();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function approve() {
    if (!pairingCode || !workspaceId || busy) return;
    setBusy(true);
    setError(null);

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        window.sessionStorage.setItem(AUTH_RETURN_KEY, "/integrations/khpos");
        router.replace("/sign-in");
        return;
      }

      const response = await fetch("/api/integrations/khpos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "pair",
          pairingToken: pairingCode,
          workspaceId,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        organisationId?: string;
        workspace?: { id: string; name: string };
        sourceGeneratedAt?: string;
        windowStart?: string;
        windowEnd?: string;
        error?: string;
      };
      if (
        !response.ok ||
        !body.ok ||
        !body.organisationId ||
        !body.workspace?.name ||
        !body.sourceGeneratedAt ||
        !body.windowStart ||
        !body.windowEnd
      ) {
        throw new Error(
          body.error ?? "KHP-OS did not accept this KSI connection request.",
        );
      }

      window.sessionStorage.removeItem(PAIRING_CODE_KEY);
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      setSuccess({
        organisationId: body.organisationId,
        workspaceName: body.workspace.name,
        sourceGeneratedAt: body.sourceGeneratedAt,
        windowStart: body.windowStart,
        windowEnd: body.windowEnd,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The secure KHP-OS connection could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-900" />
        <p className="mt-4 text-sm font-medium text-zinc-600">
          Verifying the secure KHP-OS pairing request…
        </p>
      </div>
    );
  }

  if (success) {
    const returnUrl = `https://www.kshc.name.ng/khpos/${encodeURIComponent(success.organisationId)}/learning-intelligence`;
    return (
      <div className="rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="grid size-12 place-items-center rounded-2xl bg-emerald-950 text-xl font-bold text-white">
          ✓
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
          Secure connection approved
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          {success.workspaceName} is now connected to KHP-OS.
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-600">
          KSI sent the initial governed 90-day learning-intelligence snapshot. No learner records,
          teacher rankings, lesson content or diagnosis prose were transferred.
        </p>
        <div className="mt-6 grid gap-3 rounded-2xl bg-stone-50 p-5 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Signal window</p>
            <p className="mt-1 font-semibold">{dateLabel(success.windowStart)} → {dateLabel(success.windowEnd)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Generated</p>
            <p className="mt-1 font-semibold">{dateLabel(success.sourceGeneratedAt)}</p>
          </div>
        </div>
        <a
          href={returnUrl}
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          Return to KHP-OS Learning Intelligence →
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
        KSI × KHP-OS
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
        Approve the institution-level learning signal connection.
      </h1>
      <p className="mt-4 text-sm leading-7 text-zinc-600">
        KHP-OS requested a secure binding to one KSI school workspace. Only a KSI Owner or Admin
        can approve it, and the connection is limited to aggregate learning-quality signals.
      </p>

      <section className="mt-7 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
        <p className="text-sm font-semibold text-emerald-950">What KHP-OS receives</p>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-emerald-950/80 sm:grid-cols-2">
          <p>• Lesson validation counts</p>
          <p>• HQLS fidelity pass rate and average</p>
          <p>• Assessment validation and lesson linkage</p>
          <p>• Final-diagnosis governance counts</p>
          <p>• Confirmed intervention continuity</p>
          <p>• A bounded 90-day signal window</p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-950">What never leaves KSI through this connection</p>
        <p className="mt-2 text-sm leading-6 text-amber-900/80">
          Student identities, teacher rankings, lesson text, assessment questions, individual scores,
          diagnosis prose and intervention narratives are excluded from the integration contract.
        </p>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </div>
      ) : null}

      {!error && workspaces.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-stone-50 p-5">
          <p className="font-semibold text-zinc-900">No approvable school workspace is available.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            This account must be an Owner or Admin of a KSI school workspace before it can be connected.
          </p>
          <Link href="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-emerald-900 hover:underline">
            Open KSI dashboard →
          </Link>
        </div>
      ) : null}

      {workspaces.length > 0 ? (
        <div className="mt-7">
          <label className="block text-sm font-semibold text-zinc-900" htmlFor="khpos-workspace">
            KSI school workspace
          </label>
          <select
            id="khpos-workspace"
            value={workspaceId}
            disabled={busy}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-700"
          >
            <option value="">Choose the exact school workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name} · {workspace.role}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={busy || !workspaceId || !pairingCode}
            onClick={() => void approve()}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Connecting securely…" : "Approve secure KHP-OS connection"}
          </button>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Approval creates an institution-to-institution binding. It does not give KHP-OS access to browse your KSI workspace.
          </p>
        </div>
      ) : null}
    </div>
  );
}
