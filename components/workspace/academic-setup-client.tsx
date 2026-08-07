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

  return {
    userId: user.id,
    workspace: workspaceResult.data,
    role: membershipResult.data.role,
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
          class_id: studentClassId || null,
          display_name: studentName.trim(),
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
          {error ?? "The active workspace could not be loaded."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">KAEC School Intelligence</p>
            <p className="mt-1 text-sm text-zinc-500">Academic workspace foundation</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">{context.workspace.name}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Academic Setup</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Establish reusable subjects, classes and student records once. HQLS, Assessment and Diagnosis will inherit this context instead of making teachers re-enter it on every task.
            </p>
          </div>
          <div className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600">
            Role: {context.role}
          </div>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
        {!canManage ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You can view this school setup, but only workspace owners or administrators can change the school roster and configuration.
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <SetupPanel title="Subjects" count={context.subjects.length}>
            {canManage ? (
              <form onSubmit={addSubject} className="space-y-3 border-b border-zinc-100 pb-5">
                <TextInput label="Subject name" value={subjectName} setValue={setSubjectName} placeholder="Mathematics" required />
                <TextInput label="Code (optional)" value={subjectCode} setValue={setSubjectCode} placeholder="MTH" />
                <SubmitButton busy={saving === "subject"}>Add subject</SubmitButton>
              </form>
            ) : null}
            <div className="divide-y divide-zinc-100">
              {context.subjects.length ? context.subjects.map((subject) => (
                <div key={subject.id} className="py-3">
                  <p className="text-sm font-semibold">{subject.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">{subject.code || "No code"}</p>
                </div>
              )) : <EmptyText text="No subjects yet." />}
            </div>
          </SetupPanel>

          <SetupPanel title="Classes" count={context.classes.length}>
            {canManage ? (
              <form onSubmit={addClass} className="space-y-3 border-b border-zinc-100 pb-5">
                <TextInput label="Class name" value={className} setValue={setClassName} placeholder="JSS 2" required />
                <TextInput label="Age range (optional)" value={ageRange} setValue={setAgeRange} placeholder="12–14" />
                <TextInput label="Academic session (optional)" value={academicSession} setValue={setAcademicSession} placeholder="2026/2027" />
                <SubmitButton busy={saving === "class"}>Add class</SubmitButton>
              </form>
            ) : null}
            <div className="divide-y divide-zinc-100">
              {context.classes.length ? context.classes.map((item) => (
                <div key={item.id} className="py-3">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {[item.age_range, item.academic_session].filter(Boolean).join(" · ") || "No extra details"}
                  </p>
                </div>
              )) : <EmptyText text="No classes yet." />}
            </div>
          </SetupPanel>

          <SetupPanel title="Students" count={context.students.length}>
            {canManage ? (
              <form onSubmit={addStudent} className="space-y-3 border-b border-zinc-100 pb-5">
                <TextInput label="Student name" value={studentName} setValue={setStudentName} placeholder="Student name" required />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-600">Class (optional)</span>
                  <select value={studentClassId} onChange={(event) => setStudentClassId(event.target.value)} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700">
                    <option value="">No class selected</option>
                    {context.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <TextInput label="School reference (optional)" value={studentReference} setValue={setStudentReference} placeholder="Admission / student ID" />
                <SubmitButton busy={saving === "student"}>Add student</SubmitButton>
              </form>
            ) : null}
            <div className="divide-y divide-zinc-100">
              {context.students.length ? context.students.map((student) => (
                <div key={student.id} className="py-3">
                  <p className="text-sm font-semibold">{student.display_name}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {[student.class_id ? classNames.get(student.class_id) : null, student.external_reference].filter(Boolean).join(" · ") || "No class assigned"}
                  </p>
                </div>
              )) : <EmptyText text="No students yet." />}
            </div>
          </SetupPanel>
        </div>
      </div>
    </main>
  );
}

function SetupPanel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{count}</span>
      </div>
      {children}
    </section>
  );
}

function TextInput({ label, value, setValue, placeholder, required = false }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <input required={required} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700" />
    </label>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50">
      {busy ? "Saving…" : children}
    </button>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-7 text-center text-sm text-zinc-400">{text}</p>;
}
