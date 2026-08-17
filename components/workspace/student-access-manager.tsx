"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type StudentRow = {
  id: string;
  display_name: string;
  class_id: string | null;
  active: boolean;
};

type ClassRow = { id: string; name: string };
type StudentAccountRow = { student_id: string; active: boolean };

type AccessContext = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  students: StudentRow[];
  classes: ClassRow[];
  accounts: StudentAccountRow[];
};

type IssuedCode = {
  studentId: string;
  studentName: string;
  code: string;
  expiresAt: string;
};

async function loadAccessContext(
  supabase: SupabaseClient,
): Promise<AccessContext | null> {
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
  if (!profile.default_workspace_id) {
    throw new Error("Choose a school workspace before managing student access.");
  }

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult, studentResult, classResult, accountResult] =
    await Promise.all([
      supabase.from("workspaces").select("name,workspace_type").eq("id", workspaceId).single(),
      supabase
        .from("workspace_members")
        .select("role,status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", session.user.id)
        .single(),
      supabase
        .from("students")
        .select("id,display_name,class_id,active")
        .eq("workspace_id", workspaceId)
        .order("display_name"),
      supabase.from("classes").select("id,name").eq("workspace_id", workspaceId).order("name"),
      supabase
        .from("student_accounts")
        .select("student_id,active")
        .eq("workspace_id", workspaceId),
    ]);

  const firstError =
    workspaceResult.error ??
    membershipResult.error ??
    studentResult.error ??
    classResult.error ??
    accountResult.error;
  if (firstError) throw firstError;

  const workspace = workspaceResult.data;
  const membership = membershipResult.data;
  if (!workspace || !membership) {
    throw new Error("Your active school membership could not be resolved.");
  }

  if (workspace.workspace_type !== "school") {
    throw new Error("Student access is available only inside a school workspace.");
  }
  if (!["owner", "admin"].includes(membership.role)) {
    throw new Error("Only a school owner or admin can issue Student KSI access.");
  }

  return {
    workspaceId,
    workspaceName: workspace.name,
    role: membership.role,
    students: (studentResult.data ?? []) as StudentRow[],
    classes: (classResult.data ?? []) as ClassRow[],
    accounts: (accountResult.data ?? []) as StudentAccountRow[],
  };
}

export function StudentAccessManager() {
  const router = useRouter();
  const [context, setContext] = useState<AccessContext | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadAccessContext(supabase)
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
          setError(caught instanceof Error ? caught.message : "Student access could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const linkedStudentIds = useMemo(
    () => new Set(context?.accounts.filter((item) => item.active).map((item) => item.student_id) ?? []),
    [context?.accounts],
  );
  const classNames = useMemo(
    () => new Map(context?.classes.map((item) => [item.id, item.name]) ?? []),
    [context?.classes],
  );

  async function issueCode(student: StudentRow) {
    setBusyId(student.id);
    setError(null);
    setIssued(null);
    setCopied(false);

    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("issue_student_access_code", {
        target_student_id: student.id,
        ttl_hours: 168,
      });
      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("KSI did not return a Student Access Code.");

      setIssued({
        studentId: student.id,
        studentName: student.display_name,
        code: String(row.access_code),
        expiresAt: String(row.expires_at),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Student Access Code could not be issued.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyCode() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.code);
    setCopied(true);
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Student Access…</p></main>;
  }

  if (error && !context) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div></main>;
  }

  if (!context) return null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm font-semibold text-emerald-900">← Dashboard</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Student Access</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">{context.workspaceName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Issue one-time access codes that connect a learner&apos;s own Google or email account to the correct existing KSI student record.
          </p>
        </div>
        <Link href="/student/join" className="w-fit rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700">
          Learner join page
        </Link>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      {issued ? (
        <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Give this code to {issued.studentName}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="rounded-xl bg-white px-4 py-3 text-xl font-black tracking-[0.1em] text-emerald-950">{issued.code}</code>
            <button type="button" onClick={() => void copyCode()} className="rounded-xl bg-emerald-950 px-4 py-3 text-sm font-bold text-white">
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-emerald-900">
            Expires {new Date(issued.expiresAt).toLocaleString()}. Generating another code for this learner revokes this one. KSI stores only the code hash, so this raw code cannot be retrieved later.
          </p>
        </section>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-5">
          <h2 className="text-lg font-bold text-zinc-950">Learners</h2>
          <p className="mt-1 text-sm text-zinc-500">{linkedStudentIds.size} of {context.students.filter((item) => item.active).length} active learners linked.</p>
        </div>
        <div className="divide-y divide-zinc-100">
          {context.students.map((student) => {
            const linked = linkedStudentIds.has(student.id);
            return (
              <div key={student.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-zinc-950">{student.display_name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${linked ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {linked ? "Linked" : "Not linked"}
                    </span>
                    {!student.active ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500">Inactive</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {student.class_id ? classNames.get(student.class_id) ?? "Assigned class" : "No class assigned"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={linked || !student.active || busyId !== null}
                  onClick={() => void issueCode(student)}
                  className="w-fit rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                >
                  {linked ? "Account linked" : busyId === student.id ? "Generating…" : "Generate access code"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
