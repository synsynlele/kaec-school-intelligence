"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deriveInterventionDraft,
  type FinalDiagnosisSource,
  type InterventionAction,
  type InterventionDraft,
} from "@/lib/intervention/plan";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type Workspace = { id: string; name: string };
type Student = { id: string; display_name: string; class_id: string | null };
type SchoolClass = { id: string; name: string };

type DiagnosisRow = FinalDiagnosisSource & {
  id: string;
  workspace_id: string;
  student_id: string;
  status: string;
  academic_session: string;
  term: string;
  finalised_at: string | null;
};

type HandoffRow = {
  id: string;
  workspace_id: string;
  diagnosis_id: string;
  student_id: string;
  status: "draft" | "confirmed";
  priority_growth_target: string;
  evidence_basis: string;
  school_intervention: unknown;
  parent_intervention: unknown;
  timeframe: string;
  success_indicator: string;
  review_date: string | null;
  next_learning_adjustment: string;
  confirmed_at: string | null;
  next_lesson_id: string | null;
  updated_at: string;
};

type WorkspaceState = {
  workspace: Workspace;
  students: Student[];
  classes: SchoolClass[];
  diagnoses: DiagnosisRow[];
  handoffs: HandoffRow[];
};

type EditorState = InterventionDraft & {
  id: string;
  diagnosisId: string;
  studentId: string;
  status: "draft" | "confirmed";
  confirmedAt: string | null;
  nextLessonId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseActions(value: unknown): InterventionAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const domain =
        item.domain === "skill" || item.domain === "character"
          ? item.domain
          : "academic";
      const action = typeof item.action === "string" ? item.action.trim() : "";
      if (!action) return null;
      return {
        domain,
        action,
        timeframe:
          typeof item.timeframe === "string" ? item.timeframe.trim() : "",
        evidenceIds: Array.isArray(item.evidenceIds)
          ? item.evidenceIds.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
      } satisfies InterventionAction;
    })
    .filter((item): item is InterventionAction => Boolean(item));
}

function editorFromRow(row: HandoffRow): EditorState {
  return {
    id: row.id,
    diagnosisId: row.diagnosis_id,
    studentId: row.student_id,
    status: row.status,
    priorityGrowthTarget: row.priority_growth_target,
    evidenceBasis: row.evidence_basis,
    schoolIntervention: parseActions(row.school_intervention),
    parentIntervention: parseActions(row.parent_intervention),
    timeframe: row.timeframe,
    successIndicator: row.success_indicator,
    reviewDate: row.review_date ?? "",
    nextLearningAdjustment: row.next_learning_adjustment,
    confirmedAt: row.confirmed_at,
    nextLessonId: row.next_lesson_id,
  };
}

