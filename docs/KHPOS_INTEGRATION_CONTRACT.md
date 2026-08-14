# KSI → KHP-OS Integration Contract v1.0

## Purpose

KSI remains the specialist learning-intelligence product. KHP-OS receives only bounded institution-level learning signals so leadership can interpret the quality and continuity of the school's learning system without duplicating KSI or moving learner records between products.

## Trust model

1. KHP-OS issues a 15-minute one-time pairing token.
2. The token is carried in the URL fragment, not the query string.
3. A signed-in KSI Owner or Admin selects the exact school workspace and approves once.
4. KSI calculates a 90-day aggregate through the signed-in user's existing RLS permissions.
5. KHP-OS atomically binds the exact workspace, stores the first aggregate and returns a connector token.
6. KSI stores that token in a Secure, HttpOnly, SameSite=Lax cookie.
7. Future dashboard sessions attempt a non-blocking sync at most once per hour.

No KSI service-role key, KHP database credential, direct database link or cron job is required.

## Shared aggregate contract

Contract version: `1.0`

KSI sends only:

- lesson count and validated lesson count;
- HQLS fidelity check count, pass count and average score;
- assessment count, validated assessment count and lesson-linked assessment count;
- diagnosis count and final diagnosis count;
- confirmed intervention count and next-lesson-linked intervention count;
- source generation timestamp and bounded signal window.

## Explicitly excluded

KSI never sends through this contract:

- learner names or student records;
- teacher rankings or individual teacher performance data;
- raw HQLS lessons;
- assessment questions or responses;
- diagnosis prose;
- intervention notes;
- parent information.

## Authority boundary

KSI signals are context only. They may inform KHP-OS interpretation, review and institutional learning, but they cannot:

- approve a KHP-OS priority;
- resolve a diagnosed KSHC weakness;
- change `verified_improvement`;
- replace a fresh KSHC reassessment;
- make employment, disciplinary or learner-level decisions.

Only KSHC reassessment remains authoritative for verified institutional improvement and priority resolution.

## Availability boundary

KSI must remain usable when KHP-OS is unavailable. Automatic sync is best-effort and non-blocking. A later authenticated dashboard session can retry after the one-hour throttle window.
