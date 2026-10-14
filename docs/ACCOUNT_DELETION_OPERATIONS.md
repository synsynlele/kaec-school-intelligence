# KSI Account Deletion — Operator Procedure (Play Store readiness)

Status: **prepared for owner/KAEC operations review; not yet operationally verified**  
Support inbox: **kaecng@gmail.com** (confirmed 2026-10-14)  
Public request page: `https://www.ksi.name.ng/delete-account`

## Responsibility and access

KAEC-NG's authorised platform operator owns intake and execution; a participating school remains responsible for school-controlled records. No generic teacher or unauthorised support volunteer may inspect learner records or use database administrator credentials.

The Google Play account deletion policy requires **account deletion and deletion of associated user data**, not just disabling login. Retention is allowed only where justified (e.g., legal, security, regulatory requirements) and must be disclosed. Account creation in KSI makes this mandatory. The email request link is an intake mechanism, not evidence that deletion has occurred.

## Manual processing sequence

1. **Receive:** Watch the official `kaecng@gmail.com` inbox for messages with subject `KSI account deletion request`. Log request date, case ID, contact, request scope and status in a restricted operator log. Never include learner names or secrets in an email subject.
2. **Verify:** Confirm the requester controls the KSI sign-in email by responding to that address; if the request originates from another email, use an existing authenticated channel or other privacy-preserving proof. Never request passwords, access codes, full learner records or OTPs.
3. **Identify records:** Resolve the account's Supabase Auth identity and current school memberships. Inventory personal profile, memberships, uploads/storage objects, generated artifacts and creator/audit references that relate to this individual. Distinguish (a) their personal data from (b) school-controlled records or other people's data; do not delete an entire school's educational records because one teacher leaves.
4. **Scope and retention decision:** Check with the authorised school owner when institution-controlled educational records would be affected. Record the specific legal/operational retention reason, dataset and retention period if an exception applies. Do not use an indefinite or vague retention claim.
5. **Remove access, then erase:** Prevent further access and delete or de-identify associated personal data across KSI's Supabase Auth/database/storage and any relevant downstream processors according to their supported procedures. Ensure foreign key and authored-record dependencies are understood. Never run mass-delete SQL without a reviewed and tested migration/script; do not disable RLS. If school-owned artifacts must remain, remove personal identifiers where feasible and ensure permission boundaries remain intact.
6. **Verify deletion:** Using authorised administration read access, confirm the KSI login no longer works, account-specific accessible data and storage have been removed, and no unauthorised memberships or personal identifiers remain. Retained records should have a documented legal/operational rationale and access boundary.
7. **Close:** Send a reply to the verified contact with completion status, the categories deleted, any specific retained categories with reasons and how to raise a concern. Update the restricted case log. Do not send third-party learners' data in the reply.

## Release acceptance

- [ ] Assign an accountable KAEC-NG operator and restricted case log
- [ ] Confirm support email receives messages and can respond
- [ ] Test the public `/delete-account` link without a session
- [ ] Dry-run with a dedicated disposable KSI test account and no real learner data
- [ ] Verify correct school data retention and owner consultation
- [ ] Confirm the data deletion completion reply and audit record
- [ ] Complete Google Play Data safety and account deletion answers truthfully

**No production-account deletion or RLS/schema change is authorised by this document.** Do not mark operational deletion as verified until the operator has completed the dry-run and can consistently fulfil real requests.
