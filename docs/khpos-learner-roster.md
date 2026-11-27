# Connect the KSI learner roster to KHP-OS

Apply the roster migrations in both apps. Set the same server-only `KSI_ROSTER_BRIDGE_KEY` in each app with a randomly generated secret of at least 32 characters. Give each deployment environment its own secret. KHP-OS uses the production KSI roster endpoint by default. For a test environment, set the server-only `KSI_ROSTER_URL` to that environment’s full HTTPS endpoint.

1. Pair the school in KHP-OS with its KSI workspace.
2. In KSI, a school Owner or Admin opens **Academic Setup** and allows roster sharing.
3. In KHP-OS, an authorised roster administrator opens **People & gate → Learners → Sync learners from KSI**. Choose the source class and the destination campus class, arm and term in the same academic session.
4. Run the sync. Review learners without admission numbers or with conflicting records. Repeat the sync when KSI names change or new learners join.

Existing learners retain their KHP-OS IDs, fee records and attendance. School-issued login information, grades, contact details and financial records are outside the roster export. Class transfers, withdrawals and conflicting admission numbers require staff review. Standalone registration remains available in both apps.
