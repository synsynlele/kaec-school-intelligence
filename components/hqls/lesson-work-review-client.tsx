"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type StudentWork = {
  work_id: string;
  student_id: string;
  student_name: string;
  status: "assigned" | "submitted" | "reviewed";
  reflection_response: string;
  assignment_response: string;
  submitted_at: string | null;
  teacher_feedback: string;
  reviewed_at: string | null;
};

type DeliveryReview = {
  delivery_id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_topic: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  delivered_at: string;
  reflection_prompt: string;
  real_life_assignment: string;
  assigned_count: number;
  submitted_count: number;
  reviewed_count: number;
  students: StudentWork[];
};

type ReviewPayload = {
  workspace_id: string;
  role: string;
  deliveries: DeliveryReview[];
};

async function loadReviewPayload(supabase: SupabaseClient): Promise<ReviewPayload | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", session.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.default_workspace_id) {
    throw new Error("Choose a school workspace before reviewing lesson work.");
  }

  const { data, error } = await supabase.rpc("get_lesson_delivery_review", {
    target_workspace_id: profile.default_workspace_id,
  });
  if (error) throw error;
  return data as ReviewPayload;
}

export function LessonWorkReviewClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "reviewed" | "pending">("all");

  async function refresh() {
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    const next = await loadReviewPayload(supabase);
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setPayload(next);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadReviewPayload(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setPayload(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Lesson work review could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const totals = useMemo(() => {
    const deliveries = payload?.deliveries ?? [];
    return deliveries.reduce(
      (acc, item) => ({
        assigned: acc.assigned + Number(item.assigned_count ?? 0),
        submitted: acc.submitted + Number(item.submitted_count ?? 0),
        reviewed: acc.reviewed + Number(item.reviewed_count ?? 0),
      }),
      { assigned: 0, submitted: 0, reviewed: 0 },
    );
  }, [payload]);

  const visibleDeliveries = useMemo(() => {
    if (!payload) return [];
    if (filter === "all") return payload.deliveries;
    return payload.deliveries.filter((delivery) => {
      if (filter === "submitted") return delivery.students.some((item) => item.status === "submitted");
      if (filter === "reviewed") return delivery.students.some((item) => item.status === "reviewed");
      return delivery.students.some((item) => item.status === "assigned");
    });
  }, [payload, filter]);

  if (loading) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading lesson work review…</p></main>;
  }

  if (error || !payload) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Lesson work review unavailable."}</div></main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/hqls/deliver" className="text-sm font-semibold text-emerald-900">← Lesson Delivery</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Lesson Work Review</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">Close the learning loop</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Review each learner&apos;s reflection and real-life assignment in the exact school → class → subject → lesson → teacher → student context where the work was created.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600">Role: {payload.role}</span>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <Metric label="Assigned" value={totals.assigned} />
        <Metric label="Submitted" value={totals.submitted} />
        <Metric label="Reviewed" value={totals.reviewed} />
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", "submitted", "pending", "reviewed"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-3.5 py-2 text-xs font-bold capitalize ${filter === item ? "bg-emerald-950 text-white" : "bg-zinc-100 text-zinc-600"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="mt-7 space-y-5">
        {visibleDeliveries.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
            No lesson delivery matches this review view yet.
          </div>
        ) : (
          visibleDeliveries.map((delivery) => (
            <DeliveryCard key={delivery.delivery_id} delivery={delivery} onReviewed={refresh} />
          ))
        )}
      </section>
    </main>
  );
}

function DeliveryCard({ delivery, onReviewed }: { delivery: DeliveryReview; onReviewed: () => Promise<void> }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-6 sm:p-7">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{delivery.class_name}</span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{delivery.subject_name}</span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{delivery.submitted_count}/{delivery.assigned_count} submitted</span>
        </div>
        <h2 className="mt-3 text-xl font-bold text-zinc-950">{delivery.lesson_title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{delivery.lesson_topic}</p>
        <p className="mt-3 text-xs font-semibold text-zinc-400">
          Taught by {delivery.teacher_name} · {new Date(delivery.delivered_at).toLocaleDateString()}
        </p>
      </div>

      <div className="divide-y divide-zinc-100">
        {delivery.students.map((student) => (
          <StudentReview key={student.work_id} student={student} delivery={delivery} onReviewed={onReviewed} />
        ))}
      </div>
    </article>
  );
}

function StudentReview({
  student,
  delivery,
  onReviewed,
}: {
  student: StudentWork;
  delivery: DeliveryReview;
  onReviewed: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState(student.teacher_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedback.trim()) {
      setError("Write useful feedback before marking this work reviewed.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("review_student_lesson_work", {
        target_work_id: student.work_id,
        feedback_text: feedback.trim(),
      });
      if (rpcError) throw rpcError;
      setNotice("Feedback saved and this learning loop is marked reviewed.");
      await onReviewed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="p-6 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-zinc-950">{student.student_name}</p>
          <p className="mt-1 text-xs font-semibold text-zinc-400">
            {student.submitted_at ? `Submitted ${new Date(student.submitted_at).toLocaleString()}` : "Not submitted yet"}
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${student.status === "reviewed" ? "bg-emerald-50 text-emerald-800" : student.status === "submitted" ? "bg-blue-50 text-blue-800" : "bg-zinc-100 text-zinc-500"}`}>
          {student.status}
        </span>
      </div>

      {student.status === "assigned" ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">This learner has not submitted the lesson reflection or real-life assignment yet.</p>
      ) : (
        <form onSubmit={review} className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_0.9fr]">
          <ResponseBlock title="Reflection" prompt={delivery.reflection_prompt} response={student.reflection_response} />
          <ResponseBlock title="Real-life assignment" prompt={delivery.real_life_assignment} response={student.assignment_response} />
          <div className="rounded-2xl border border-zinc-200 bg-stone-50 p-5">
            <label className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-800">Teacher feedback</label>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={7}
              placeholder="Acknowledge what worked, identify the next improvement, and give one clear next action."
              className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-700"
            />
            {error ? <p className="mt-3 text-xs leading-5 text-red-700">{error}</p> : null}
            {notice ? <p className="mt-3 text-xs leading-5 text-emerald-800">{notice}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-emerald-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : student.status === "reviewed" ? "Update feedback" : "Mark reviewed"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ResponseBlock({ title, prompt, response }: { title: string; prompt: string; response: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-800">{title}</p>
      {prompt ? <p className="mt-2 text-xs leading-5 text-zinc-500">{prompt}</p> : null}
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-zinc-800">{response || "No response provided."}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-zinc-950">{value}</p>
    </div>
  );
}
