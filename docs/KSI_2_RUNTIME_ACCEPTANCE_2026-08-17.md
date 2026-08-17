# KSI 2.0 Runtime Acceptance — 17 August 2026

## Result

**Database/security synchronization acceptance: PASS — 21/21 checks.**

The acceptance candidate was deployed once through the quota-controlled branch `ksi-2-acceptance-preview`. The Vercel GitHub deployment reported `success` for preview commit `b1e341f4aa08ebb234892012a37be1d681562436`, which is content-identical to the pre-acceptance consolidation candidate.

The current ChatGPT Vercel connector is authenticated to a different Vercel scope than the KSI project, so it could not open the protected preview pages for a browser-level visual smoke test. The acceptance below therefore records what was actually proved: authenticated database/runtime role boundaries and the complete synchronized learning record, executed against the dedicated KSI Supabase project in transactions that ended with `ROLLBACK`.

No production release was performed.

## Defects discovered and corrected during acceptance

### 1. Student Access Code redemption conflict-target ambiguity

The initial acceptance exposed a real PostgreSQL runtime error in `redeem_student_access_code(text)`. Because the function returns a table containing an output variable named `workspace_id`, the old statement:

`on conflict (workspace_id, user_id)`

was ambiguous inside PL/pgSQL.

Correction:

- repository migration: `057_stage8_student_access_redeem_conflict_fix.sql`;
- live migration history: `stage8_student_access_redeem_conflict_fix`;
- conflict target now uses the named primary key `workspace_members_pkey`;
- permanent structural verification protects the corrected executable pattern.

### 2. Mastery qualitative-evidence join multiplication

The next acceptance run showed that one reviewed HQLS qualitative evidence record could be counted multiple times when the objective aggregation joined across several class/subject assessments. That could raise confidence prematurely.

Correction:

- repository migration: `058_stage11_mastery_distinct_evidence_fix.sql`;
- live migration history: `stage11_mastery_distinct_evidence_fix`;
- mastery aggregation now counts `distinct se.id` for item and qualitative evidence;
- permanent structural verification protects distinct-evidence counting.

Final proof showed that one reviewed lesson creates exactly one qualitative mastery evidence item and remains conservatively `evidence_building` / low-confidence rather than being incorrectly promoted to `developing`.

## Final acceptance path

The final rollback transaction proved all of the following:

1. Platform Admin can pause a school.
2. Paused school blocks Leadership KSI.
3. Platform Admin can reactivate the school.
4. Leader can read school learning intelligence.
5. Leader can read delivery intelligence.
6. Leader can read mastery intelligence.
7. Owner can create a governed Teacher ↔ Class ↔ Subject assignment.
8. Owner can issue a one-time Student Access Code.
9. Student can redeem the code and bind the authenticated account to the intended learner record.
10. Student KSI exposes the existing diagnosis/intervention priority.
11. Student KSI exposes the baseline objective mastery graph.
12. Teacher delivery of a validated HQLS lesson creates learner work for the class roster.
13. The delivered HQLS lesson appears in the Student learning library as taught/assigned.
14. Student can submit reflection and real-life work.
15. Teacher review converts the submission into governed `student_evidence`.
16. Reviewed feedback synchronizes back to Student KSI.
17. One reviewed lesson adds exactly one qualitative mastery evidence record and one new objective while retaining conservative evidence confidence.
18. Leadership delivery intelligence updates from the same delivery/submission/review record.
19. Leadership mastery intelligence sees the same correctly conservative refreshed mastery graph.
20. Pausing the school preserves linked learning data.
21. Paused school blocks Student KSI access.

### Key synchronization proof

Before reviewed lesson evidence:

- objective count: `10`;
- all 10: `evidence_building`.

Inside the acceptance transaction after one reviewed lesson:

- objective count: `11`;
- qualitative evidence on the new objective: exactly `1`;
- `developing`: `0`;
- `evidence_building`: `11`;
- Leadership saw the same 11-objective graph;
- delivery/submission/review counts were all `1` with 100% submission and review rates for the single acceptance delivery.

This proves that Teacher actions, Student learning activity, governed evidence, Student mastery and Leadership intelligence are operating over the same learning record rather than separate product silos.

## Rollback / no-movement proof

The final acceptance transaction ended with `ROLLBACK`.

Post-acceptance audit confirmed the live school returned to its original state:

- school access status: `active`;
- temporary staff membership: `0`;
- temporary student membership: `0`;
- student accounts: `0`;
- lesson deliveries: `0`;
- student lesson-work rows: `0`;
- school access audit rows created by acceptance: `0`;
- learner-mastery rows: `10`;
- mastery events: `20`;
- scheme entries pending: `2,957`;
- scheme entries promoted: `0`;
- canonical curriculum nodes: `0`.

The two function corrections are intentionally persistent schema migrations. Acceptance identities and learning data are not.

## Release status

This acceptance clears the coordinated KSI 2.0 database/runtime synchronization gate.

PR #13 remains draft and unmerged. No production merge or release is authorised by this acceptance alone. Browser-level visual acceptance of the protected preview should be treated separately if/when the KSI Vercel project is connected to the active Vercel tool scope or the founder performs the visual check directly.