function dateLabel(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

async function loadWorkspace(): Promise<WorkspaceState | null> {
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
  const workspaceId = profile?.default_workspace_id as string | null | undefined;
  if (!workspaceId) {
    throw new Error("Choose an active workspace before using interventions.");
  }

  const [workspaceResult, studentResult, classResult, diagnosisResult, handoffResult] =
    await Promise.all([
      supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
      supabase
        .from("students")
        .select("id,display_name,class_id")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("display_name"),
      supabase
        .from("classes")
        .select("id,name")
        .eq("workspace_id", workspaceId)
        .order("name"),
      supabase
        .from("diagnoses")
        .select(
          "id,workspace_id,student_id,status,academic_session,term,finalised_at,concise_diagnosis,academic_strengths,academic_challenges,character_strengths,character_challenges,school_academic_actions,parent_academic_actions,school_character_actions,parent_character_actions,builder_growth_direction",
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "final")
        .order("finalised_at", { ascending: false }),
      supabase
        .from("intervention_handoffs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }),
    ]);

  const firstError =
    workspaceResult.error ??
    studentResult.error ??
    classResult.error ??
    diagnosisResult.error ??
    handoffResult.error;
  if (firstError) throw firstError;
  if (!workspaceResult.data) throw new Error("The active workspace could not be loaded.");

  return {
    workspace: workspaceResult.data as Workspace,
    students: (studentResult.data ?? []) as Student[],
    classes: (classResult.data ?? []) as SchoolClass[],
    diagnoses: (diagnosisResult.data ?? []) as DiagnosisRow[],
    handoffs: (handoffResult.data ?? []) as HandoffRow[],
  };
}

export function InterventionClient() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [active, setActive] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await loadWorkspace();
    setState(next);
    if (next && active) {
      const refreshed = next.handoffs.find((item) => item.id === active.id);
      if (refreshed) setActive(editorFromRow(refreshed));
    }
    return next;
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspace()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Intervention workspace could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handoffByDiagnosis = useMemo(
    () => new Map(state?.handoffs.map((item) => [item.diagnosis_id, item]) ?? []),
    [state?.handoffs],
  );

  function studentName(studentId: string) {
    return state?.students.find((student) => student.id === studentId)?.display_name ?? "Student";
  }

  function className(studentId: string) {
    const student = state?.students.find((item) => item.id === studentId);
    if (!student?.class_id) return "Class not linked";
    return state?.classes.find((item) => item.id === student.class_id)?.name ?? "Class not linked";
  }

  async function createHandoff(diagnosis: DiagnosisRow) {
    if (!state) return;
    setBusy(`create:${diagnosis.id}`);
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Sign in again.");

      const draft = deriveInterventionDraft(diagnosis);
      const { data, error: insertError } = await supabase
        .from("intervention_handoffs")
        .insert({
          workspace_id: diagnosis.workspace_id,
          diagnosis_id: diagnosis.id,
          student_id: diagnosis.student_id,
          created_by: user.id,
          status: "draft",
          priority_growth_target: draft.priorityGrowthTarget,
          evidence_basis: draft.evidenceBasis,
          school_intervention: draft.schoolIntervention as unknown as Json,
          parent_intervention: draft.parentIntervention as unknown as Json,
          timeframe: draft.timeframe,
          success_indicator: draft.successIndicator,
          review_date: draft.reviewDate,
          next_learning_adjustment: draft.nextLearningAdjustment,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;

      const row = data as HandoffRow;
      setActive(editorFromRow(row));
      await refresh();
      setNotice(
        "Intervention draft created from the final diagnosis. Review the practical plan before confirming the handoff.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The intervention draft could not be created.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function save(confirm = false) {
    if (!active) return;
    setBusy(confirm ? "confirm" : "save");
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error: updateError } = await supabase
        .from("intervention_handoffs")
        .update({
          priority_growth_target: active.priorityGrowthTarget.trim(),
          evidence_basis: active.evidenceBasis.trim(),
          school_intervention: active.schoolIntervention as unknown as Json,
          parent_intervention: active.parentIntervention as unknown as Json,
          timeframe: active.timeframe.trim(),
          success_indicator: active.successIndicator.trim(),
          review_date: active.reviewDate || null,
          next_learning_adjustment: active.nextLearningAdjustment.trim(),
          ...(confirm ? { status: "confirmed" } : {}),
        })
        .eq("id", active.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      const row = data as HandoffRow;
      setActive(editorFromRow(row));
      await refresh();
      setNotice(
        confirm
          ? "Intervention confirmed. It is now locked and ready to guide the next HQLS lesson."
          : "Intervention changes saved.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : confirm
            ? "The intervention could not be confirmed."
            : "The intervention changes could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  function updateAction(
    owner: "schoolIntervention" | "parentIntervention",
    index: number,
    patch: Partial<InterventionAction>,
  ) {
    setActive((current) => {
      if (!current || current.status === "confirmed") return current;
      return {
        ...current,
        [owner]: current[owner].map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        ),
      };
    });
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-7xl items-center justify-center px-5">
        <p className="text-sm font-medium text-zinc-500">Loading intervention handoffs...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
      <div className="grid gap-7 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Governed improvement handoff
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Action & Intervention
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Turn an approved diagnosis into one practical improvement plan, confirm it with human judgement, then carry the agreed adjustment into the next HQLS lesson.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Final diagnoses</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Only approved final diagnoses can enter the intervention loop.
            </p>
            <div className="mt-4 grid gap-3">
              {state?.diagnoses.length ? (
                state.diagnoses.map((diagnosis) => {
                  const handoff = handoffByDiagnosis.get(diagnosis.id);
                  return (
                    <div key={diagnosis.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-900">{studentName(diagnosis.student_id)}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {className(diagnosis.student_id)} · {diagnosis.academic_session || "Session not set"} · {diagnosis.term || "Term not set"}
                          </p>
                        </div>
                        {handoff ? (
                          <button
                            type="button"
                            onClick={() => setActive(editorFromRow(handoff))}
                            className="rounded-xl border border-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50"
                          >
                            Open {handoff.status === "confirmed" ? "Confirmed Plan" : "Draft"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void createHandoff(diagnosis)}
                            className="rounded-xl bg-emerald-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {busy === `create:${diagnosis.id}` ? "Creating..." : "Create Intervention"}
                          </button>
                        )}
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">
                        {diagnosis.concise_diagnosis}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                  No final diagnosis is available yet. Complete diagnosis review and approval first.
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          {active ? (
            <InterventionEditor
              active={active}
              diagnosis={state?.diagnoses.find((item) => item.id === active.diagnosisId) ?? null}
              studentName={studentName(active.studentId)}
              className={className(active.studentId)}
              busy={busy}
              onChange={setActive}
              onActionChange={updateAction}
              onSave={() => void save(false)}
              onConfirm={() => void save(true)}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-zinc-800">Choose a final diagnosis</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                KSI will carry forward the approved growth direction and action plan without re-diagnosing the learner.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InterventionEditor({
  active,
  diagnosis,
  studentName,
  className,
  busy,
  onChange,
  onActionChange,
  onSave,
  onConfirm,
}: {
  active: EditorState;
  diagnosis: DiagnosisRow | null;
  studentName: string;
  className: string;
  busy: string | null;
  onChange: (next: EditorState) => void;
  onActionChange: (
    owner: "schoolIntervention" | "parentIntervention",
    index: number,
    patch: Partial<InterventionAction>,
  ) => void;
  onSave: () => void;
  onConfirm: () => void;
}) {
  const readOnly = active.status === "confirmed";
  const inputClass =
    "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm leading-6 text-zinc-900 read-only:bg-stone-50 read-only:text-zinc-700";

  return (
    <div className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            {active.status === "confirmed" ? "Confirmed intervention" : "Intervention draft"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{studentName}</h2>
          <p className="mt-1 text-sm text-zinc-500">{className}</p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-900">
          {active.status}
        </span>
      </div>

      {diagnosis ? (
        <div className="mt-5 rounded-2xl border border-[#ddd4b7] bg-[#f8f4e8] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-950">Approved diagnosis baseline</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{diagnosis.concise_diagnosis}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5">
        <Field label="Priority Growth Target">
          <textarea
            readOnly={readOnly}
            value={active.priorityGrowthTarget}
            onChange={(event) => onChange({ ...active, priorityGrowthTarget: event.target.value })}
            className={`${inputClass} min-h-24`}
          />
        </Field>

        <Field label="Evidence Basis">
          <textarea
            readOnly={readOnly}
            value={active.evidenceBasis}
            onChange={(event) => onChange({ ...active, evidenceBasis: event.target.value })}
            className={`${inputClass} min-h-28`}
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-2">
          <ActionList
            title="School Intervention"
            items={active.schoolIntervention}
            readOnly={readOnly}
            onChange={(index, patch) => onActionChange("schoolIntervention", index, patch)}
          />
          <ActionList
            title="Parent Intervention"
            items={active.parentIntervention}
            readOnly={readOnly}
            onChange={(index, patch) => onActionChange("parentIntervention", index, patch)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Overall Timeframe">
            <input
              readOnly={readOnly}
              value={active.timeframe}
              onChange={(event) => onChange({ ...active, timeframe: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Review Date / Checkpoint">
            <input
              readOnly={readOnly}
              type="date"
              value={active.reviewDate}
              onChange={(event) => onChange({ ...active, reviewDate: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Success Indicator">
          <textarea
            readOnly={readOnly}
            value={active.successIndicator}
            onChange={(event) => onChange({ ...active, successIndicator: event.target.value })}
            className={`${inputClass} min-h-28`}
          />
        </Field>

        <Field label="Next Learning Adjustment">
          <textarea
            readOnly={readOnly}
            value={active.nextLearningAdjustment}
            onChange={(event) => onChange({ ...active, nextLearningAdjustment: event.target.value })}
            className={`${inputClass} min-h-32`}
          />
        </Field>
      </div>

      {active.status === "draft" ? (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-200 pt-5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={onSave}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
          >
            {busy === "save" ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onConfirm}
            className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "confirm" ? "Confirming..." : "Confirm Intervention"}
          </button>
          <p className="basis-full text-xs leading-5 text-zinc-500">
            Confirmation locks this handoff. If the evidence changes later, start a new diagnosis cycle rather than rewriting an approved intervention.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-950">
            {active.nextLessonId ? "Next HQLS lesson linked" : "Ready for the next HQLS lesson"}
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-900/80">
            Confirmed {dateLabel(active.confirmedAt)}. KSI will carry this locked handoff into the existing HQLS engine without exposing or singling out the learner inside the class lesson.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {active.nextLessonId ? (
              <Link
                href={`/hqls?lesson=${encodeURIComponent(active.nextLessonId)}`}
                className="rounded-xl bg-emerald-950 px-4 py-2.5 text-xs font-semibold text-white"
              >
                Open Linked HQLS Lesson
              </Link>
            ) : (
              <Link
                href="/interventions/next-lesson"
                className="rounded-xl bg-emerald-950 px-4 py-2.5 text-xs font-semibold text-white"
              >
                Build Next HQLS Lesson
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      {children}
    </label>
  );
}

function ActionList({
  title,
  items,
  readOnly,
  onChange,
}: {
  title: string;
  items: InterventionAction[];
  readOnly: boolean;
  onChange: (index: number, patch: Partial<InterventionAction>) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-950/15">
      <div className="bg-emerald-950 px-4 py-2.5 text-center text-sm font-semibold text-white">{title}</div>
      <div className="grid gap-3 p-4">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${item.domain}-${index}`} className="rounded-xl border border-zinc-200 bg-stone-50 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">{item.domain}</span>
              <textarea
                readOnly={readOnly}
                value={item.action}
                onChange={(event) => onChange(index, { action: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm leading-6 text-zinc-900 read-only:bg-stone-50"
              />
              <input
                readOnly={readOnly}
                value={item.timeframe}
                onChange={(event) => onChange(index, { timeframe: event.target.value })}
                placeholder="Action timeframe"
                className="mt-2 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 read-only:bg-stone-50"
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No intervention was carried forward from the final diagnosis.</p>
        )}
      </div>
    </div>
  );
}
