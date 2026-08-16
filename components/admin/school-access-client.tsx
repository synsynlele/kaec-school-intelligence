"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  SCHOOL_ACCESS_STATUSES,
  type SchoolAccessStatus,
} from "@/lib/domain/access-control";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SchoolWorkspace = {
  id: string;
  name: string;
  slug: string | null;
  access_status: SchoolAccessStatus;
  access_status_changed_at: string | null;
  access_status_note: string | null;
};

type AdminState = {
  user: User;
  schools: SchoolWorkspace[];
};

const STATUS_LABEL: Record<SchoolAccessStatus, string> = {
  active: "Active",
  paused: "Paused",
  blocked: "Blocked",
  disabled: "Disabled",
};

const STATUS_HELP: Record<SchoolAccessStatus, string> = {
  active: "Normal KSI access is available to approved school members.",
  paused:
    "Temporarily stops normal protected KSI access while preserving data.",
  blocked:
    "Denies normal protected KSI access until KAEC reactivates the school.",
  disabled:
    "Deactivates normal protected KSI access while retaining the school record.",
};

async function fetchAdminState(
  supabase: SupabaseClient,
): Promise<AdminState | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { data: adminRow, error: adminError } = await supabase
    .from("platform_access_admins")
    .select("user_id,active")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (adminError) throw adminError;
  if (!adminRow?.active) {
    throw new Error("You do not have KAEC platform access-control permission.");
  }

  const { data: schools, error: schoolError } = await supabase
    .from("workspaces")
    .select(
      "id,name,slug,access_status,access_status_changed_at,access_status_note",
    )
    .eq("workspace_type", "school")
    .order("name", { ascending: true });

  if (schoolError) throw schoolError;

  return {
    user: session.user,
    schools: (schools ?? []) as SchoolWorkspace[],
  };
}

async function refreshSchoolList(): Promise<SchoolWorkspace[]> {
  const supabase: SupabaseClient = getBrowserSupabaseClient();
  const state = await fetchAdminState(supabase);
  return state?.schools ?? [];
}

export function SchoolAccessClient() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();

    void fetchAdminState(supabase)
      .then((state) => {
        if (cancelled) return;
        if (!state) {
          router.replace("/sign-in");
          return;
        }
        setSchools(state.schools);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "School access controls could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const summary = useMemo(
    () =>
      SCHOOL_ACCESS_STATUSES.reduce<Record<SchoolAccessStatus, number>>(
        (counts, status) => {
          counts[status] = schools.filter(
            (school) => school.access_status === status,
          ).length;
          return counts;
        },
        { active: 0, paused: 0, blocked: 0, disabled: 0 },
      ),
    [schools],
  );

  async function updateSchoolAccess(
    event: FormEvent<HTMLFormElement>,
    school: SchoolWorkspace,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextStatus = form.get("status");
    const note = form.get("note");

    if (
      typeof nextStatus !== "string" ||
      !SCHOOL_ACCESS_STATUSES.includes(nextStatus as SchoolAccessStatus)
    ) {
      setError("Choose a valid school access status.");
      return;
    }

    setUpdatingId(school.id);
    setError(null);
    setSuccess(null);

    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("set_school_access_status", {
        target_workspace_id: school.id,
        target_status: nextStatus,
        change_note:
          typeof note === "string" && note.trim() ? note.trim() : null,
      });

      if (rpcError) throw rpcError;

      setSchools(await refreshSchoolList());
      setSuccess(
        `${school.name} is now ${STATUS_LABEL[
          nextStatus as SchoolAccessStatus
        ].toLowerCase()}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The school access status could not be updated.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-600">
            Loading school access controls…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOOL_ACCESS_STATUSES.map((status) => (
          <article
            key={status}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {STATUS_LABEL[status]}
            </p>
            <p className="mt-2 text-3xl font-bold text-zinc-950">
              {summary[status]}
            </p>
          </article>
        ))}
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">
          {success}
        </div>
      ) : null}

      <section className="mt-8 space-y-5">
        {schools.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="font-semibold text-zinc-900">
              No school workspaces found.
            </p>
          </div>
        ) : (
          schools.map((school) => (
            <article
              key={school.id}
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-zinc-950">
                      {school.name}
                    </h2>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700">
                      {STATUS_LABEL[school.access_status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {STATUS_HELP[school.access_status]}
                  </p>
                  {school.access_status_note ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      Latest note: {school.access_status_note}
                    </p>
                  ) : null}
                </div>

                <form
                  onSubmit={(event) => updateSchoolAccess(event, school)}
                  className="grid w-full gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:max-w-xl lg:grid-cols-[160px_1fr_auto]"
                >
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    Access
                    <select
                      name="status"
                      defaultValue={school.access_status}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-zinc-900 outline-none focus:border-emerald-700"
                    >
                      {SCHOOL_ACCESS_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    Admin note
                    <input
                      name="note"
                      placeholder="e.g. Payment outstanding"
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-700"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={updatingId === school.id}
                    className="self-end rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingId === school.id ? "Updating…" : "Update"}
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
