# KSI Android Play Store acceptance tests

Run these on a real Android device using the final signed release candidate and a dedicated demo school with no real learner data.

| Area | Test | Expected |
|---|---|---|
| Identity | Install signed bundle, inspect icon and label | KSI icon sharp; launcher name KSI |
| Trust | Open app with Chrome TWA provider | Verified app opens without browser chrome |
| Trust | Inspect hosted assetlinks against Play signing cert | Package and SHA-256 fingerprint match |
| Access | Sign in as school owner and teacher | Correct governed workspace, no privilege escalation |
| Access | Sign out and relaunch | No previous user's protected data |
| Onboarding | Enter staff access code | Valid code succeeds, invalid code shows useful error |
| Lessons | Generate HQLS lesson | Seven stages shown, draft retained |
| Lessons | Edit lesson and save draft | Changes persist, no unrequested validation |
| Lessons | Validate from result page | Teacher approval persisted; PDF button becomes active immediately |
| Lessons | Click PDF button | PDF downloads/opens, branded, readable, no blank pages |
| Assessment | Generate, edit, export | Expected controls work on small phone |
| Diagnosis | Create, review, export | Private learner information protected |
| Lifecycle | Background app for several minutes, resume | No crashed tab; authentication recovered |
| Navigation | Android Back, links, rotation | No trapping or unexpected sign-out |
| Network | Offline and interrupted connection | Recoverable error, no silent data loss |
| Fallback | Run without working TWA provider | WebView fallback remains usable |
| Policy | Open privacy and deletion links | Public HTTPS pages, accessible without sign-in |
| Review | Use Play reviewer demo credentials | Reviewers can access core functions without real school data |

**Release gate:** Any failure affecting login, teacher approval, PDF export, data privacy, Play signing or app access blocks Play submission. Record device model, Android version, app version code, date and result for each test.

## Android API 36 release gate

Inspect the generated project under `android-lite/generated-production/app/build.gradle` and read the final signed AAB manifest to confirm target API >= 36. Record the Play App Signing certificate SHA-256 and verify `/.well-known/assetlinks.json` on a real device. Make sure API 36 Android back handling, PDF downloading and resume recovery work.
