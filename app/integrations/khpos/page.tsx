"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SchoolWorkspace = { id: string; name: string };

export default function KhposIntegrationPage() {
  const [pairingToken, setPairingToken] = useState("");
  const [workspaces, setWorkspaces] = useState<SchoolWorkspace[]>([]);
  const [selected, setSelected] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabaseClient();

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      const hashCode = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("code") ?? "";
      if (hashCode) sessionStorage.setItem("khpos_ksi_pairing_code", hashCode);
      const code = hashCode || sessionStorage.getItem("khpos_ksi_pairing_code") || "";
      setPairingToken(code);

      const user = data.session?.user;
      if (!user) {
        setSignedIn(false);
        setLoading(false);
        return;
      }
      setSignedIn(true);

      const { data: memberships, error: membershipError } = await supabase
        .from("workspace_members")
        .select("workspace_id,role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["owner", "admin"]);
      if (!active) return;
      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      const ids = (memberships ?? []).map((item) => item.workspace_id);
      if (!ids.length) {
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      const { data: schools, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id,name")
        .eq("workspace_type", "school")
        .in("id", ids)
        .order("name", { ascending: true });
      if (!active) return;
      if (workspaceError) {
        setError(workspaceError.message);
        setLoading(false);
        return;
      }
      const available = (schools ?? []) as SchoolWorkspace[];
      setWorkspaces(available);
      setSelected(available[0]?.id ?? "");
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  async function approve() {
    if (!selected || !pairingToken) return;
    setBusy(true);
    setError("");
    try {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sign in to KSI to approve this connection.");

      const response = await fetch("/api/integrations/khpos", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair", workspaceId: selected, pairingToken }),
      });
      const body = (await response.json()) as { ok?: boolean; returnTo?: string; error?: string };
      if (!response.ok || !body.ok || !body.returnTo) throw new Error(body.error ?? "KHP-OS connection could not be approved.");

      sessionStorage.removeItem("khpos_ksi_pairing_code");
      window.history.replaceState(null, "", "/integrations/khpos");
      window.location.assign(body.returnTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "KHP-OS connection could not be approved.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">KSI × KHP-OS</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Approve institutional learning-signal sharing</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
          KHP-OS is asking KSI to share a bounded 90-day school-level summary. KSI remains the learning engine; this connection does not move student records or give KHP-OS access to the KSI database.
        </p>

        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold">What KSI will share</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Lesson validation and HQLS fidelity rates",
              "Assessment validation and lesson alignment",
              "Diagnosis finalisation rate",
              "Confirmed intervention-to-next-lesson continuity",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">{item}</div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-zinc-500">
            Not shared: student names, learner records, teacher rankings, raw lessons, assessment questions, diagnosis prose or intervention notes.
          </p>
        </section>

        {loading ? <p className="mt-8 text-sm text-zinc-500">Checking your KSI authority…</p> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!loading && signedIn === false ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-950">Sign in to KSI first</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900/80">The pairing code is preserved in this browser tab. After signing in, return to this connection page to approve the school workspace.</p>
            <Link href="/sign-in" className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white">Sign in to KSI</Link>
          </section>
        ) : null}

        {!loading && signedIn && !pairingToken ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">This pairing link is missing or expired. Return to KHP-OS and create a new secure connection.</div>
        ) : null}

        {!loading && signedIn && pairingToken && !workspaces.length ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No school workspace where you are an Owner or Admin is available for this connection.</div>
        ) : null}

        {!loading && signedIn && pairingToken && workspaces.length ? (
          <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
            <label className="text-sm font-semibold text-zinc-800" htmlFor="khpos-workspace">School workspace</label>
            <select id="khpos-workspace" value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-700">
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            <button type="button" disabled={busy || !selected} onClick={() => void approve()} className="mt-5 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Connecting securely…" : "Approve connection"}
            </button>
            <p className="mt-3 text-xs text-zinc-500">This is the only manual approval. Future bounded signal refreshes are automatic while your KSI authority remains valid.</p>
          </section>
        ) : null}

        <Link href="/dashboard" className="mt-8 inline-flex text-sm font-medium text-zinc-500 hover:text-zinc-900">Return to KSI dashboard</Link>
      </div>
    </main>
  );
}
