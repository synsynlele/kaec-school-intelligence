# KAEC School Intelligence — Stage 1 Completion Report

Date: 7 August 2026  
Stage: **1 — Platform Foundation**  
Status: **ACCEPTANCE PASSED / READY FOR FOUNDER MERGE APPROVAL**  
Repository: `synsynlele/kaec-school-intelligence`  
Branch: `stage-1-platform-foundation`  
PR: `#1 — Stage 1 — Platform Foundation`  
Base: `main` @ `dfcd4dfe5832f64d856934840c0f6ee8b53b832e`

## 1. Executive result

Stage 1 converts the approved KAEC School Intelligence Product Constitution into a secure, durable platform foundation for the three Version 1 engines:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

The platform now has one workspace/tenant model, one constitutional HQLS model, one evidence graph, one resource-isolation model, one artifact-versioning primitive, one diagnosis authority model, one Google-first authentication path and one verified school-context foundation.

No final AI generator has been built in Stage 1.

Both engineering verification and the major live external acceptance gates have passed. PR #1 remains draft and unmerged until explicit founder approval.

## 2. Product boundary preserved

Stage 1 did not expand KSI into a generic school-management system.

Not added:

- fees/accounting
- attendance
- payroll/HR
- admissions
- transport
- timetabling
- parent messaging/portal
- student portal
- PipuPath integration
- broad school-operations products
- final AI generation engines

The governing loop remains:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

## 3. Branding requirement

KSI must use the **official KAEC-NG logo and approved KAEC-NG visual identity** on appropriate surfaces such as authentication, dashboard/header, favicon/app identity and generated reports. A substitute logo should not be invented where the official brand asset is available.

## 4. Dedicated backend

Dedicated Supabase project:

- name: `kaec-school-intelligence`
- ref: `zaoxfjbiizargeclnzmo`
- region: `eu-west-1`
- API URL: `https://zaoxfjbiizargeclnzmo.supabase.co`

No KSI migration was applied to `pipupath-staging`.

## 5. Database foundation

Stage 1 created 18 public product tables covering:

- profiles
- workspaces
- workspace membership
- subjects
- classes
- students
- resources
- lessons
- lesson stages
- HQLS fidelity checks
- assessments
- assessment items
- student evidence
- diagnoses
- artifact versions
- artifact/resource provenance
- AI-run provenance
- generation feedback

All public product tables have RLS enabled.

### Applied migration source files

1. `001_stage1_platform_foundation.sql`
2. `002_stage1_security_performance_hardening.sql`
3. `003_stage1_tenant_integrity.sql`
4. `004_stage1_school_workspace_bootstrap.sql`
5. `005_stage1_private_resource_storage.sql`
6. `006_stage1_resource_storage_integrity.sql`
7. `007_stage1_artifact_version_rpc.sql`
8. `008_stage1_hqls_lesson_structure.sql`
9. `009_stage1_diagnosis_review_integrity.sql`
10. `010_stage1_role_provenance_hardening.sql`
11. `011_stage1_diagnosis_rpc_hardening.sql`

Remote history contains one additional repeated application of the idempotent diagnosis RPC hardening operation. The repository intentionally contains only one `011` source file; the remote repetition is documented rather than concealed.

## 6. Tenant security

Stage 1 enforces workspace isolation through both RLS and relational constraints.

Verified protections include:

- foreign records cannot be linked across workspaces through class, subject, lesson, assessment, evidence, diagnosis or resource relationships;
- `workspace_id` cannot be silently moved after creation;
- creator/recorder provenance cannot be silently rewritten;
- every workspace retains at least one active owner;
- a user's default workspace must be authorised;
- school roster/configuration mutation is owner/admin only;
- lesson/assessment creation is bound to authenticated identity;
- student evidence is bound to authenticated recorder identity;
- HQLS fidelity history is append-oriented;
- resource metadata and object paths are workspace-scoped.

Synthetic authenticated RLS tests passed before live browser acceptance. Stage 1 later repeated the most important boundary with two real Google-authenticated users; see Section 14.

## 7. Google-first authentication — live acceptance passed

Product decision:

**Google Sign-In is the primary KSI sign-up/sign-in experience.** Email/password remains a secondary fallback.

Live Google OAuth acceptance passed on the protected Vercel Preview:

