"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getBrowserSupabaseClient();

      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw signInError;
        }

        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim() || undefined,
          },
          emailRedirectTo:
            typeof window === "undefined"
              ? undefined
              : `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setMessage(
          "Account created. Check your email to confirm your account, then sign in.",
        );
        setMode("sign_in");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Authentication could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
          KAEC School Intelligence
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          {mode === "sign_in" ? "Welcome back" : "Create your workspace"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {mode === "sign_in"
            ? "Sign in to your lessons, assessments and student diagnoses."
            : "Start with a private workspace. You can create a school workspace after sign-in."}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => changeMode("sign_in")}
          className={`rounded-lg px-3 py-2.5 transition ${
            mode === "sign_in"
              ? "bg-white text-zinc-950 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => changeMode("sign_up")}
          className={`rounded-lg px-3 py-2.5 transition ${
            mode === "sign_up"
              ? "bg-white text-zinc-950 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "sign_up" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-800">
              Your name
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              placeholder="e.g. Tola Adebayo"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-800">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            placeholder="teacher@school.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-800">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            className="w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            placeholder="At least 6 characters"
          />
        </label>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-emerald-900 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Please wait…"
            : mode === "sign_in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-xs leading-5 text-zinc-500">
        KAEC School Intelligence uses secure workspace boundaries so school data,
        student evidence and diagnoses remain private to authorised users.
      </p>
    </div>
  );
}
