"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type TutorTurn = {
  id: string;
  question: string;
  answer: string;
  model: string | null;
  created_at: string;
  completed_at: string | null;
  key_points?: string[];
  try_next?: string;
  source_note?: string;
};

type AskResponse = {
  turnId: string;
  model: string;
  answer: string;
  key_points: string[];
  try_next: string;
  source_note: string;
  error?: string;
};

async function loadHistory(supabase: SupabaseClient): Promise<TutorTurn[] | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data, error } = await supabase.rpc("get_my_ask_ksi_history", {
    target_limit: 12,
  });
  if (error) throw error;
  const payload = data as { turns?: TutorTurn[] } | null;
  return payload?.turns ?? [];
}

const suggestions = [
  "Explain my current learning priority in a simpler way.",
  "Give me a real-life example connected to what I should work on next.",
  "Quiz me gently on one area I am still building.",
  "Help me understand why this topic matters outside school.",
];

export function AskKsiClient() {
  const router = useRouter();
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void loadHistory(supabase)
      .then((history) => {
        if (cancelled) return;
        if (!history) {
          router.replace("/sign-in");
          return;
        }
        setTurns(history);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Ask KSI history could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = question.trim();
    if (!cleaned) return;
    if (cleaned.length > 1200) {
      setError("Keep your Ask KSI question under 1,200 characters.");
      return;
    }

    setAsking(true);
    setError(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        router.replace("/sign-in");
        return;
      }

      const response = await fetch("/api/student/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question: cleaned }),
      });
      const payload = (await response.json()) as AskResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Ask KSI could not answer that question.");
      }

      setTurns((current) => [
        ...current,
        {
          id: payload.turnId,
          question: cleaned,
          answer: payload.answer,
          model: payload.model,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          key_points: payload.key_points,
          try_next: payload.try_next,
          source_note: payload.source_note,
        },
      ]);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ask KSI could not answer that question.");
    } finally {
      setAsking(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <p className="text-sm font-semibold text-zinc-600">Preparing your KSI learning tutor…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link href="/student" className="text-sm font-semibold text-emerald-900">
        ← Student KSI
      </Link>

      <section className="mt-5 rounded-3xl bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Ask KSI</p>
        <h1 className="mt-2 text-3xl font-bold">Your learning tutor, grounded in your KSI record</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">
          Ask for explanations, examples, hints, practice and reflection. Ask KSI can use your student-safe diagnosis,
          confirmed intervention, mastery, learning plan, validated class resources and published curriculum resources.
          It cannot change your official diagnosis, intervention or mastery state.
        </p>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Try asking</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuestion(suggestion)}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-left text-xs font-semibold text-emerald-950 transition hover:bg-emerald-100"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form onSubmit={ask} className="mt-5">
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Your learning question</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              maxLength={1200}
              placeholder="For example: I still confuse pronouns and nouns. Can you explain them using things around me?"
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm leading-6 outline-none focus:border-emerald-700"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-zinc-400">{question.length}/1200</span>
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {asking ? "KSI is thinking…" : "Ask KSI"}
            </button>
          </div>
          {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        </form>
      </section>

      <section className="mt-7 space-y-5">
        {turns.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-7 text-sm leading-6 text-zinc-600">
            No Ask KSI conversation yet. Start with something you want to understand better, practise or connect to real life.
          </div>
        ) : (
          turns.map((turn) => <TutorTurnCard key={turn.id} turn={turn} />)
        )}
      </section>
    </main>
  );
}

function TutorTurnCard({ turn }: { turn: TutorTurn }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">You asked</p>
        <p className="mt-2 text-base font-semibold leading-7 text-zinc-900">{turn.question}</p>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Ask KSI</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-zinc-700">{turn.answer}</p>

        {turn.key_points?.length ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-800">Keep these in mind</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
              {turn.key_points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {turn.try_next ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Try next:</strong> {turn.try_next}
          </div>
        ) : null}

        {turn.source_note ? <p className="mt-4 text-xs leading-5 text-zinc-400">{turn.source_note}</p> : null}
      </div>
    </article>
  );
}