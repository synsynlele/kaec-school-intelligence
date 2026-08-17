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
  active: "Approved school members can use protected KSI school features.",
  paused: "School membership is preserved, but protected KSI school access is temporarily stopped.",
  blocked: "Protected KSI school access is denied until KAEC explicitly reactivates the school.",
  disabled: "School access is disabled while the school record and learning data remain preserved.",
};

function messageFrom(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (
    caught &&
    typeof caught === "object" &&
    "message" in caught &&
    typeof (caught as { message?: unknown }).message === "string"
  ) {
    return (caught as { message: string }).message;
  }
  return fallback;
}

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
    .select("id,name,slug,access_status,access_status_changed_at,access_status_note")
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
  const [provisioning, setProvisioning] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
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
        if (!cancelled) {
          setError(messageFrom(caught, "School access controls could not be loaded."));
        }
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
          counts[status] = schools.filter((school) => school.access_status === status).length;
          return counts;
        },
        { active: 0, paused: 0, blocked: 0, disabled: 0 },
      ),
    [schools],
  );

  async function provisionSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolName.trim() || !ownerEmail.trim()) return;

    setProvisioning(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("provision_school_workspace", {
        target_owner_email: ownerEmail.trim(),
        target_school_name: schoolName.trim(),
      });
      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      setSchools(await refreshSchoolList());
      setSchoolName("");
      setOwnerEmail("");
      setSuccess(
        `${String(row?.workspace_name ?? "School")} has been provisioned in Paused state. Activate it only when KAEC approves access.`,
      );
    } catch (caught) {
      setError(messageFrom(caught, "The school could not be provisioned."));
    } finally {
      setProvisioning(false);
    }
  }

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
        change_note: typeof note === "string" && note.trim() ? note.trim() : null,
      });
      if (rpcError) throw rpcError;

      setSchools(await refreshSchoolList());
      setSuccess(
        `${school.name} is now ${STATUS_LABEL[nextStatus as SchoolAccessStatus].toLowerCase()}.`,
      );
    } catch (caught) {
      setError(messageFrom(caught, "The school access status could not be updated."));
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-600">Loading school access controls…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl border border-emerald-900/15 bg-emerald-50/60 p-6 shadow-sm sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Controlled onboarding</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Provision a subscribed school</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              The owner must sign in to KSI once first. Provisioning creates the school in <strong>Paused</strong> state; it does not grant live school access until a platform administrator explicitly activates it.
            </p>
          </div>

          <form onSubmit={provisionSchool} className="grid gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-zinc-800">
              School name
              <input
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="e.g. Greenfield Academy"
                required
                className="rounded-xl border border-zinc-300 px-3.5 py-2.5 font-normal outline-none focus:border-emerald-700"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-zinc-800">
              Owner KSI email
              <input
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="owner@school.com"
                required
                className="rounded-xl border border-zinc-300 px-3.5 py-2.5 font-normal outline-none focus:border-emerald-700"
              />
            </label>
            <button
              type="submit"
              disabled={provisioning}
              className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2"
            >
              {provisioning ? "Provisioning…" : "Provision school in Paused state"}
            </button>
          </form>
        </div>
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOOL_ACCESS_STATUSES.map((status) => (
          <article key={status} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{STATUS_LABEL[status]}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-950">{summary[status]}</p>
          </article>
        ))}
      </section>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">{error}</div> : null}
      {success ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">{success}</div> : null}

      <section className="mt-8 space-y-5">
        {schools.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="font-semibold text-zinc-900">No school workspaces found.</p>
          </div>
        ) : (
          schools.map((school) => (
            <article key={school.id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-zinc-950">{school.name}</h2>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700">
                      {STATUS_LABEL[school.access_status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{STATUS_HELP[school.access_status]}</p>
                  {school.access_status_note ? <p className="mt-3 text-sm text-zinc-500">Latest note: {school.access_status_note}</p> : null}
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
                      {SCHOOL_ACCESS_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
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
                    className="self-end rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:opacity-60"
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
