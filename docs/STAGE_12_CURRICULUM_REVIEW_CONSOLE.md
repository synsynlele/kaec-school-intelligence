# Stage 12 — Curriculum Review & Approval Console

## Purpose

Stage 12 converts uploaded Lagos scheme-of-work material into governed curriculum intelligence without allowing extraction or AI workflows to make curriculum content live automatically.

The governing lifecycle is:

**Uploaded source → staged scheme row → human review → approved/rejected → explicit promotion → canonical curriculum graph**

Approval and promotion are intentionally separate. No approval action automatically promotes a row.

## Verified ingestion baseline

At the close of Stage 12 scheme ingestion, production Supabase contained:

- 2,957 staged `scheme_entries`
- 2,957 rows with `review_status = 'pending'`
- 0 approved rows
- 0 rejected rows
- 0 promoted rows
- 25 staged scheme documents
- 1 registered but quarantined document
- 0 canonical `curriculum_nodes`
- 0 `scheme_entry_node_links`

The quarantined document is `IRS JSS 1-3 Edudelight.com.pdf`. The uploaded artifact is mixed/misbundled: pages 1–12 contain Christian Religious Studies while pages 13–28 contain Islamic Studies, although the whole document was registered as Islamic Religious Studies. It remains un-staged so uncertain provenance cannot contaminate the curriculum graph.

## Authority boundary

Curriculum review is a platform-level KSI responsibility, not a school-workspace administrative permission.

The review RPCs require an authenticated user and `private.is_platform_access_admin()`. School Owners, Admins, Leaders and Teachers do not gain global curriculum approval authority merely because of their workspace role.

The dashboard shortcut is also hidden unless `get_scheme_review_access()` returns true.

## Review console

Route: `/curriculum/review`

The console provides:

- summary counts for Pending, Approved, Rejected and Promoted rows
- document-level progress counts
- document, review-state, class and term filters
- 50-row pagination for controlled review rather than unbounded loading
- source filename, source page and source-reference visibility
- extracted learning objectives, activities, embedded core skills and resources
- explicit provenance-quarantine visibility
- per-row approve/reject actions
- page-level selection and bulk approve/reject actions
- optional review notes
- source-row correction before approval
- a separate promotion confirmation gate

Editing a row resets it to `pending`, clears its previous review decision and requires human review again.

## Promotion safeguards

Promotion is never part of the approval RPC.

A row can be promoted only when:

1. it exists;
2. it has `review_status = 'approved'`;
3. it has not already been promoted; and
4. the authenticated caller is a platform curriculum administrator.

The UI additionally requires the reviewer to type exactly `PROMOTE` before invoking promotion.

Promoted scheme entries are immutable. Corrections after promotion must be handled through governed source/version changes rather than silent mutation.

## Canonical curriculum structure

Promotion creates or reconciles the canonical hierarchy:

`class → term → week → subject → optional strand → topic → objective`

The optional `strand` node is essential for composite JSS subjects. It preserves source components such as:

- Basic Science and Technology strands
- Prevocational Studies strands
- National Value Education strands

This prevents distinct curricular components from being flattened into misleading generic topics.

## Derived document and batch status

Review state is derived from all rows in a batch/document rather than from the most recently reviewed row.

Documents remain:

- `registered` when they have no staged rows
- `staged` while any row remains pending
- `blocked` when every row is rejected
- `reviewed` when review is complete but approved content remains unpromoted
- `ingested` only after approved content has been promoted

Ingestion batches similarly remain `review` while pending or mixed, and become `approved` or `rejected` only when all of their rows reach the same terminal review decision.

## Database hardening

Migration: `026_stage12_review_console_hardening.sql`

The migration introduced the governed review console RPCs, promoted-row immutability, bulk review/promotion guards, derived review-state refresh logic and composite-strand promotion support.

The migration itself does not approve, reject or promote scheme content. Immediately after it was applied, production remained at the verified baseline of 2,957 pending rows and zero canonical curriculum nodes/links.

## Permanent structural verification

`scripts/verify-stage12.mjs` is included in `npm run verify:structure`.

It protects the following invariants in CI:

- platform-admin-only review authority
- approval/rejection code does not invoke promotion
- exact `PROMOTE` confirmation remains present
- promoted-row immutability remains enforced
- composite strand preservation remains enabled
- page-level governed review remains available
- typed review RPC contracts remain present
- source provenance and human responsibility remain constitutional anchors
- Vercel branch-deployment quota gating remains intact

## Repository security hygiene

While validating Stage 12, CI surfaced a pre-existing high-severity advisory for transitive NanoID 3.3.17. The repository now pins the semver-compatible patched resolution NanoID 3.3.18 through npm `overrides`, and the lockfile was regenerated by npm rather than hand-edited.

The dependency-audit gate remains enabled at `npm audit --audit-level=high`.

## Deployment posture

Stage 12 development uses branch `stage-12-curriculum-review-console` and draft PR #12.

The branch does not match the repository's `*-preview` Vercel deployment allow-list, so normal review-console development does not consume a Vercel preview deployment. No Stage 12 production deployment should occur until the exact PR head passes CI and explicit release authorization is given.

## Release checklist

Before merge/deployment:

1. `npm ci` passes on the exact PR head.
2. ESLint passes.
3. strict TypeScript passes.
4. all structural verification, including Stage 12, passes.
5. Next.js production build passes.
6. `npm audit --audit-level=high` passes.
7. production Supabase is re-audited to confirm review work itself did not move any curriculum row.
8. PR remains unmerged until explicit release authorization.
