"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type SchoolClass = Database["public"]["Tables"]["classes"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

type SetupContext = {
  userId: string;
  workspace: Workspace;
  role: string;
  subjects: Subject[];
  classes: SchoolClass[];
  students: Student[];
};

async function loadSetupContext(): Promise<SetupContext | null> {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile.default_workspace_id) {
    throw new Error("No active workspace is configured for this account.");
  }

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult, subjectResult, classResult, studentResult] =
    await Promise.all([
      supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("subjects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name"),
      supabase
        .from("classes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name"),
      supabase
        .from("students")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("display_name"),
    ]);

  const firstError =
    workspaceResult.error ??
    membershipResult.error ??
    subjectResult.error ??
    classResult.error ??
    studentResult.error;
  if (firstError) throw firstError;

  const workspace = workspaceResult.data;
  const membership = membershipResult.data;
  if (!workspace || !membership) {
    throw new Error("Active workspace membership could not be resolved.");
  }

  return {
    userId: user.id,
    workspace,
    role: membership.role,
    subjects: subjectResult.data ?? [],
    classes: classResult.data ?? [],
    students: studentResult.data ?? [],
  };
}

export function AcademicSetupClient() {
  const router = useRouter();
  const [context, setContext] = useState<SetupContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [className, setClassName] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentClassId, setStudentClassId] = useState("");
  const [studentReference, setStudentReference] = useState("");

  const canManage = useMemo(
    () => context?.role === "owner" || context?.role === "admin",
    [context?.role],
  );

  const classNames = useMemo(
    () => new Map(context?.classes.map((item) => [item.id, item.name]) ?? []),
    [context?.classes],
  );

  const refresh = useCallback(async () => {
    const next = await loadSetupContext();
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setContext(next);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void loadSetupContext()
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setContext(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Workspace setup could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !canManage || !subjectName.trim()) return;
    setSaving("subject");
    setError(null);
    setSuccess(null);
    try {
      const { error: insertError } = await getBrowserSupabaseClient()
        .from("subjects")
        .insert({
          workspace_id: context.workspace.id,
          created_by: context.userId,
          name: subjectName.trim(),
          code: subjectCode.trim() || null,
        });
      if (insertError) throw insertError;
      setSubjectName("");
      setSubjectCode("");
      setSuccess("Subject added.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Subject could not be added.");
    } finally {
      setSaving(null);
    }
  }

  async function addClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !canManage || !className.trim()) return;
    setSaving("class");
    setError(null);
    setSuccess(null);
    try {
      const { error: insertError } = await getBrowserSupabaseClient()
        .from("classes")
        .insert({
          workspace_id: context.workspace.id,
          created_by: context.userId,
          name: className.trim(),
          age_range: ageRange.trim() || null,
          academic_session: academicSession.trim() || null,
        });
      if (insertError) throw insertError;
      setClassName("");
      setAgeRange("");
      setAcademicSession("");
      setSuccess("Class added.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Class could not be added.");
    } finally {
      setSaving(null);
    }
  }

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !canManage || !studentName.trim()) return;
    setSaving("student");
    setError(null);
    setSuccess(null);
    try {
      const { error: insertError } = await getBrowserSupabaseClient()
        .from("students")
        .insert({
          workspace_id: context.workspace.id,
          created_by: context.userId,
          display_name: studentName.trim(),
          class_id: studentClassId || null,
          external_reference: studentReference.trim() || null,
        });
      if (insertError) throw insertError;
      setStudentName("");
      setStudentClassId("");
      setStudentReference("");
      setSuccess("Student added.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Student could not be added.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm font-medium text-zinc-500">Loading academic setup…</p>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          {error ?? "Academic setup could not be loaded."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-emerald-900">
              ← Dashboard
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Stage 1 Academic Setup
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{context.workspace.name}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Define the school context that future HQLS lessons, assessments and diagnoses will reuse.
            </p>
          </div>
          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
            Role: {context.role}
          </span>
        </div>

        {error ? <Message tone="error">{error}</Message> : null}
        {success ? <Message tone="success">{success}</Message> : null}

        {!canManage ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">
            Teachers can view this setup, but only workspace owners and admins can change subjects, classes or students.
          </section>
        ) : (
          <section className="grid gap-5 py-8 lg:grid-cols-3">
            <SetupForm title="Add subject" onSubmit={addSubject} busy={saving === "subject"}>
              <Input label="Subject name" value={subjectName} onChange={setSubjectName} placeholder="Mathematics" required />
              <Input label="Code (optional)" value={subjectCode} onChange={setSubjectCode} placeholder="MATH" />
            </SetupForm>

            <SetupForm title="Add class" onSubmit={addClass} busy={saving === "class"}>
              <Input label="Class name" value={className} onChange={setClassName} placeholder="JSS 1" required />
              <Input label="Age range" value={ageRange} onChange={setAgeRange} placeholder="10–12" />
              <Input label="Academic session" value={academicSession} onChange={setAcademicSession} placeholder="2026/2027" />
            </SetupForm>

            <SetupForm title="Add student" onSubmit={addStudent} busy={saving === "student"}>
              <Input label="Student name" value={studentName} onChange={setStudentName} placeholder="Student name" required />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-800">Class</span>
                <select value={studentClassId} onChange={(event) => setStudentClassId(event.target.value)} className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 outline-none focus:border-emerald-700">
                  <option value="">Not assigned</option>
                  {context.classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <Input label="Reference (optional)" value={studentReference} onChange={setStudentReference} placeholder="Admission / local reference" />
            </SetupForm>
          </section>
        )}

        <section className="grid gap-5 pb-10 lg:grid-cols-3">
          <DataCard title="Subjects" empty="No subjects yet.">
            {context.subjects.map((item) => (
              <DataRow key={item.id} primary={item.name} secondary={item.code || "No code"} />
            ))}
          </DataCard>
          <DataCard title="Classes" empty="No classes yet.">
            {context.classes.map((item) => (
              <DataRow key={item.id} primary={item.name} secondary={[item.age_range, item.academic_session].filter(Boolean).join(" · ") || "No additional details"} />
            ))}
          </DataCard>
          <DataCard title="Students" empty="No students yet.">
            {context.students.map((item) => (
              <DataRow key={item.id} primary={item.display_name} secondary={item.class_id ? classNames.get(item.class_id) ?? "Assigned class" : "Not assigned to a class"} />
            ))}
          </DataCard>
        </section>
      </div>
    </main>
  );
}

function Message({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div className={`mt-6 rounded-2xl px-4 py-3 text-sm ${tone === "error" ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {children}
    </div>
  );
}

function SetupForm({ title, onSubmit, busy, children }: { title: string; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; busy: boolean; children: React.ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
      <button type="submit" disabled={busy} className="mt-5 w-full rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function Input({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-800">{label}</span>
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 outline-none focus:border-emerald-700" />
    </label>
  );
}

function DataCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 divide-y divide-zinc-100">{hasChildren ? children : <p className="py-3 text-sm text-zinc-500">{empty}</p>}</div>
    </div>
  );
}

function DataRow({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-zinc-900">{primary}</p>
      <p className="mt-1 text-xs text-zinc-500">{secondary}</p>
    </div>
  );
}
