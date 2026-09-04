"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type KsiSchoolRole = "owner" | "admin" | "leader" | "teacher" | "student";

export type KsiSchoolMembership = {
  workspace_id: string;
  workspace_name: string;
  access_status: "active" | "paused" | "blocked" | "disabled" | string;
  member_role: KsiSchoolRole | string;
  member_status: string;
};

export type KsiRuntimeAccess = {
  user: User;
  displayName: string;
  email: string;
  defaultWorkspaceId: string | null;
  memberships: KsiSchoolMembership[];
  activeSchool: KsiSchoolMembership | null;
  inactiveSchool: KsiSchoolMembership | null;
};

const OPERATIONAL_ROLES = new Set(["owner", "admin", "leader", "teacher"]);
const ROLE_PRIORITY: Record<string, number> = {
  owner: 1,
  admin: 2,
  leader: 3,
  teacher: 4,
};
const CACHE_MS = 4_000;

let cached:
  | {
      sessionKey: string;
      expiresAt: number;
      promise: Promise<KsiRuntimeAccess | null>;
    }
  | null = null;

function isOperational(membership: KsiSchoolMembership) {
  return (
    OPERATIONAL_ROLES.has(membership.member_role) &&
    membership.member_status === "active" &&
    membership.access_status === "active"
  );
}

function chooseActiveSchool(
  memberships: KsiSchoolMembership[],
  defaultWorkspaceId: string | null,
) {
  const active = memberships.filter(isOperational);
  if (!active.length) return null;

  const preferred = defaultWorkspaceId
    ? active.find((membership) => membership.workspace_id === defaultWorkspaceId)
    : null;
  if (preferred) return preferred;

  return [...active].sort((left, right) => {
    const roleDifference =
      (ROLE_PRIORITY[left.member_role] ?? 99) - (ROLE_PRIORITY[right.member_role] ?? 99);
    if (roleDifference !== 0) return roleDifference;
    return left.workspace_name.localeCompare(right.workspace_name);
  })[0];
}

export function invalidateKsiRuntimeAccess() {
  cached = null;
}

export function announceKsiWorkspaceChange() {
  invalidateKsiRuntimeAccess();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ksi-workspace-change"));
  }
}

async function sessionCacheKey(supabase: SupabaseClient) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return "signed-out";

  return `${session.user.id}:${session.access_token.slice(-24)}`;
}

async function loadRuntimeAccess(supabase: SupabaseClient): Promise<KsiRuntimeAccess | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,email,default_workspace_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("get_my_school_memberships"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (!profileResult.data) {
    throw new Error("KSI could not load the account profile. Retry the access check.");
  }

  const memberships = (membershipResult.data ?? []) as KsiSchoolMembership[];
  let defaultWorkspaceId = profileResult.data.default_workspace_id ?? null;
  const activeSchool = chooseActiveSchool(memberships, defaultWorkspaceId);

  if (activeSchool && activeSchool.workspace_id !== defaultWorkspaceId) {
    const { error: defaultError } = await supabase
      .from("profiles")
      .update({ default_workspace_id: activeSchool.workspace_id })
      .eq("id", user.id);
    if (defaultError) throw defaultError;
    defaultWorkspaceId = activeSchool.workspace_id;
  }

  const inactiveSchool =
    memberships.find(
      (membership) =>
        OPERATIONAL_ROLES.has(membership.member_role) && !isOperational(membership),
    ) ?? null;

  return {
    user,
    displayName: profileResult.data.display_name || "KSI User",
    email: profileResult.data.email || user.email || "",
    defaultWorkspaceId,
    memberships,
    activeSchool,
    inactiveSchool,
  };
}

export async function resolveKsiRuntimeAccess(
  supabase: SupabaseClient,
  options: { force?: boolean } = {},
) {
  const sessionKey = await sessionCacheKey(supabase);
  if (sessionKey === "signed-out") {
    cached = null;
    return null;
  }

  const now = Date.now();
  if (
    !options.force &&
    cached &&
    cached.sessionKey === sessionKey &&
    cached.expiresAt > now
  ) {
    return cached.promise;
  }

  const promise = loadRuntimeAccess(supabase).catch((error) => {
    if (cached?.sessionKey === sessionKey) cached = null;
    throw error;
  });
  cached = { sessionKey, expiresAt: now + CACHE_MS, promise };
  return promise;
}
