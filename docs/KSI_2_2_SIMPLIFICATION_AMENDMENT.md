# KSI 2.2 Constitutional Amendment — Teacher & Leadership Simplification

**Status:** Founder-authorised product amendment  
**Approved:** 17 August 2026  
**Authority:** Founder / Product Custodian

## 1. Purpose

KSI 2.2 simplifies KAEC School Intelligence around the adults who operate the learning system: **Teachers and School Leadership**.

The Student-facing KSI surface authorised in KSI 2.0 is retired from the active product experience. This is a product-surface change, not a deletion of learner records or learning evidence.

## 2. Active product surfaces

KSI now has two primary working experiences and one governed administration layer:

1. **Teacher KSI** — plan, teach, assess, understand evidence, diagnose and intervene.
2. **Leadership KSI** — understand learning health, curriculum coverage, delivery, intervention and improvement signals.
3. **Owner / Administration** — school access, people, assignments and setup required to operate the two primary experiences.

Students are not an interactive KSI user surface in this version.

## 3. Student data remains part of the learning system

Retiring Student KSI does **not** remove the student as a governed domain entity. KSI may continue to hold and use authorised student records, lesson evidence, assessments, diagnosis, intervention and mastery information because these are required for Teacher and Leadership intelligence.

Historical student accounts and data must not be destructively deleted merely because the student-facing product is retired. Existing student-facing routes and APIs must no longer be presented as normal product entry points and must be safely retired or blocked.

## 4. Authoritative learning loop

The adult-operated KSI loop is:

**Academic Resource / Scheme → HQLS Lesson → Delivery & Evidence → Assessment → Diagnosis → Intervention → Next HQLS Lesson → Leadership Learning Signal**

This preserves the constitutional relationship between lesson, assessment, evidence, diagnosis and improvement.

## 5. Teacher experience requirement

Teacher KSI must be intentionally small and easy to navigate. Its primary destinations are:

- Home
- HQLS Lessons
- Assessments
- Student Diagnosis & Intervention
- Academic Resources
- Saved Work

Academic Resources is a first-class Teacher capability. It includes supplied schemes of work, school-uploaded curriculum/reference material and relevant teaching resources.

A teacher must be able to navigate a supplied scheme through **Class → Subject → Term → Week → Topic**, see available learning objectives, learning activities, embedded core skills and learning resources, and carry that context into HQLS lesson creation without retyping it unnecessarily.

## 6. Leadership experience requirement

Leadership KSI must prioritise decisions over feature lists. Its primary destinations are:

- Home / Learning Health
- Classes & Subjects
- Curriculum & Coverage
- Interventions
- School Setup

Owners receive Leadership capability plus the access and people administration required by their role.

## 7. Scheme provenance and extraction

Supplied scheme documents remain a sequencing/reference layer and must never be silently represented as independently verified official curriculum.

Scheme extraction may use AI to create structured drafts from the supplied source PDF, but:

- extracted content must preserve source provenance;
- extraction is not approval;
- approval is not promotion;
- promotion into a canonical curriculum structure remains a separate explicit human-governed action;
- no curriculum content may be auto-promoted;
- known mixed or misbundled sources must remain quarantined until explicitly resolved.

Teacher access to scheme content is read-only and does not grant curriculum review or promotion authority.

## 8. AI engine boundary

This amendment creates no new authoritative AI engine. The constitutional engines remain:

1. HQLS Lesson Intelligence
2. Assessment Intelligence
3. Student Diagnosis Intelligence

Scheme extraction is a governed source-processing utility, not an authoritative learning engine.

## 9. Navigation principle

KSI must behave like a guided operating system rather than a directory of modules. Each role should see only the destinations required for its work, with obvious next actions and minimal dead-end navigation.

## 10. Supersession rule

This amendment supersedes the requirement in the KSI 2.0 and KSI 2.1 amendments that Student KSI remain an active user-facing product surface. All other governance, security, dignity, RLS, human-review and provenance requirements remain in force unless explicitly amended here.
