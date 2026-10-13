# HQLS advisory content review

Owner-authorised direction: 13 October 2026. Release approval remains separate.

Generated lessons retain the complete seven-stage schema and existing HQLS fidelity checks and repairs. Content review is independent but advisory: exactly one model request per generation or stage regeneration, with a 20-second timeout and no automatic content-repair or re-review loop. Provider, malformed-response and grounding failures record Review unavailable rather than discard the lesson. Deterministic known factual/material findings remain visible as advice.

Store suggestions, stage numbers, priority and review availability in the lesson's existing source-context JSON. Show important corrections beside the relevant stage in both result and editor views. These records are advice, not a certificate of subject accuracy.

New generated lessons remain Draft until a teacher checks examples, tasks and answers, edits as needed, and explicitly saves and marks reviewed. This manual action uses no AI tokens and records the authenticated user and timestamp in versioned lesson metadata. Existing HQLS fidelity must pass before the lesson becomes Ready. Subsequent edits or stage regeneration reset this acknowledgement. Earlier suggestions remain visible with their original-review status; manual edits do not silently claim a fresh model review.

The teacher owns correction and acknowledgement. Existing authorised school roles retain their existing access. Readiness does not mean academic certification. Existing PDF/assessment readiness gates remain; exports carry review notes. Older lessons without the advisory record retain compatibility.

Verification covers one request, outage/invalid-response survival, stage advice persistence through JSON, human acknowledgement, acknowledgement reset and failed-fidelity protection. Signed-in persistence and actual model behaviour require separate live verification. No schema or permission change is required.
