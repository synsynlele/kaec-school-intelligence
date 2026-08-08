# Stage 6 — V1 Integration & Launch Readiness

## Status

**STARTING FROM VERIFIED STAGE 5 MERGE**

Base: `b4567d1ba8af418467023a4a4ba877f8b1ede3a4`.

This stage is governed by `docs/PRODUCT_CONSTITUTION.md` Version 1.1 and `AGENTS.md`.

## Constitutional role

Stage 6 is **not a fourth intelligence engine**.

Version 1 remains limited to:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

Stage 5 completed the governed intervention handoff required by the Version 1 loop.

Stage 6 closes the Constitution's **Platform Gate** around the complete product:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

## Goal

Make the complete KSI Version 1 experience coherent, durable, secure and launch-ready without expanding product scope.

## Required release outcomes

### 1. No dead-end core flows

Every primary artifact should offer the next legitimate action without forcing the teacher to rediscover context manually.

Required handoffs:

- HQLS Lesson → Assessment
- Assessment / evidence → Diagnosis
- Final Diagnosis → Intervention
- Confirmed Intervention → Next HQLS Lesson
- generated/saved artifact → exact saved artifact or clear saved-work destination

A successful action must never look like a failure because the resulting artifact is hidden or ambiguous.

### 2. Durable artifact continuity

Core saved work must survive refresh and re-login.

Verify the existing persistence/history model rather than creating a parallel storage system.

Where the product already has version/history/archive behaviour, preserve it. Extend only when a genuine Version 1 dead end exists.

### 3. Clear traceability

The product must preserve and expose enough provenance to follow the learning chain without turning the UI into an audit console.

At minimum, the underlying data relationships must remain intact for:

- source HQLS lesson → assessment;
- assessment/evidence → diagnosis where applicable;
- diagnosis → intervention;
- intervention → next HQLS lesson;
- resource provenance where source material materially guided an output.

### 4. Full-loop permission verification

Re-prove workspace isolation and role boundaries across the complete V1 loop.

Do not weaken RLS or authority rules to make acceptance pass.

### 5. User-facing failure and recovery behaviour

Core actions must return actionable errors.

The UI must distinguish:

- generation failure;
- successful generation with a later linkage/display problem;
- missing prerequisites;
- expired authentication;
- insufficient permission;
- provider/rate-limit failure.

Do not encourage duplicate generation when the artifact may already exist.

### 6. Desktop and mobile usability

The following core routes must remain usable at release:

- `/dashboard`
- `/setup`
- `/resources`
- `/hqls`
- `/assessment`
- `/diagnosis`
- `/interventions`
- `/interventions/next-lesson`
- `/saved-work`

No release-critical control may be inaccessible on common mobile widths.

### 7. Production-readiness closure

Review existing release warnings and close only those genuinely required for Version 1 launch.

Examples include authentication security configuration, environment correctness, deployment health and stale release documentation.

Do not remove intentional controls such as Preview Protection merely to make smoke tests easier.

### 8. Complete authenticated regression

Before Stage 6 acceptance, run the complete Version 1 path using real authenticated product behaviour:

1. sign in;
2. select/create valid school context;
3. create/open an HQLS lesson;
4. create an aligned assessment;
5. ensure evidence/diagnosis prerequisites are available;
6. generate and review a diagnosis;
7. finalise the diagnosis through authorised human review;
8. create and confirm an intervention;
9. generate the next HQLS lesson from that intervention;
10. verify the resulting lesson is linked, class-safe and accessible after refresh/re-login;
11. verify saved work/history and key exports;
12. run mobile regression on the same core navigation.

## Engineering gates

Stage 6 is not complete until the exact accepted head passes:

- dependency installation;
- lint;
- strict TypeScript;
- Stage 2–6 constitutional/structural verification;
- production build;
- high-severity dependency audit;
- relevant database/RLS verification;
- authenticated live Version 1 regression.

## Deployment discipline

Use `[skip vercel]` for intermediate implementation commits.

Create deliberate Preview deployments only at meaningful acceptance checkpoints.

## Explicit non-scope

Stage 6 must not add:

- another AI engine;
- fees/accounting;
- attendance;
- payroll/HR;
- admissions;
- transport;
- timetabling;
- parent portal or messaging;
- student portal;
- full classroom-observation product;
- teacher certification product;
- PipuPath integration;
- general-purpose school leadership dashboards.

## Merge rule

**DO NOT MERGE until full Version 1 live acceptance passes and founder approval is explicit.**