"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LearningSubjectEnrolment } from "@/components/assessment/learning-subject-enrolment";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type NamedRow = { id: string; name: string };
type Teacher = { user_id: string; name: string; role: string };
type Assignment = {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  active: boolean;
};

type TeachingMapPayload = {
  workspace_id: string;
  role: string;
  assignments: Assignment[];
  teachers: Teacher[];
};

type TeachingMapContext = {
  workspaceId: string;
  workspaceName: string;
  classes: (NamedRow & { academic_session: string | null })[];
  subjects: NamedRow[];
  map: TeachingMapPayload;
};

async function loadContext(supabase: SupabaseClient): Promise<TeachingMapContext | null> {
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
    throw new Error("Choose a school workspace before opening the Teaching Map.");
  }

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, classesResult, subjectsResult, mapResult] = await Promise.all([
    supabase.from("workspaces").select("name,workspace_type").eq("id", workspaceId).single(),
    supabase.from("classes").select("id,name,academic_session").eq("workspace_id", workspaceId).eq("active", true).order("name"),
    supabase.from("subjects").select("id,name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
    supabase.rpc("get_teaching_map", { target_workspace_id: workspaceId }),
  ]);

  const firstError = workspaceResult.error ?? classesResult.error ?? subjectsResult.error ?? mapResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data || workspaceResult.data.workspace_type !== "school") {
    throw new Error("The Teaching Map is available only inside a school workspace.");
  }

  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    classes: (classesResult.data ?? []) as TeachingMapContext["classes"],
    subjects: (subjectsResult.data ?? []) as NamedRow[],
    map: mapResult.data as TeachingMapPayload,
  };
}