- first Google sign-in: PASS
- Supabase Google identity creation: PASS
- profile bootstrap: PASS
- private individual workspace bootstrap: PASS
- active owner membership: PASS
- default workspace link: PASS
- sign-out: PASS
- repeat Google sign-in: PASS
- repeat login did not duplicate private workspace or membership: PASS
- dashboard opened directly after repeat OAuth return: PASS

The first OAuth return briefly required a refresh while session state settled, but the issue did not reproduce on repeat login. Backend bootstrap and RLS remained correct throughout.

## 8. Constitutional HQLS persistence

The HQLS domain model has one canonical TypeScript source under `lib/domain/hqls.ts`.

The database enforces the seven-stage mapping:

1. `awakening`
2. `exploration`
3. `micro_illumination`
4. `trial_first`
5. `full_illumination`
6. `trial_second`
7. `integration`

`create_hqls_lesson_draft(...)` atomically creates a lesson with all seven stage rows.

Rollback-only live verification proved stage count = 7 and the exact constitutional ordering.

## 9. Assessment/evidence foundation

Assessment persistence supports:

- source lesson linkage
- class/subject linkage
- blueprint metadata
- item position/type
- KAEC critical-thinking experience type
- topic/objective
- difficulty
- marks
- content
- answer key
- marking guide
- evidence metadata

Student evidence is a separate first-class entity, allowing future diagnosis to distinguish observed evidence from AI interpretation.

## 10. Diagnosis governance

Diagnosis lifecycle is:

`draft → reviewed → final → archived`

Database-level authority controls passed:

- browser clients cannot assign reviewer/finaliser identity;
- `review_diagnosis(...)` stamps `auth.uid()` as reviewer;
- finalisation requires prior review;
- teacher cannot finalise;
- owner/admin may finalise after review;
- `finalise_diagnosis(...)` stamps `auth.uid()` as finaliser.

The public RPC surface uses SECURITY INVOKER wrappers over private privileged logic.

No final Diagnosis UI is part of Stage 1, so this high-consequence boundary is acceptance-tested at the database/RPC layer rather than through a Stage 1 diagnosis screen.

## 11. Artifact versioning and AI provenance

Shared artifact-history primitive:

`append_artifact_version(...)`

It supports lesson, assessment and diagnosis versions with generated/manual/regenerated/review/finalisation origins, engine version, prompt version, actor identity and immutable snapshots.

`ai_runs` separately records provider/model/engine/prompt provenance, input summaries, status and failures.

## 12. School workspace — live acceptance passed

A real Google-authenticated user created a school workspace successfully.

The original browser flow used `INSERT ... RETURNING` before the owner-membership trigger could satisfy the SELECT policy, producing a correct RLS `403`. The client was fixed without weakening RLS:

1. generate the workspace UUID client-side;
2. insert the workspace without premature `RETURNING`;
3. allow the owner-membership trigger to complete;
4. update the user's default workspace;
5. read/switch normally under existing RLS.

Live verification passed:

- workspace insert: PASS
- owner bootstrap: PASS
- profile default workspace update: PASS
- dashboard school context: PASS
- individual ↔ school switching: PASS

## 13. Private resource foundation — live acceptance passed

Private bucket:

`ksi-resources`

Verified configuration:

- public access disabled
- 20 MB maximum object size
- supported document/image MIME allowlist
- path contract: `<workspace>/<creator>/<unique-name>`
- matching authorised `resources` metadata required
- workspace-visible resources restricted to authorised workspace context
- private resources creator-only
- authorised deletion only

A real PDF browser round trip passed:

- resource metadata created: PASS
- object uploaded: PASS
- authenticated open/download: PASS
- school resource absent from user's private workspace: PASS
- school resource reappeared after switching back to school workspace: PASS

## 14. Two-user tenant isolation — live acceptance passed

A second real Google account authenticated in an isolated browser session.

Bootstrap verification:

- separate auth user: PASS
- separate profile: PASS
- exactly one private workspace: PASS
- active owner membership: PASS
- school-workspace memberships: 0

From the second user's authenticated RLS perspective:

- first user's school workspace visible: 0 rows
- first user's private resource visible: 0 rows
- first user's profile visible: 0 rows
- own private workspace visible: 1 row
- own profile visible: 1 row

A rollback-only mutation probe confirmed zero mutable rows for the first user's school workspace, resource and profile.

Browser confirmation passed:

- first user's school workspace was not listed;
- first user's uploaded PDF was not visible.

This closes the principal signed-session tenant-isolation gate.

