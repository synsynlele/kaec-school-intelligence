# KSI lesson timing, export preservation and content review

Requested by the owner on 7 October 2026. Changes preserve the current HQLS sequence, topic suspense, human diagnosis approval and workspace access controls.

## Delivered scope

- Shared suggested pacing for all seven stages, visible in lesson results, editing and PDF export. The schedule uses the saved lesson duration, sums exactly to it, and does not claim to record actual teaching time. Historical lessons without duration state that timing is unspecified.
- All four PDF composers use embedded licensed DejaVu fonts, real glyph-width wrapping and per-document Unicode mappings. IPA, mathematical notation, currency and accented characters remain printable/searchable. Unsupported glyphs cause an explicit export error instead of silent deletion. The fonts are traced into server PDF routes.
- Populated HQLS stage fields previously omitted by the stage-specific PDF template appear as additional sections. Full teaching content and support boxes continue to paginate.
- Diagnosis flow no longer silently drops sections when they exceed one page. The first-page summary remains, followed by the complete reviewed diagnosis, findings, actions, evidence, interpretations and growth/review notes.
- Corrected overlapping fallback assessment/intervention headers and an overflowing diagnosis continuation title.
- Replaced user-facing 100/100 fidelity badges with accurately scoped sequence-check labels and a teacher subject-review reminder. Stored fidelity records and export permission gates remain intact.
- Rejects the explicitly vague objective "Everything about the topic" with a concrete example of an observable objective.
- HQLS prompt v1.17 adds subject accuracy, solvable supplied materials, teacher-facing expected answers, prerequisite support, individual evidence, supported reflection and offline home-practice guidance without removing the governing stage requirements.
- Separate automated subject/task review runs after sequence validation for new lessons. Findings require a verbatim quote from the specified stage. One bounded content-repair attempt is rechecked for both sequence and content before persistence. Stage regeneration also reviews the candidate lesson before overwriting a saved stage. Manual editing remains available without extra AI calls and does not imply subject certification.

## Practical limits

Automated subject review can miss errors or produce false alarms; it is not independent human validation. It adds one reviewer call to successful new generation/stage regeneration, and up to one repair plus another review for a defective new lesson. A provider failure fails closed for generated changes. Older saved lessons are not regenerated or retrospectively content-certified. Suggested timings are not individually editable in this change. Teacher review remains necessary.

This change does not rewrite school governance, diagnosis standards, assessments or unrelated dashboards. No migrations or production-data mutations are required.

## Verification

- Runtime regressions cover every integer lesson duration from 10 to 240 minutes, unsupported glyph failure, vague objectives, traceable review findings, five export modes, and long lesson/diagnosis content retained through pagination.
- PDF fixtures are generated with synthetic data and checked by Poppler text extraction; representative rendered lesson, exam and diagnosis pages were visually inspected.
- Normal repository lint/typecheck/structure/build and dependency-audit results are recorded in the PR. Existing lint warnings remain outside this scope.
- Live authenticated generation, saved editing and downloads remain release acceptance gates. Local synthetic export tests do not establish those live gates.

## Dependency audit

The initial audit identified existing Next.js, sharp, source-map-js and braces advisories. Patch updates pin Next.js and its ESLint config to 16.3.6, sharp to 0.35.5, and source-map-js to 1.2.2. The remaining full-audit failure is the development-only chain eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces (GHSA-vfj7-8cjw-p6xm). The upstream advisory reports no patched braces release. No audit exception, package downgrade or CI bypass has been introduced. This is an open release gate; a production-only audit does not replace the repository's full-audit requirement.

Sources: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j and https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

## Release

The working branch is not a Vercel preview branch and existing deployment gating remains unchanged. No production release is performed without the owner's explicit release authorisation required by AGENTS.md.
