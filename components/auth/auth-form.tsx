"use client";

import { FormEvent, useMemo, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";
type EntryRole = "owner" | "teacher";

const AUTH_RETURN_KEY = "ksi:auth:returnTo";
const AUTH_ENTRY_KEY = "ksi:auth:entryRole";

const ROLE_CONFIG: Record<
  EntryRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    signUpHelp: string;
    signInHelp: string;
    destination: string;
    icon: string;
  }
> = {
  owner: {
    label: "School Owner",
    shortLabel: "Owner",
    description: "For proprietors and authorised school owners.",
    signUpHelp:
      "Create your KSI identity, then request school access. KAEC reviews and activates the school before school-level KSI opens.",
    signInHelp:
      "Sign in to your school leadership workspace or continue a school-access request already under review.",
    destination: "/auth/resolve?entry=owner",
    icon: "🏫",
  },
  teacher: {
    label: "Teacher / Staff",
    shortLabel: "Staff",
    description: "For teachers, school leaders and authorised school staff.",
    signUpHelp:
      "Create your KSI identity, then enter the Staff Access Code sent to your school email by the owner or administrator.",
    signInHelp:
      "Sign in to your existing Teacher or Leadership workspace, or connect your account with a Staff Access Code.",
    destination: "/auth/resolve?entry=teacher",
    icon: "🧑🏾‍🏫",
  },
};

function safePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/auth/resolve";
}

export function AuthForm() {
  const [role, setRole] = useState<EntryRole | null>(null);
  const [mode, setMode] = useState<Mode>("sign_in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleConfig = role ? ROLE_CONFIG[role] : null;
  const destination = useMemo(
    () => safePath(roleConfig?.destination ?? "/auth/resolve"),
    [roleConfig?.destination],
  );

  function storeEntryIntent() {
    if (role) window.sessionStorage.setItem(AUTH_ENTRY_KEY, role);
    window.sessionStorage.setItem(AUTH_RETURN_KEY, destination);
  }

  function prepareReturnPath() {
    storeEntryIntent();
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
  }

  async function handleGoogleSignIn() {
    if (!roleConfig || !role) {
      setError("Choose School Owner or Teacher / Staff first.");
      return;
    }

    setGoogleBusy(true);
    setError(null);
    setMessage(null);

    try {
      const { error: oauthError } = await getBrowserSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: prepareReturnPath() },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Google authentication could not be started.",
      );
      setGoogleBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roleConfig || !role) {
      setError("Choose how you are entering KSI first.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getBrowserSupabaseClient();
      storeEntryIntent();

      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;

        window.location.replace(destination);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim() || undefined,
            ksi_entry_role: role,
          },
          emailRedirectTo:
            typeof window === "undefined" ? undefined : prepareReturnPath(),
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.replace(destination);
      } else {
        setMessage(
          `Account created. Check your email to confirm it. After confirmation, KSI will verify existing school access before continuing with the ${roleConfig.label} flow.`,
        );
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

  function chooseRole(nextRole: EntryRole) {
    setRole(nextRole);
    setError(null);
    setMessage(null);
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  return (
    <div className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Enter KSI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Choose your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          KSI is built for teachers and school leadership. Your governed school membership—not the button you choose here—determines what opens after sign-in.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(Object.keys(ROLE_CONFIG) as EntryRole[]).map((entryRole) => {
          const config = ROLE_CONFIG[entryRole];
          const selected = role === entryRole;
          return (
            <button
              key={entryRole}
              type="button"
              onClick={() => chooseRole(entryRole)}
              className={`rounded-2xl border p-5 text-left transition ${
                selected
                  ? "border-emerald-800 bg-emerald-50 ring-2 ring-emerald-800/10"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{config.icon}</span>
              <span className="mt-3 block text-base font-bold text-zinc-950">{config.label}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">{config.description}</span>
            </button>
          );
        })}
      </div>

      {roleConfig ? (
        <div className="mt-7 border-t border-zinc-200 pt-7">
          <div className="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => changeMode("sign_in")}
              className={`rounded-lg px-3 py-2.5 transition ${
                mode === "sign_in" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => changeMode("sign_up")}
              className={`rounded-lg px-3 py-2.5 transition ${
                mode === "sign_up" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="text-sm font-bold text-emerald-950">
              {mode === "sign_in" ? `Sign in as ${roleConfig.label}` : `Create ${roleConfig.label} account`}
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-900">
              {mode === "sign_in" ? roleConfig.signInHelp : roleConfig.signUpHelp}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={googleBusy || busy}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-950 px-4 py-3.5 font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {googleBusy
              ? "Connecting to Google…"
              : mode === "sign_in"
                ? `Continue with Google as ${roleConfig.shortLabel}`
                : `Create ${roleConfig.shortLabel} account with Google`}
          </button>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">or use email</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "sign_up" ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Your name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  placeholder="e.g. Tola Adebayo"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                placeholder={role === "teacher" ? "teacher@school.com" : "owner@school.com"}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Password</span>
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
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>
            ) : null}
            {message ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{message}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy || googleBusy}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-bold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : mode === "sign_in"
                  ? `Sign in as ${roleConfig.shortLabel}`
                  : `Create ${roleConfig.shortLabel} account`}
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-center">
          <p className="text-sm font-semibold text-zinc-700">Choose School Owner or Teacher / Staff to continue.</p>
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-zinc-500">
        Choosing an entry path never grants authority. Owner access requires KAEC approval. Teacher, Leader and Admin access is granted only through a school-issued, email-bound Staff Access Code.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 rounded-full bg-white p-0.5">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.49l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.59C7.18 7.73 9.39 5.97 12 5.97Z" />
    </svg>
  );
}
