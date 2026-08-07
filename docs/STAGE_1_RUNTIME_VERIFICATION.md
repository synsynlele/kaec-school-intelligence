# KAEC School Intelligence — Stage 1 Runtime Verification

Status: **required before Stage 1 closure**

This checklist records only live/runtime proof. Structural database checks, RLS policy inspection, CI and Supabase advisors are necessary but do not replace these tests.

## Verified infrastructure facts

- Dedicated Supabase project: `kaec-school-intelligence`
- Project ref: `zaoxfjbiizargeclnzmo`
- Expected Supabase hostname: `zaoxfjbiizargeclnzmo.supabase.co`
- Vercel Preview builds from `stage-1-platform-foundation`
- Supabase security advisor currently returns zero findings
- Permanent CI validates lint, strict TypeScript, production build and high-severity dependency audit

## External test constraints discovered

### Vercel Preview protection

The Preview deployment is protected by Vercel Authentication. An unauthenticated GitHub runner receives HTTP 401 before the application health route executes.

Therefore an anonymous `curl` failure against the Preview **must not** be interpreted as a Supabase configuration failure.

Runtime Preview verification must be performed either:

1. through an authenticated Vercel browser session,
2. with an approved Vercel protection-bypass mechanism, or
3. after an explicit decision to change Preview protection.

Do not disable deployment protection merely to make an automated smoke test green.

### Supabase Auth email rate limit

A one-time external signup smoke test reached the dedicated KSI Supabase Auth endpoint but was rejected with `email rate limit exceeded` before a usable test identity was created.

Therefore the two-user runtime isolation test remains **not yet proven**. Retry only after the Auth email rate limit window has cleared or an approved non-email test-user mechanism is available.

## Runtime gate A — deployed backend target

Open the protected Vercel Preview while authenticated and request:

`/api/health`

Expected JSON:

```json
{
  "ok": true,
  "supabaseConfigured": true,
  "dedicatedKsiTarget": true,
  "backendReachable": true
}
```

Failure rules:

- `supabaseConfigured: false` — Preview environment variables are missing.
- `dedicatedKsiTarget: false` — deployment is pointed at the wrong Supabase project; stop immediately.
- `backendReachable: false` — target exists but the public client cannot reach the backend.

No key or secret should ever be returned by the health endpoint.

## Runtime gate B — real user bootstrap

Create one real test account through the KSI sign-up UI after the Auth rate limit clears.

Expected after authentication:

- one `profiles` row for the auth user,
- one private individual workspace,
- one active `workspace_members` row with role `owner`,
- `profiles.default_workspace_id` points to that workspace,
- dashboard loads that workspace without manual database intervention.

Then sign out and sign back in. The same workspace must remain visible.

## Runtime gate C — two-user tenant isolation

Create two authenticated test users A and B.

Verify:

1. A sees only A's private workspace.
2. B sees only B's private workspace.
3. A cannot select B's workspace by ID.
4. A cannot insert a lesson, assessment, diagnosis, evidence row or resource metadata into B's workspace.
5. B cannot read A's private resources.
6. Neither user can change an existing row's `workspace_id` or creator/recorder provenance to cross boundaries.

Any successful cross-workspace read or write is a Stage 1 blocker.

## Runtime gate D — school workspace bootstrap and switching

Using user A:

1. create a school workspace from the dashboard,
2. confirm A becomes active `owner`,
3. confirm the workspace can be selected,
4. create school-owned subject/class/student configuration as owner/admin,
5. switch back to A's individual workspace,
6. confirm the school data does not appear there,
7. switch to the school workspace again and confirm state persists.

## Runtime gate E — private resource isolation

In a school workspace:

1. upload an allowed file below 20 MB,
2. confirm a `resources` metadata row is created,
3. confirm object path begins with `<workspace_id>/<uploader_user_id>/`,
4. download it as an authorised workspace member,
5. verify a non-member cannot download it,
6. verify an authorised uploader or owner/admin can delete it,
7. confirm the bucket itself is not public.

## Runtime gate F — diagnosis human-review path

With an existing student and draft diagnosis:

1. ordinary authenticated member creates a draft,
2. `review_diagnosis(...)` records the authenticated reviewer,
3. ordinary teacher cannot directly forge reviewer/finaliser identity,
4. only owner/admin can finalise,
5. finalisation fails before human review,
6. after review, finalisation records the authenticated finaliser,
7. ordinary members cannot silently reopen or mutate the final report.

## Final Stage 1 exact-head proof

Before declaring Stage 1 complete, record one exact Git commit SHA where all of the following are simultaneously true:

- normal CI green,
- Vercel Preview READY,
- `/api/health` passes against the dedicated KSI backend,
- real auth bootstrap passes,
- two-user tenant isolation passes,
- school workspace switching passes,
- private resource isolation passes,
- diagnosis review/finalisation smoke passes,
- Supabase security advisor returns zero findings,
- only acceptable informational performance notices remain,
- database TypeScript/RPC contract matches the final Stage 1 schema.

Stage 2 must not begin until that exact head is recorded in `PROJECT_STATE.md` and the Stage 1 completion report.
