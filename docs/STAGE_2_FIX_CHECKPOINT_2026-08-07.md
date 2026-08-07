# Stage 2 Fix Checkpoint — 2026-08-07

Current runtime fix head: `c1325e52b27e0cf73e3f3785ce41632851e21dcc`.

## Verified before this fix

- Fresh OpenAI HQLS generation: passed.
- Saved/reopen: passed.
- PDF export: passed functionally.
- Cross-account Stage 2 isolation: passed.
- Indices Stage 3 regeneration: passed with database proof that only Stage 3 changed; Stages 1, 2, 4, 5, 6 and 7 retained their exact pre-test content hashes.
- Regeneration artifact version and AI run: persisted successfully.

## Defects corrected in this head

1. Resource-grounded generation failed with `bucket not found` because `KSI_RESOURCE_BUCKET` was exported from a `use client` module and imported into the server HQLS route. The module is now server-safe, preserving the canonical `ksi-resources` bucket value for both server and browser callers.
2. The teacher-ready PDF header divider visually intersected the official KAEC-NG logo. The report-logo rendering now preserves the same official mark while placing it safely above the divider area.
3. The dynamic ImageResponse favicon rendered white. It has been replaced by a real static `app/icon.png` derived directly from the founder-supplied official KAEC-NG logo.

## Exact-head engineering gate

- KSI CI run #230: passed.
- lint: passed.
- strict TypeScript: passed.
- constitutional structure: passed.
- production build: passed.
- dependency audit: passed.
- Vercel deployment `3DWi6AB3Jw7vbc6qhJkReQCE9RzW`: READY.

## Remaining live acceptance

- Re-test resource-grounded generation using `HQLS Eng wk 3 lesson 1.pdf` in KAEC Nigerian Schools.
- Re-test teacher-ready PDF visual header.
- Confirm official KAEC-NG favicon displays after hard refresh/new tab.
- Complete one true manual edit + Save edits + reopen test. The prior Integrity action was an AI Stage 7 regeneration, not a manual edit.