## 15. Academic Setup — full CRUD acceptance passed

Route:

`/setup`

Reusable workspace context includes subjects, classes and students.

Owner/admin controls now support:

- create
- edit
- deactivate/reactivate
- delete with confirmation and dependency protection

Teachers remain read-only for structural school configuration.

Deletion is intentionally blocked where a subject, class or student already has dependent lessons, assessments, evidence or diagnoses. Those records should be deactivated instead so learning history is preserved.

Live browser CRUD acceptance passed.

## 16. Health endpoint — live acceptance passed

The protected Preview `/api/health` returned:

```json
{"ok":true,"supabaseConfigured":true,"dedicatedKsiTarget":true,"backendReachable":true}
```

This proves the deployed application is configured against the dedicated KSI Supabase target and can reach the backend.

## 17. Type and application architecture

Canonical architecture:

- `lib/domain/*` — product vocabulary/invariants
- `lib/data/*` — artifact/evidence/AI-run persistence
- `lib/resources/storage.ts` — resource storage
- `lib/supabase/client.ts` — typed browser client
- `lib/supabase/database.types.ts` — generated table/schema snapshot
- `lib/supabase/database.ts` — verified RPC overlay

Final live RPC contract includes:

- `append_artifact_version(...)`
- `create_hqls_lesson_draft(...)`
- `review_diagnosis(...)`
- `finalise_diagnosis(...)`

The combined contract passes strict TypeScript.

## 18. Build, dependency and CI gates

Verified stack includes:

- Next.js `16.3.0`
- React `19.2.4`
- Tailwind CSS `4.3.3`
- eslint-config-next `16.3.0`

Permanent KSI CI validates:

- `npm ci`
- lint
- strict TypeScript
- constitutional structure
- production build
- `npm audit --audit-level=high`

At accepted implementation head `96c6b19f6822d5a84cc3a346f946c61f443fa753`, the full CI workflow passed and Vercel reported a successful matching Preview deployment.

Closeout documentation commits are documentation-only and are revalidated by the same permanent CI/Vercel integration before merge approval.

## 19. Supabase advisor state

Latest closeout advisor state:

- Security advisor: one WARN — **Leaked Password Protection Disabled** for the email/password fallback.
- Performance advisor: only `unused_index` INFO notices on the new/low-usage database.

Google OAuth is the primary authentication path and is unaffected by the password warning. While email/password fallback remains available, leaked-password protection should be enabled before production launch.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Unused-index informational notices are intentionally not removed before real engine workload provides evidence for optimization.

## 20. Vercel deployment state

Known deployment surfaces:

- production alias: `https://kaec-school-intelligence.vercel.app`
- Stage 1 Preview: `https://kaec-school-intelligence-git-s-4f5a8d-synsynlele-3991s-projects.vercel.app`

Preview Protection remains enabled. Stage 1 acceptance used an authorised browser session rather than weakening Preview security.

## 21. Stage 1 acceptance checklist

- [x] approved Product Constitution and engineering guardrails
- [x] dedicated KSI Supabase project
- [x] 18-table workspace-scoped schema under RLS
- [x] same-workspace integrity and immutable provenance hardening
- [x] exact seven-stage HQLS persistence
- [x] diagnosis reviewer/finaliser authority controls
- [x] artifact versioning and AI-run provenance
- [x] Google OAuth primary sign-in
- [x] real Google first-user bootstrap
- [x] sign-out and repeat Google sign-in
- [x] no duplicate private workspace/membership on repeat login
- [x] real school workspace creation and switching
- [x] real private resource upload/download
- [x] school/private workspace resource isolation
- [x] Academic Setup create/edit/deactivate/reactivate/delete
- [x] protected Preview health response
- [x] second real Google-user bootstrap
- [x] two-user RLS/browser read isolation
- [x] cross-user write-isolation probe
- [x] permanent CI gate
- [x] successful Vercel Preview deployment

## 22. Stage 1 disposition

**Engineering disposition: PASS.**

**Live acceptance disposition: PASS.**

**Merge disposition: READY FOR EXPLICIT FOUNDER APPROVAL.**

PR #1 remains draft and unmerged until that approval is given.

Do not add final AI-engine code to the Stage 1 branch.

After merge, the next stage is:

**Stage 2 — HQLS Lesson Intelligence**

Stage 2 should consume this verified foundation rather than reopen completed Stage 1 architecture.
