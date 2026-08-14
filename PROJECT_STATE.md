# KAEC School Intelligence — Project State

Updated: 14 August 2026

## Current checkpoint

**KHP-OS Stage 7 integration candidate — implementation assembled for validation**

The KSI Product Constitution remains frozen. KSI remains the specialist learning-intelligence system with the governed loop:

**HQLS Lesson → Assessment → Student Evidence → Diagnosis → Action / Intervention → Next HQLS Lesson**

The new KHP-OS integration does not add a fourth KSI intelligence engine and does not turn KSI into an ERP.

## Stage 7 integration boundary

KSI can now be paired to one KHP-OS school organisation through a one-time Owner/Admin approval. After pairing, KSI exports only a bounded 90-day institutional aggregate:

- lesson validation and HQLS fidelity;
- assessment validation and lesson alignment;
- diagnosis finalisation;
- intervention-to-next-lesson continuity.

KSI does not export learner identities, teacher rankings, raw lesson content, assessment content, diagnosis prose, intervention notes or parent data.

KSI uses the signed-in user's existing RLS permissions to compute the aggregate. No KSI service-role credential or cross-database connection is introduced.

## Synchronisation

The connector token is stored in a Secure, HttpOnly, SameSite=Lax cookie. The dashboard performs a non-blocking refresh at most once per hour. KSI remains fully usable when KHP-OS is unavailable.

## Authority

KSI learning signals are institutional context only. They cannot resolve KSHC priorities or set verified institutional improvement. KHP-OS Stage 6 reassessment remains the only authority for those states.

## Validation gate

This checkpoint must pass:

- lint;
- strict TypeScript;
- existing KSI structural verification;
- Stage 7 integration verification;
- production build.

The integration branch is intentionally not named `*-preview`, so KSI's Vercel branch gate should not create a preview during code-level validation.

## Audit-trail preservation

Earlier Stage 5/6 acceptance detail remains preserved in Git history. This file records the current Stage 7 cross-product integration checkpoint without rewriting those historical records.
