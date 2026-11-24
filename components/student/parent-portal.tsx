"use client";

import Link from "next/link";

import { PasswordInput } from "@/components/auth/password-input";

import { parentLoginDomain, resolveParentLogin } from "@/lib/learning/school-login";

import { useEffect, useState, type FormEvent } from "react";

import { LearningPortalHeader } from "@/components/student/learning-portal-header";
import { LearningImprovementPlan } from "@/components/student/learning-improvement-plan";
import { LearningPublishedResults } from "@/components/student/learning-published-results";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function ParentPortal() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [replacement, setReplacement] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const client = getBrowserSupabaseClient();
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user.email?.endsWith("@parents.ksi.name.ng")) return;
      const { data: status } = await client.rpc("get_my_learning_parent_status");
      if (!cancelled && status === "active") setActive(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getBrowserSupabaseClient();
    const login = username.trim().toLowerCase();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (temporary) {
        const response = await fetch("/api/learning/parent-account", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate", username: login, temporaryPassword: password, newPassword: replacement }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setTemporary(false);
        setPassword("");
        setReplacement("");
        setMessage("Password updated. Sign in with your new password.");
        return;
      }

      if (!resolveParentLogin(login).endsWith(`@${parentLoginDomain}`)) throw new Error("Enter the full username issued by your school.");
      const { error } = await client.auth.signInWithPassword({ email: resolveParentLogin(login), password });
      if (error) throw new Error("The username or password was not accepted.");
      const status = await client.rpc("get_my_learning_parent_status");
      if (status.data === "active" && !status.error) {
        setActive(true);
        setPassword("");
      } else {
        await client.auth.signOut({ scope: "local" });
        if (status.data !== "temporary") throw new Error("This parent login is unavailable. Contact your school.");
        setTemporary(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (active) return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 bg-slate-50 px-4 py-6 sm:px-8">
      <LearningPortalHeader viewer="parent" onSignOut={async () => {
        await getBrowserSupabaseClient().auth.signOut({ scope: "local" });
        setActive(false);
      }} />
      <LearningImprovementPlan viewer="parent" />
      <LearningPublishedResults viewer="parent" />
    </main>
  );

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-8 sm:px-8">
      <Link href="/sign-in" className="text-sm font-semibold text-emerald-900 underline">Back to KSI sign-in</Link>
      <h1 className="text-3xl font-bold tracking-tight">Parent sign-in</h1>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm">Use the username and password issued by your school.</p>
        {error && <p role="alert" className="text-red-900">{error}</p>}
        {message && <p role="status">{message}</p>}
        <label className="block font-medium">School-issued username
          <input required type="email" autoComplete="username" value={username} readOnly={temporary}
            onChange={(e) => setUsername(e.target.value)} className="block w-full rounded border p-2" />
        </label>
        {temporary ? (
          <label className="block font-medium">Choose a new password
            <PasswordInput key="new-password" required autoComplete="new-password" minLength={12} maxLength={72}
              value={replacement} onChange={(e) => setReplacement(e.target.value)} className="block w-full rounded border p-2" />
          </label>
        ) : (
          <label className="block font-medium">Password
            <PasswordInput key="current-password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="block w-full rounded border p-2" />
          </label>
        )}
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {busy ? "Please wait…" : temporary ? "Set new password" : "Sign in"}
        </button>
        {temporary && <button type="button" disabled={busy} className="ml-3 underline" onClick={() => {
          setTemporary(false);
          setPassword("");
          setReplacement("");
          setError("");
        }}>Use a different login</button>}
      </form>
    </main>
  );
}
