# Stage 7 — KSI 2.0 Unified Learning Intelligence Foundation

## Objective

Create the shared foundation required for synchronized Teacher, Student and Leadership KSI surfaces without rebuilding the accepted V1 intelligence engines.

## Build order

1. School Access Control
2. Shared role model and student-account binding
3. Student Intelligence Surface foundation
4. Leadership Intelligence Surface foundation
5. Shared synchronization/read models
6. Curriculum-aligned student learning-resource engine
7. Mastery and personalized next-learning engine

## Stage 7 scope

This stage implements the access and identity foundation only.

### School Access Control

Every school workspace receives one platform access state:

- `active`
- `paused`
- `blocked`
- `disabled`

Only active school workspaces are available to ordinary workspace members. Status changes preserve data and are auditable.

### Roles

Workspace roles become:

- owner
- admin
- leader
- teacher
- student

The existing owner/admin/teacher behavior must remain intact.

### Student identity

An authenticated student account must bind one-to-one to an existing `students` row in the same workspace. This binding is the basis for future student-safe diagnosis, intervention, mastery and learning-resource reads.

### Platform administration

Authorized KAEC platform administrators can view and change school access state. This authority is separate from school-level owner/admin authority.

## Security requirements

- RLS remains mandatory.
- Existing protected workspace data must become inaccessible to normal users whenever the school workspace is non-active.
- UI hiding is insufficient; the database access helper must enforce the access state.
- Platform administrator privileges must be explicitly provisioned and auditable.
- Student users may never infer or read another student's diagnosis, evidence or intervention.
- No service-role credential may be exposed to the browser.
- Existing accepted V1 data must remain intact.

## Non-goals

Stage 7 does not yet build:

- student dashboard UI;
- leadership dashboard UI;
- e-textbook/resource generation;
- mastery scoring;
- personalized learning plans;
- parent portal;
- payment processing;
- ERP features.

Those depend on this foundation.

## Acceptance gates

Stage 7 is complete only when:

1. existing workspaces default to `active` with no loss of access;
2. switching a test school to `paused`, `blocked` or `disabled` denies ordinary protected access;
3. switching back to `active` restores access without data repair;
4. platform administrators can manage access state and ordinary school admins cannot;
5. leader and student roles can be represented without weakening existing permissions;
6. a student account can be bound to exactly one student record in the same workspace;
7. RLS regression tests prove cross-workspace and cross-student isolation;
8. lint, strict TypeScript, structural verification and production build pass;
9. no existing HQLS, Assessment, Diagnosis or Intervention acceptance behavior regresses.

## Next stages

After Stage 7 passes:

- **Stage 8 — Student Intelligence Surface**
- **Stage 9 — Leadership Learning Intelligence**
- **Stage 10 — Cross-Surface Synchronization**
- **Stage 11 — Student Learning Resource Engine**
- **Stage 12 — Mastery & Personalized Next Learning**

This sequencing keeps one shared intelligence core and prevents three separate KSI products from emerging.
