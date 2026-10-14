# KSI — Google Play submission pack (draft for operator review)

## Verified Android identity
- Public-facing name: KAEC School Intelligence (KSI); installed launcher label currently **KSI**
- Application ID: `ng.name.ksi.lite` — **do not change if retaining the existing signing/update identity**
- Existing signed public release: `ksi-lite-v1.0.4`, version code **5**, dated 2026-09-27; proposed new Play candidate: `ksi-lite-v1.0.5`, version code **6** (not yet signed/published)
- Production origin: https://www.ksi.name.ng
- Android shell: Trusted Web Activity (TWA) with WebView fallback, not a standalone offline app
- Android release workflow: `.github/workflows/android-lite-release.yml`
- Signing key is held in protected GitHub Actions secrets. Do not commit or share it.
- Source of truth for build version: `android-lite/twa-manifest.production.json`.
- New Android build required **only** for wrapper changes or Play Store compliance, not ordinary web-only feature releases.

## Suggested Google Play store listing (editable)
**App name:** KAEC School Intelligence

**Short description (under 80 characters):**
Plan lessons, build assessments and guide learning with KSI.

**Full description:**
KAEC School Intelligence (KSI) helps teachers and school leaders turn lesson planning, assessment and learner evidence into practical teaching decisions.

Use KSI to:
- Prepare structured seven-stage HQLS lessons.
- Review, edit and manually validate lesson plans.
- Download validated, school-branded lesson PDFs.
- Create assessments aligned with teaching objectives.
- Review learner diagnosis and plan next steps.
- Work in your authorised school workspace.

KSI supports teachers' professional judgment. AI-generated material is a draft for review, not an automatic teacher approval.

Access to school workspaces is managed by participating schools. An internet connection is required for core functions.

**Category:** Education
**Audience recommendation:** Adults (teachers, school leaders, school owners). Confirm actual intended audience and Play Console age targeting before submitting.
**Price:** Do not assert "free" or disclose pricing until the product owner confirms school subscription and access terms.
**Developer:** Confirm legal developer name in the Play Console account.

## Release notes
**First Play Store release:**
Introducing KAEC School Intelligence for Android. Prepare and review HQLS lesson plans, build assessments, support learner diagnosis and download teacher-validated lesson PDFs.

## Required assets
- App icon: 512 × 512 PNG, without unsupported transparency.
- Feature graphic: 1024 × 500 PNG/JPG.
- Minimum two real Android phone screenshots; recommend 4–8 (sign-in, HQLS lesson, manual validation, assessment, diagnosis, PDF action). Use authorised demo data only.
- Verify Play Console's current image limits and content rules before upload.
- Use the canonical KSI mark (`app/icon.svg`) and KAEC-NG endorsement; do not create a second product identity.

## Compliance and release blockers — DO NOT guess answers
1. **Privacy policy:** Public HTTPS URL with an accurate inventory of personal information, school/learner data, AI processing, processors, retention, access rights and contact information. This repository does not currently expose a verified public policy route. Legal/operator review required before publication.
2. **Account deletion:** Since KSI supports account creation, confirm an in-app deletion request path and public deletion URL, including school record retention and legitimate obligations. Implement and test; never promise immediate erasure of all school records.
3. **Data safety:** Complete Google Play Data Safety declarations from the real data flow and service providers, including Supabase authentication, school/learner records, uploaded resources, AI prompts/responses and diagnostic records where applicable. Verify encryption in transit, retention, sharing and deletion procedures.
4. **App access:** Provide Google reviewers a functional demo account or detailed instructions if school access codes/onboarding block entry. Avoid real learner information.
5. **Android target API:** The Android release workflow now enforces targetSdkVersion 36 (Android 16) in the generated Gradle app. Still inspect the signed AAB's manifest on the final build and verify Play Console accepts it.
6. **Google Play App Signing:** Enrol as required, preserve the existing upload key and check Play app-signing certificate fingerprint. If Google re-signs the Play build, update `/.well-known/assetlinks.json` with the **Play app-signing certificate** fingerprint in addition to the existing key; deploy and verify Digital Asset Links before production.
7. **Package registration:** Check whether `ng.name.ksi.lite` already exists in the intended Play Console developer account. Once an app is registered, its package name cannot be changed for updates.
8. **TWA quality:** Test verified full-screen mode, Android back navigation, external links, idle/resume recovery, sign-in and sign-out, file/PDF download in Chrome TWA and WebView fallback, Android permissions and network-loss behavior.
9. **Policies:** Complete app content declarations (ads, target audience, content rating, government/health/financial claims if applicable) truthfully; confirm current Play Console requirements.
10. **Release:** Increase `appVersionCode` beyond **5** for the new upload; generate a newly signed AAB via the existing workflow and verify its signature. Upload in the operator's authenticated Play Console session. No automatic production submission.

## Operator checklist
- [ ] Confirm whether KSI is a new Play Console listing and confirm developer account
- [ ] Confirm store title, audience, school-access/pricing policy, support email
- [ ] Review data inventory, privacy policy and deletion process
- [ ] Publish policy and deletion URLs after implementation and approval
- [ ] Verify Digital Asset Links for Play signing key
- [ ] Test signed AAB and all Android critical flows
- [ ] Prepare genuine screenshots and store graphics
- [ ] Complete Data Safety, App Access, content rating and policy declarations
- [ ] Increment version code, produce final signed AAB, upload and submit for review

This is a **submission preparation document**, not a declaration that Play Console requirements have been satisfied.

## First Google Play entry confirmed (2026-10-14)

The owner confirmed this is **KSI's first Google Play listing**. In Play Console create a new App (not Game), English (United States), name **KAEC School Intelligence**, free to install, category Education. The final AAB will register package `ng.name.ksi.lite`; do not create a second package name. The operator must confirm `kaecng@gmail.com` as the official privacy and deletion contact **before publishing the drafted app pages**.

**Current Google Play target-API policy:** Since August 31, 2026, a new mobile app needs API 36 unless an extension is granted. The launch candidate sets versionCode 6 and checks targetSdk 36 in the generated Android project; verify the final AAB and any other Play policy requirements.

**Privacy and deletion implementation:** A public policy route `/privacy` and web deletion request route `/delete-account` are prepared, plus in-app links. They initiate a **human-reviewed email deletion request**. There is no automated deletion engine; operational processing, service-provider deletion and any lawful record retention must be established by KAEC before declaring full compliance.

**Age and store listing:** KSI has adult school owner / teacher / leadership sign-in. Student-facing routes are retired; schools nevertheless upload learner records, potentially children's data. Mark only the actual age audience, and complete all Data Safety items truthfully.

**Play App Signing:** Google may use a different certificate to sign the distributed app. Add that certificate to `/.well-known/assetlinks.json` and verify Google Digital Asset Links before production publication. The existing SHA-256 is the sideload/update keystore, not automatically the Google Play distribution certificate.

**Review and publication:** PR preparation is not approval to disclose policy statements publicly. Approve the contact email and retention/deletion process, then merge the PR; verify runtime and Android build; finally submit the AAB via the trusted Play Console session.
