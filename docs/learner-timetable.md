# Learner timetable setup

KHP-OS staff publish lessons and papers from the weekly lessons and tests and exams screens. Learners open **My Timetable** in KSI using their existing school account. Saving a change in KHP-OS keeps the last published entry visible until staff publish the revision. Cancelling a published paper marks it cancelled in the learner view.

## Connect the two applications

1. Apply both learner timetable migrations and deploy both applications.
2. Pair the KSI school workspace with KHP-OS through the existing school integration.
3. Set the same randomly generated server-only `KSI_TIMETABLE_BRIDGE_KEY` in KSI and KHP-OS. Use at least 32 characters, with a different key for each deployment environment.
4. In KSI, set the server-only `KSI_TIMETABLE_CLASS_LINKS` variable to a JSON object keyed by KSI class UUID. Each value contains the KHP-OS campus UUID, class label and section label. Omit the section only for classes whose KHP-OS streams have no section.
5. Confirm subject names match in both systems and the learner has explicit KSI subject enrolments for the class session. Publish a lesson and paper for a test class and verify both from a learner account.

Example class mapping with placeholder UUIDs

```json
{
  "00000000-0000-4000-8000-000000000001": {
    "campus": "00000000-0000-4000-8000-000000000002",
    "classLabel": "JSS 1",
    "section": "A"
  }
}
```

For staging, set KSI’s server-only `KHPOS_TIMETABLE_URL` to the full HTTPS timetable endpoint of the corresponding KHP-OS staging deployment.

A class without a mapping sees a setup message. New class records for a new academic session need their own mapping. Custom teaching groups require separate learner-group membership and are excluded from publication.
