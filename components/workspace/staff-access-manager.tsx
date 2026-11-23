"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Invite = {
  invite_id: string;
  invited_email: string;
  invited_role: "admin" | "leader" | "teacher";
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
};

type StaffMember = { user_id: string; display_name: string; role: string; status: string };

type Context = {
  workspaceId: string;
  workspaceName: string;
  invites: Invite[];
  staff: StaffMember[] | null;
  viewerId: string;
  viewerRole: string;
};

type Issued = {
  code: string;
  email: string;
  role: string;
  expiresAt: string;
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

async function loadContext(supabase: SupabaseClient): Promise<Context | null> {
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
  if (!profile.default_workspace_id) throw new Error("Choose an active school workspace first.");

  const workspaceId = profile.default_workspace_id;
  const [workspaceResult, membershipResult, inviteResult] = await Promise.all([
    supabase.from("workspaces").select("name,workspace_type").eq("id", workspaceId).single(),
    supabase
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", session.user.id)
      .single(),
    supabase.rpc("get_staff_access_invites", { target_workspace_id: workspaceId }),
  ]);

  const firstError = workspaceResult.error ?? membershipResult.error ?? inviteResult.error;
  if (firstError) throw firstError;
  if (workspaceResult.data?.workspace_type !== "school") throw new Error("Staff Access is available only inside a school workspace.");
  if (!["owner", "admin"].includes(membershipResult.data?.role ?? "")) throw new Error("Only a school owner or admin can manage Staff Access.");

  const staffResult = await supabase.rpc("get_school_staff_directory", { school_id: workspaceId });
  if (staffResult.error && staffResult.error.code !== "PGRST202") throw staffResult.error;

  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    viewerId: session.user.id,
    viewerRole: membershipResult.data?.role ?? "",
    invites: (inviteResult.data ?? []) as Invite[],
    staff: staffResult.error ? null : (staffResult.data ?? []) as StaffMember[],
  };
}

