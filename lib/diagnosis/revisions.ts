/**
 * Only an approved, active report may be used as the immutable source for a
 * correction draft. Its author or a school owner/admin may initiate a revision.
 */
export type RevisionSource = {
  id: string;
  workspace_id: string;
  created_by: string;
  status: string;
  reviewed_at: string | null;
  finalised_at: string | null;
};

export function isApprovedRevisionSource(source: RevisionSource): source is RevisionSource & { status: "final"; reviewed_at: string; finalised_at: string } {
  return source.status === "final" && Boolean(source.reviewed_at && source.finalised_at);
}

export function canReviseApprovedDiagnosis(
  source: RevisionSource,
  actor: { workspaceId: string; userId: string; canApprove: boolean },
): boolean {
  return source.workspace_id === actor.workspaceId
    && isApprovedRevisionSource(source)
    && (actor.canApprove || source.created_by === actor.userId);
}

export function validateRevisionReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 8 && reason.length <= 500 ? reason : null;
}