export function TeachingMapClient({ initialStaffId, initialClassId }: { initialStaffId?: string; initialClassId?: string } = {}) {
  const router = useRouter();
  const [context, setContext] = useState<TeachingMapContext | null>(null);
  const [classId, setClassId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    const next = await loadContext(supabase);
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setContext(next);
    setClassId((current) => current || next.classes[0]?.id || "");
    setTeacherId((current) => current || (!initialStaffId ? next.map.teachers[0]?.user_id : "") || "");
  }

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void loadContext(supabase)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setContext(next);
        setClassId(next.classes.find(item => item.id === initialClassId)?.id ?? next.classes[0]?.id ?? "");
        const staffId = initialStaffId
          ? next.map.teachers.find(({ user_id }) => user_id === initialStaffId)?.user_id
          : next.map.teachers[0]?.user_id;
        setTeacherId(staffId ?? "");
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Teaching Map could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialClassId, initialStaffId, router]);

  const assignedStaff = context?.map.teachers.find(({ user_id }) => user_id === initialStaffId);
  const visibleAssignments = context?.map.assignments.filter(
    (item) => item.class_id === classId && (!initialStaffId || item.teacher_id === initialStaffId)
  ) ?? [];
  const canManage = context ? ["owner", "admin"].includes(context.map.role) : false;
  const activeCount = useMemo(
    () => context?.map.assignments.filter((item) => item.active).length ?? 0,
    [context],
  );

  async function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !classId || !subjectIds.length || !teacherId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("assign_learning_class_subjects", {
        target_workspace_id: context.workspaceId,
        target_class_id: classId,
        target_subject_ids: subjectIds,
        target_teacher_id: teacherId,
      });
      if (rpcError) throw new Error(rpcError.message);
      setNotice(`${subjectIds.length} subject assignment(s) saved for this class.`);
      setSubjectIds([]);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Teaching assignment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAssignment(assignment: Assignment) {
    if (!context) return;
    setBusyAssignmentId(assignment.id);
    setError(null);
    setNotice(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("set_teaching_assignment", {
        target_workspace_id: context.workspaceId,
        target_class_id: assignment.class_id,
        target_subject_id: assignment.subject_id,
        target_teacher_id: assignment.teacher_id,
        target_active: !assignment.active,
      });
      if (rpcError) throw rpcError;
      setNotice(assignment.active ? "Teaching assignment paused." : "Teaching assignment reactivated.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Teaching assignment could not be updated.");
    } finally {
      setBusyAssignmentId(null);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Academic Teaching Map…</p></main>;
  }

  if (error && !context) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div></main>;
  }

  if (!context) return null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="ksi-workspace-banner flex flex-col gap-4 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm font-semibold text-emerald-900">← Dashboard</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Class subjects and enrolment</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">{context.workspaceName}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Choose a class, select the subjects a teacher handles, then enrol learners in the subjects they take.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600">Role: {context.map.role}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{activeCount} active link{activeCount === 1 ? "" : "s"}</span>
        </div>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div> : null}

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <SelectField label="Class" value={classId} onChange={(id) => { setClassId(id); setSubjectIds([]); setNotice(null); }}
          options={context.classes.map(item => ({ value: item.id, label: item.name }))} />
        <Link href="/assessment/class-results" className="font-semibold text-emerald-900 underline">Class scores and results</Link>
        <Link href="#subject-enrolment" className="font-semibold text-emerald-900 underline">Learner subject enrolment</Link>
      </div>
      {canManage && (!initialStaffId || assignedStaff) ? (
        <form onSubmit={addAssignment} className={`mt-8 grid gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:items-end ${assignedStaff ? "lg:grid-cols-[1fr_1fr_auto]" : "lg:grid-cols-[1fr_1fr_1fr_auto]"}`}>
          <fieldset disabled={saving} className="max-h-60 space-y-2 overflow-y-auto">
            <legend className="font-semibold">Subjects to assign</legend>
            {context.subjects.map(item => <label key={item.id} className="flex items-center gap-2">
              <input type="checkbox" checked={subjectIds.includes(item.id)} onChange={() => setSubjectIds(current =>
                current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} />
              {item.name}
            </label>)}
          </fieldset>
          {!assignedStaff && <SelectField label="Teacher" value={teacherId} onChange={setTeacherId} options={context.map.teachers.map((item) => ({ value: item.user_id, label: `${item.name} · ${item.role}` }))} />}
          <button
            type="submit"
            disabled={saving || !classId || !subjectIds.length || !teacherId}
            className="rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : assignedStaff ? `Assign ${assignedStaff.name}` : "Assign selected subjects"}
          </button>
        </form>
      ) : (
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 text-sm leading-6 text-zinc-600">
          {canManage ? "This staff member is unavailable for assignment." : "This map is read-only for your role. School owners/admins manage teaching assignments."}
        </div>
      )}

      {["owner", "admin", "leader"].includes(context.map.role) && classId && (
        <section id="subject-enrolment" className="mt-6 scroll-mt-8">
          <LearningSubjectEnrolment key={classId} schoolId={context.workspaceId}
            classes={context.classes.filter(item => item.id === classId)} defaultOpen />
        </section>
      )}
      {initialStaffId && <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/setup/staff-access" className="font-semibold text-emerald-900 underline">Back to Staff</Link>
        <Link href="/setup/teaching-map" className="font-semibold text-emerald-900 underline">View all assignments</Link>
      </div>}
      <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-5">
          <h2 className="text-lg font-bold text-zinc-950">{assignedStaff ? `Teaching assignments for ${assignedStaff.name}` : "Teaching assignments"}</h2>
          <p className="mt-1 text-sm text-zinc-500">Every active row is an approved instructional path for lesson delivery.</p>
        </div>
        {visibleAssignments.length === 0 ? (
          <div className="p-8 text-sm text-zinc-600">{initialStaffId ? "No teaching assignments for this staff member." : "No teaching assignments exist yet."}</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {visibleAssignments.map((assignment) => (
              <div key={assignment.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-zinc-950">{assignment.teacher_name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${assignment.active ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-500"}`}>
                      {assignment.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">{assignment.class_name} → {assignment.subject_name}</p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busyAssignmentId !== null}
                    onClick={() => void toggleAssignment(assignment)}
                    className="w-fit rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 disabled:opacity-50"
                  >
                    {busyAssignmentId === assignment.id ? "Updating…" : assignment.active ? "Pause link" : "Reactivate link"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700"
      >
        {options.length === 0 ? <option value="">No options available</option> : options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
