# Stage 3 Saved Work Lifecycle

Status: IMPLEMENTED / ACCEPTANCE PENDING

KSI saved academic intelligence must be removable from a teacher's normal workspace without silently breaking downstream intelligence.

## Lifecycle

**Active → Archive → Restore or Permanent Delete**

### Archive

- available for HQLS Lessons and Assessments
- creator or workspace owner/admin only
- changes the artifact status to `archived`
- archived artifacts are hidden by normal `lessons` and `assessments` SELECT policies
- archive is reversible

### Restore

- available only from Archived
- creator or workspace owner/admin only
- HQLS Lesson restores to `validated` only when its latest HQLS fidelity check passed; otherwise it restores to `draft`
- Assessment restores to `validated` only when its persisted validation passed; otherwise it restores to `draft`

### Permanent Delete

- available only after Archive
- requires explicit typed confirmation `DELETE`
- creator or workspace owner/admin only
- HQLS Lesson permanent delete is blocked while any Assessment still references it as `source_lesson_id`
- Assessment permanent delete is blocked while any Student Evidence or Diagnosis still references it
- permanent deletion cleans generic provenance belonging to the artifact: generation feedback, resource links, artifact versions and AI runs
- item/stage/fidelity rows are removed through the existing database relationships
- the operation is server-side and atomic through an authenticated SECURITY DEFINER RPC; the browser never receives service-role credentials

## Product surface

`/saved-work` is the shared lifecycle manager for both modules.

It provides:

- Active and Archived views
- HQLS Lesson / Assessment filters
- Archive
- Restore
- Permanent Delete
- downstream dependency explanation when delete is blocked
- mobile-responsive controls

Both `/hqls` and `/assessment` expose **Manage Saved Work** navigation.

## Security contract

- real authenticated user required
- active workspace membership required
- management requires creator or workspace owner/admin
- archived records are not visible through ordinary lesson/assessment queries
- archived records are exposed only by the dedicated authenticated lifecycle RPC
- cross-workspace access remains blocked
- no service-role use in normal application flows

## Acceptance

Stage 3 lifecycle is accepted only when:

- [ ] Archive hides an HQLS Lesson from normal HQLS lists.
- [ ] Restore returns the HQLS Lesson safely.
- [ ] Archive hides an Assessment from normal Assessment lists.
- [ ] Restore returns the Assessment safely.
- [ ] Archived area lists the correct workspace items only.
- [ ] Permanent Delete requires `DELETE` confirmation.
- [ ] A linked Lesson is protected from permanent deletion.
- [ ] An Assessment with evidence/diagnosis is protected from permanent deletion.
- [ ] An unreferenced disposable archived item can be permanently deleted with its provenance.
- [ ] Desktop and mobile controls remain usable.
