# KSI Lite — Android distribution shell

KSI Lite is a Trusted Web Activity (TWA) wrapper around the production KSI web application. It is a distribution shell, not a reduced KSI product and not an HQLS Lite pathway.

## Production identity

- Display name: `KSI`
- Package ID: `ng.name.ksi.lite`
- Current version: `1.0.5`
- Version code: `6`
- Production origin: `https://www.ksi.name.ng`
- Start route: `/auth/resolve`
- Minimum Android API: 21
- Bubblewrap toolchain: `1.25.0`
- Stable public APK URL: `https://github.com/synsynlele/kaec-school-intelligence/releases/latest/download/KSI-Lite.apk`

The 1.0.5 Android release packages the current KSI product mark as its launcher icon. Existing 1.0.3 installations need the new signed APK to update their launcher icon.

Normal KSI product, backend and AI changes remain web-first. The TWA loads the live KSI origin, so routine product releases do not require a new Android binary.

The production launcher prefers Chrome's TWA engine when Chrome is available. If a device has no working TWA provider, it uses Android Browser Helper's WebView fallback, which recreates a renderer that is reclaimed or crashes while the app is idle.

## Permanent signing identity

The production certificate SHA-256 fingerprint is pinned in `twa-manifest.production.json` and `public/.well-known/assetlinks.json`.

The keystore and its password must never be committed. The production keystore is PKCS#12, so Bubblewrap uses the keystore password for both store and private-key access. The release workflow expects two GitHub Actions secrets:

- `KSI_ANDROID_KEYSTORE_B64`
- `KSI_ANDROID_KEYSTORE_PASSWORD`

A previously created `KSI_ANDROID_KEY_PASSWORD` repository secret may remain in GitHub, but the production workflow does not consume it.

Future Android wrapper releases must use the exact same production key. Increment `appVersionCode` and `appVersion`, then run the protected release workflow.

## Stage 17 pre-merge release gate

The release workflow also runs when Android distribution files change on the `stage17-ksi-lite-distribution` branch. Until the protected signing secrets exist, that branch run is expected to stop at the signing-secret gate. Once the secrets are stored, rerun the failed job; it will verify the permanent certificate, build the signed APK/AAB and publish `KSI-Lite.apk` before the web landing-page download is allowed into production.

After Stage 17 is merged, normal wrapper releases are manual via `workflow_dispatch` and only needed when the Android wrapper itself changes.

## Release model

`.github/workflows/android-lite-release.yml` builds a signed APK and AAB with Bubblewrap and publishes a GitHub Release. The APK asset is always named `KSI-Lite.apk`, allowing the public landing page to use GitHub's stable `releases/latest/download` URL without a KSI web deployment for every wrapper version.

## Google Play launch candidate

This 1.0.5 / versionCode 6 build is the proposed first Play upload. The release workflow enforces API 36 (Android 16) in the generated Gradle app before signing. Google Play App Signing may issue a different *app-signing* certificate; once shown in Play Console, add that SHA-256 to `public/.well-known/assetlinks.json` without deleting the existing APK fingerprint, and verify it on the live HTTPS origin.

A signed AAB alone does not establish Google Play compliance. Approve privacy policy, deletion response workflow, app access instructions, data safety and manual Android QA before submitting.


## Full-screen trust and Google Play signing

KSI Lite must launch as a verified Trusted Web Activity to hide Android's X/cancel + app-name Custom Tab toolbar. This toolbar is not part of the website and cannot be removed with CSS. When Digital Asset Links verification fails, Android intentionally displays a Custom Tab with a visible toolbar.

The canonical origin is https://www.ksi.name.ng. The association file is served at https://www.ksi.name.ng/.well-known/assetlinks.json. The site currently recognises the permanent APK/upload signing certificate 10:5B:EB:D5:27:D9:85:73:43:BF:10:A5:AA:9D:E0:0A:3E:7D:0A:E2:BC:9C:20:2C:2C:59:6C:B4:66:B6:85:DD. Google's Digital Asset Links API verified that association on 2026-10-22.

**Google Play App Signing may use a different SHA-256 fingerprint from the APK/upload certificate.** The Play SHA-256 for package ng.name.ksi.lite must be obtained from Google Play Console → KSI → App integrity → App signing → App signing key certificate → SHA-256 certificate fingerprint. The certificate fingerprint is public information, not a signing password or private key. The Play certificate could not be recovered during the 2026-10-22 read-only Play Console inspection; do not invent it.

Once obtained, add the exact Play app-signing SHA-256 fingerprint to the existing sha256_cert_fingerprints array in public/.well-known/assetlinks.json, **retaining** the existing APK/upload certificate. Do not change the package name.

Run with the real full fingerprint in an environment variable:

    KSI_PLAY_APP_SIGNING_SHA256="YOUR:PLAY:SHA256:..." node scripts/verify-ksi-twa-trust.mjs

Commit and deploy the website. After deployment, run the same command with --live to check HTTP 200, JSON content type, zero redirects, SHA fingerprints and Google's Digital Asset Links API verification of both keys.

This is a **website association fix**, not a binary feature change. Do not rebuild or submit a new Android bundle solely to add Google's signer to the website. The Android release workflow does not trigger on assetlinks-only changes.

For existing Android installations, update Chrome and open KSI again. If Android has cached a failure, a fresh install of the appropriate APK/Play build may be necessary; warn users that this can clear local sign-in data. External Google OAuth domains may legitimately display browser controls and should not be hidden.

**Diagnose based on installation source:** the GitHub APK uses the known upload certificate, while a Google Play installation uses Play App Signing. If the GitHub APK still shows browser chrome despite valid association, inspect its Chrome/TWA provider, canonical launch origin and Android verification cache rather than assuming a Play-signing mismatch.

References:
- https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2
- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start/
- https://developer.android.com/training/app-links/verify-applinks