export function StaffAccessManager() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "leader" | "admin">("teacher");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function changeStaffStatus(member: StaffMember) {
    if (!context || busyStaffId) return;
    const suspend = member.status === "active";
    if (!window.confirm(`${suspend ? "Suspend" : "Restore"} school access for ${member.display_name}?`)) return;

    setBusyStaffId(member.user_id);
    setError(null);
    setNotice("");
    try {
      const { error } = await getBrowserSupabaseClient().rpc("set_school_staff_status", {
        school_id: context.workspaceId,
        staff_id: member.user_id,
        expected_status: member.status,
        new_status: suspend ? "suspended" : "active",
      });
      if (error) throw error;
      await refresh();
      setNotice(suspend ? "Staff access suspended." : "Staff access restored.");
    } catch (caught) {
      setError(messageFrom(caught, "Staff access could not be changed."));
    } finally {
      setBusyStaffId(null);
    }
  }

  async function refresh() {
    const next = await loadContext(getBrowserSupabaseClient());
    if (!next) {
      router.replace("/sign-in");
      return;
    }
    setContext(next);
  }

  useEffect(() => {
    let cancelled = false;
    void loadContext(getBrowserSupabaseClient())
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          router.replace("/sign-in");
          return;
        }
        setContext(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(messageFrom(caught, "Staff Access could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;
    setBusy(true);
    setError(null);
    setIssued(null);
    setCopied(false);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("issue_staff_access_code", {
        target_workspace_id: context.workspaceId,
        target_email: email.trim(),
        target_role: role,
        ttl_hours: 168,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("KSI did not return a Staff Access Code.");
      setIssued({
        code: String(row.access_code),
        email: String(row.invited_email),
        role: String(row.invited_role),
        expiresAt: String(row.expires_at),
      });
      setEmail("");
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught, "Staff Access Code could not be issued."));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    setBusyInviteId(inviteId);
    setError(null);
    try {
      const supabase: SupabaseClient = getBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("revoke_staff_access_invite", {
        target_invite_id: inviteId,
      });
      if (rpcError) throw rpcError;
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught, "Staff Access Code could not be revoked."));
    } finally {
      setBusyInviteId(null);
    }
  }

  async function copyCode() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.code);
    setCopied(true);
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm font-semibold text-zinc-600">Loading Staff Access…</p></main>;
  }

  if (!context) {
    return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Staff Access could not be loaded."}</div></main>;
  }

  const staffQuery = staffSearch.trim().toLowerCase();
  const visibleStaff = context.staff?.filter((member) =>
    [member.display_name, member.role, member.status].some((value) => value.toLowerCase().includes(staffQuery))
  );
  const inviteQuery = inviteSearch.trim().toLowerCase();
  const visibleInvites = context.invites.filter((invite) =>
    invite.invited_email.toLowerCase().includes(inviteQuery) || invite.invited_role.includes(inviteQuery)
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="ksi-workspace-banner flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <Link href="/dashboard" className="text-sm font-semibold text-emerald-900">← Dashboard</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Staff Access</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">{context.workspaceName}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Invite teachers and authorised staff with a one-time code bound to their exact email. Choosing a role on the public sign-in page never creates membership by itself.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/teacher/join" className="w-fit rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700">Teacher join page</Link>
        </div>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      {issued ? (
        <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Give this code only to {issued.email}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="rounded-xl bg-white px-4 py-3 text-lg font-black tracking-[0.08em] text-emerald-950">{issued.code}</code>
            <button type="button" onClick={() => void copyCode()} className="rounded-xl bg-emerald-950 px-4 py-3 text-sm font-bold text-white">{copied ? "Copied" : "Copy code"}</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-emerald-900">Role: {issued.role}. Expires {new Date(issued.expiresAt).toLocaleString()}. KSI stores only the code hash after issuance.</p>
        </section>
      ) : null}

      {notice && <p role="status" className="mt-4 text-sm text-emerald-900">{notice}</p>}

      <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-zinc-950">School staff</h2>
          <Link href="/setup/teaching-map" className="py-2 text-sm font-semibold text-emerald-900 underline">Manage teaching assignments</Link>
        </div>
        {visibleStaff ? <>
          <label className="my-4 block text-sm font-semibold">Search staff
            <input type="search" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)}
              placeholder="Name, role or status" className="mt-1 block w-full rounded-lg border border-zinc-300 p-2 font-normal" />
          </label>
          {visibleStaff.length === 0 && <p className="text-sm text-zinc-600">No matching staff records.</p>}
          <ul className="divide-y divide-zinc-100">
            {visibleStaff.map((member) => {
              const canAssign = member.status === "active" && ["owner", "admin", "teacher"].includes(member.role);
              const canChangeAccess = ["active", "suspended"].includes(member.status)
                && member.user_id !== context.viewerId && member.role !== "owner"
                && (member.role !== "admin" || context.viewerRole === "owner");
              return (
                <li key={member.user_id} className="py-3">
                  <p className="font-semibold">{member.display_name}</p>
                  <p className="text-sm capitalize text-zinc-600">{member.role} · {member.status}</p>
                  {(canAssign || canChangeAccess) &&
                    <details className="mt-1 text-sm">
                      <summary className="w-fit cursor-pointer py-2 font-semibold text-emerald-900">Staff actions</summary>
                      <div className="flex flex-wrap gap-x-4">
                        {canAssign &&
                          <Link href={`/setup/teaching-map?staff=${encodeURIComponent(member.user_id)}`}
                            className="py-2 font-semibold text-emerald-900 underline">Teaching assignments</Link>}
                        {canChangeAccess &&
                          <button type="button" disabled={Boolean(busyStaffId)} onClick={() => void changeStaffStatus(member)}
                            className="py-2 font-semibold text-zinc-800 underline disabled:opacity-50">
                            {busyStaffId === member.user_id ? "Updating…" : member.status === "active" ? "Suspend access" : "Restore access"}
                          </button>}
                      </div>
                    </details>}
                </li>
              );
            })}
          </ul>
        </> : <p className="mt-3 text-sm text-zinc-600">The staff directory is unavailable until the school database is updated.</p>}
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-5">
          <h2 className="text-lg font-bold text-zinc-950">Recent staff invitations</h2>
          <p className="mt-1 text-xs text-zinc-500">Unused codes are still subject to their displayed expiry time; KSI validates expiry again at redemption.</p>
        </div>
        <label className="block px-6 py-4 text-sm font-semibold">Search invitations
          <input type="search" value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)}
            placeholder="Staff email or role" className="mt-1 block w-full rounded-lg border border-zinc-300 p-2 font-normal" />
        </label>
        {visibleInvites.length === 0 ? (
          <div className="px-6 py-8 text-sm text-zinc-500">{context.invites.length ? "No invitations match your search." : "No staff access invitations yet."}</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {visibleInvites.map((invite) => {
              const unused = !invite.redeemed_at && !invite.revoked_at;
              const status = invite.redeemed_at ? "Redeemed" : invite.revoked_at ? "Revoked" : "Unused";
              return (
                <div key={invite.invite_id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-zinc-950">{invite.invited_email}</p>
                    <p className="mt-1 text-sm text-zinc-500">{invite.invited_role} · {status} · expires {new Date(invite.expires_at).toLocaleString()}</p>
                  </div>
                  {unused ? (
                    <button type="button" disabled={busyInviteId !== null} onClick={() => void revoke(invite.invite_id)} className="w-fit rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-60">{busyInviteId === invite.invite_id ? "Revoking…" : "Revoke"}</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <details className="mt-7 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
        <summary className="cursor-pointer font-semibold text-emerald-900">Invite staff</summary>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Use the staff member&apos;s real sign-in email. The code expires after seven days and a new code for the same email revokes the previous unused code.</p>
        <form onSubmit={issue} className="mt-5 grid gap-4 sm:grid-cols-[1fr_190px_auto] sm:items-end">
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Staff email</span>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-emerald-700" placeholder="teacher@school.com" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as "teacher" | "leader" | "admin")} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-emerald-700">
              <option value="teacher">Teacher</option>
              <option value="leader">Leader</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Issuing…" : "Issue code"}</button>
        </form>
      </details>

    </main>
  );
}
