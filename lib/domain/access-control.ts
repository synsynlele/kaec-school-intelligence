export const SCHOOL_ACCESS_STATUSES = [
  "active",
  "paused",
  "blocked",
  "disabled",
] as const;

export type SchoolAccessStatus = (typeof SCHOOL_ACCESS_STATUSES)[number];

export const KSI_WORKSPACE_ROLES = [
  "owner",
  "admin",
  "leader",
  "teacher",
  "student",
] as const;

export type KsiWorkspaceRole = (typeof KSI_WORKSPACE_ROLES)[number];

export type SchoolAccessDecision = {
  allowed: boolean;
  status: SchoolAccessStatus;
  reason:
    | "active"
    | "school_paused"
    | "school_blocked"
    | "school_disabled";
};

export function decideSchoolAccess(
  status: SchoolAccessStatus,
): SchoolAccessDecision {
  switch (status) {
    case "active":
      return { allowed: true, status, reason: "active" };
    case "paused":
      return { allowed: false, status, reason: "school_paused" };
    case "blocked":
      return { allowed: false, status, reason: "school_blocked" };
    case "disabled":
      return { allowed: false, status, reason: "school_disabled" };
  }
}

export function isSchoolAccessStatus(
  value: unknown,
): value is SchoolAccessStatus {
  return (
    typeof value === "string" &&
    SCHOOL_ACCESS_STATUSES.includes(value as SchoolAccessStatus)
  );
}

export function isKsiWorkspaceRole(value: unknown): value is KsiWorkspaceRole {
  return (
    typeof value === "string" &&
    KSI_WORKSPACE_ROLES.includes(value as KsiWorkspaceRole)
  );
}
