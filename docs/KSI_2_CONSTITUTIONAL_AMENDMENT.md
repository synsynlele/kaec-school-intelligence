# KAEC School Intelligence — KSI 2.0 Constitutional Amendment

**Status:** Founder-authorised implementation amendment  
**Date:** 17 August 2026  
**Supersedes:** Version 1.1 scope exclusions only where expressly stated below

## 1. Purpose

KSI evolves from a teacher-only academic intelligence platform into a unified learning-intelligence platform with three synchronized operational surfaces:

1. **Teacher Intelligence** — HQLS lesson, assessment, diagnosis and intervention workflows.
2. **Student Intelligence** — curriculum-aligned learning resources, student-safe diagnosis, interventions, strengths, growth areas, mastery and personalized learning priorities.
3. **Leadership Intelligence** — aggregated learning health, curriculum coverage, intervention monitoring, class/subject trends and learning-risk signals.

KSI remains a specialist learning-intelligence system. It does **not** become a school ERP.

## 2. Core synchronized loop

The constitutional learning loop becomes:

**HQLS Lesson → Student Learning Resource → Assessment → Student Evidence → Diagnosis → Intervention → Student Priority / Next Learning → Next HQLS Lesson → Leadership Learning Signal**

All surfaces must read from the same governed learning data rather than duplicating records or creating disconnected products.

## 3. Version 1 exclusions explicitly amended

The Version 1 exclusions for a **student portal** and **general-purpose school leadership dashboard** are amended as follows:

- A **Student Intelligence Surface** is permitted only where it directly supports learning, practice, diagnosis, intervention, mastery, reflection, resources or next-learning guidance.
- A **Leadership Intelligence Surface** is permitted only for teaching-and-learning intelligence. Finance, payroll, HR, admissions, transport, inventory and generic ERP functions remain outside KSI.
- A parent surface remains outside the immediate KSI 2.0 foundation unless separately approved.

## 4. Non-negotiable boundaries

KSI 2.0 must preserve:

- the seven-stage HQLS sequence;
- teacher responsibility and human review where already constitutionally required;
- dignity-first student wording;
- Lesson → Assessment → Evidence → Diagnosis → Intervention traceability;
- workspace/school tenant isolation;
- RLS as a security boundary;
- student access only to their own authorized learning record;
- leadership access to governed school-level or permitted drill-down learning intelligence;
- no ranking of human worth;
- no clinical, medical, psychiatric or psychological diagnosis;
- no silent expansion into school ERP.

## 5. School Access Control

KSI 2.0 introduces a platform-level school access state controlled by authorized KAEC platform administrators:

- `active`
- `paused`
- `blocked`
- `disabled`

Only `active` schools receive normal protected KSI access. Non-active states retain data but deny normal protected product access until reactivated. Status changes must be auditable and enforced server-side/database-side, not merely by hidden UI.

This is an access-control mechanism, not an accounting or payment engine. Payment remains an external commercial decision that an authorized administrator may use when choosing a school's access state.

## 6. Authorized roles

KSI 2.0 expands governed workspace roles to:

- `owner`
- `admin`
- `leader`
- `teacher`
- `student`

Student authentication must be linked to an existing KSI student record and may never grant cross-student access.

## 7. Release rule

No Student or Leadership feature may be declared complete unless it is synchronized with the shared learning record and respects school access state, role authorization, RLS, provenance and existing constitutional learning rules.

This amendment authorizes staged KSI 2.0 implementation from the current merged `main` lineage while preserving all accepted KSI V1 behavior unless explicitly amended above.
