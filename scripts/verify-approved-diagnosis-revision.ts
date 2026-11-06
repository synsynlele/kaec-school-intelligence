import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canReviseApprovedDiagnosis,
  isApprovedRevisionSource,
  validateRevisionReason,
} from "../lib/diagnosis/revisions";

const source = {
  id: "report-original",
  workspace_id: "school-a",
  created_by: "teacher-a",
  status: "final",
  reviewed_at: "2026-10-31T09:00:00Z",
  finalised_at: "2026-11-01T09:00:00Z",
};
const owner = { workspaceId: "school-a", userId: "owner", canApprove: true };
const teacher = { workspaceId: "school-a", userId: "teacher-a", canApprove: false };
const other = { workspaceId: "school-a", userId: "teacher-b", canApprove: false };

assert(isApprovedRevisionSource(source));
assert(canReviseApprovedDiagnosis(source, owner), "School Owner/Admin can correct an approved diagnosis.");
assert(canReviseApprovedDiagnosis(source, teacher), "The original teacher can propose a correction.");
assert(!canReviseApprovedDiagnosis(source, other), "Another teacher must not revise someone else's report.");
assert(!canReviseApprovedDiagnosis(source, { ...owner, workspaceId: "school-b" }), "Revision must stay in the active school.");
for (const status of ["draft", "reviewed", "archived"]) {
  assert(!canReviseApprovedDiagnosis({ ...source, status }, owner), status + " must not be revised using the approved correction workflow.");
}
assert(!isApprovedRevisionSource({ ...source, finalised_at: null }), "Approval timestamp is required.");
assert.equal(validateRevisionReason("   Correct the learner's pronouns.   "), "Correct the learner's pronouns.");
assert.equal(validateRevisionReason("minor"), null);
assert.equal(validateRevisionReason("x".repeat(501)), null);

const route = readFileSync("app/api/diagnosis/route.ts", "utf8");
const result = readFileSync("components/diagnosis/diagnosis-result-client.tsx", "utf8");
const repository = readFileSync("lib/data/diagnoses.ts", "utf8");
const pdf = readFileSync("app/api/diagnosis/pdf/route.ts", "utf8");

assert(route.includes('action: "revise_approved"'));
assert(route.includes("await evidenceForDiagnosis(supabase, source as DiagnosisRow)"), "Copied report must retain traceable evidence.");
assert(route.includes("await createDiagnosisDraft(supabase"), "Approved correction must become a new draft.");
assert(route.includes("academicSession: source.academic_session") && route.includes("term: source.term"), "Correction must retain the original report period.");
assert(route.includes("conciseDiagnosis: corrected.conciseDiagnosis"), "Correction must persist the pronoun-aligned concise finding.");
assert(route.includes("concise_diagnosis: edited.conciseDiagnosis"), "Edited concise findings must persist for Word/PDF exports.");
assert(repository.includes('academic_session: input.academicSession ?? ""') && repository.includes('term: input.term ?? ""'), "Copied report period must persist in new diagnosis draft.");
assert(route.includes("revision: {") && route.includes("sourceDiagnosisId: source.id"), "Correction provenance is required.");
assert(route.includes('if (current.status === "final" || current.status === "archived")'), "Direct mutation of approved or archived report must stay blocked.");
assert(repository.includes("revision?: { sourceDiagnosisId: string; reason: string; approvedAt: string }"));
assert(repository.includes('snapshot: { diagnosis, ...(input.revision ? { revision: input.revision } : {}) }'), "Revision source must survive in the version-one audit snapshot.");
assert(result.includes("Revise Approved Diagnosis"), "Approved reports need an accessible revision action.");
assert(result.includes('action: "revise_approved"'));
assert(result.includes('revisionSource.id'), "Corrections need a link back to the official original.");
assert(result.includes('entry.row.status === "final"'), "Archived reports must remain read only.");
assert(pdf.includes('!["final", "archived"].includes(diagnosis.status)'), "Downloads must preserve approval status checks.");

console.log("Approved diagnosis revision authorization, immutable originals, evidence, provenance and UI checks passed.");
