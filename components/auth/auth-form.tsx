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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Google sign-in could not be started.",
      );
      setGoogleBusy(false);
    }
  }

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
              : `${window.location.origin}/auth/callback`,
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
          Continue with Google for the fastest, recommended way into your secure
          KSI workspace.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={googleBusy || busy}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-900 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {googleBusy ? "Connecting to Google…" : "Continue with Google"}
      </button>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
          or use email
        </span>
        <div className="h-px flex-1 bg-zinc-200" />
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
          Create with email
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
          disabled={busy || googleBusy}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Please wait…"
            : mode === "sign_in"
              ? "Sign in with email"
              : "Create account with email"}
        </button>
      </form>

      <p className="mt-6 text-xs leading-5 text-zinc-500">
        Email and password remain available as a fallback. KAEC School Intelligence
        uses secure workspace boundaries so school data, student evidence and diagnoses
        remain private to authorised users.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 rounded-full bg-white p-0.5"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.49l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.97c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.59C7.18 7.73 9.39 5.97 12 5.97Z"
      />
    </svg>
  );
}
