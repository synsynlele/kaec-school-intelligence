# KAEC School Intelligence — KSI 2.1 Completion Amendment

**Status:** Founder-authorised KSI 2.0 completion scope  
**Date:** 17 August 2026  
**Applies with:** `PRODUCT_CONSTITUTION.md` and `KSI_2_CONSTITUTIONAL_AMENDMENT.md`

## 1. Purpose

This amendment completes the immediate KSI 2.0 learning-intelligence product without converting KSI into a school ERP or creating disconnected Student and Leadership systems.

The shared governed learning record remains authoritative:

**HQLS Lesson → Student Learning Resource → Assessment → Student Evidence → Diagnosis → Intervention → Student Priority / Personalized Plan → Next HQLS Lesson → Leadership Learning Signal**

## 2. Ask KSI

A bounded **Ask KSI** student learning tutor is authorised.

Ask KSI is a supporting learning interface, **not a fourth authoritative intelligence engine**. It may:

- explain curriculum and class learning ideas;
- provide examples, hints and guided practice;
- help a learner reflect or connect learning to real life;
- explain the learner's own student-safe KSI diagnosis, intervention, mastery and plan in respectful language.

Ask KSI may **not**:

- create, revise or finalise a diagnosis;
- create or confirm an intervention;
- upgrade or downgrade mastery;
- expose private teacher notes or another learner's record;
- claim curriculum authority for content that has not completed the curriculum governance process.

Tutor conversations must be authenticated, student-bound, rate-limited and server-side for AI credentials.

## 3. Persistent personalized learning plan

KSI may maintain a versioned student learning plan derived from the learner's existing governed record.

Priority order is:

1. latest confirmed intervention;
2. objective-level mastery requiring attention or more evidence;
3. active, human-approved curriculum objectives not yet evidenced as mastered;
4. validated class learning activity when stronger personalization is not yet justified.

Completing a plan step does not itself change mastery. Mastery changes only when governed evidence changes.

When authoritative source evidence changes, KSI creates/supersedes the plan version rather than silently rewriting historical learning guidance.

## 4. Curriculum learning-resource engine

KSI may generate student self-study resources from canonical curriculum objectives only after those objectives exist through the human review and explicit promotion workflow.

Resource lifecycle is:

**Canonical promoted objective → AI draft → Human review → Explicit publication → Student library**

Rules:

- no pending scheme entry can enter the student curriculum library;
- no AI-generated resource is student-visible while still draft;
- review and publication are separate human actions;
- published resources are immutable; revisions create a new version;
- curriculum/source provenance remains attached to the resource;
- generation may explain the approved objective using accurate general subject knowledge but may not invent new official objectives.

This preserves the existing Stage 12 rule: **nothing is automatically promoted.**

## 5. Leadership curriculum and risk intelligence

Leadership KSI may show:

- adopted curriculum readiness;
- canonical-objective coverage;
- published student-resource coverage;
- verified curriculum-to-KSI objective alignment;
- learning-risk signals derived from diagnosis response, mastery confidence/state, evidence freshness, intervention review dates and personalized-plan activity.

Risk signals exist to direct system response. They may not rank student or teacher worth and may not be used as a clinical or psychological label.

## 6. Immediate completion boundary

The immediate KSI 2.0 completion includes:

- School Access Control;
- shared role/identity foundation;
- Teacher KSI learning loop;
- Student KSI home, learning library, diagnosis/intervention view, mastery, personalized plan and Ask KSI;
- Leadership KSI learning health, intervention, delivery, mastery, curriculum coverage and learning-risk intelligence;
- governed curriculum ingestion/review/promotion;
- governed curriculum learning-resource factory.

The parent layer remains a later separately approved surface. Finance, payroll, HR, admissions, attendance, transport and generic school administration remain outside KSI.

## 7. Release rule

No completion claim may bypass runtime acceptance. The final release candidate must prove role/access boundaries and synchronization while preserving current curriculum state, human promotion/publication gates and production data integrity.