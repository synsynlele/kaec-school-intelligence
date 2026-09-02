# KSI Lite — Android distribution shell

KSI Lite is a Trusted Web Activity (TWA) wrapper around the production KSI web application. It is a distribution shell, not a reduced KSI product and not an HQLS Lite pathway.

## Production identity

- Display name: `KSI Lite`
- Package ID: `ng.name.ksi.lite`
- Current version: `1.0.0`
- Version code: `1`
- Production origin: `https://www.ksi.name.ng`
- Start route: `/sign-in`
- Minimum Android API: 21
- Bubblewrap toolchain: `1.25.0`
- Stable public APK URL: `https://github.com/synsynlele/kaec-school-intelligence/releases/latest/download/KSI-Lite.apk`

Normal KSI product, backend and AI changes remain web-first. The TWA loads the live KSI origin, so routine product releases do not require a new Android binary.

## Permanent signing identity

The production certificate SHA-256 fingerprint is pinned in `twa-manifest.production.json` and `public/.well-known/assetlinks.json`.

The keystore and its passwords must never be committed. The release workflow expects three GitHub Actions secrets:

- `KSI_ANDROID_KEYSTORE_B64`
- `KSI_ANDROID_KEYSTORE_PASSWORD`
- `KSI_ANDROID_KEY_PASSWORD`

Future Android wrapper releases must use the exact same production key. Increment `appVersionCode` and `appVersion`, then run the protected release workflow.

## Stage 17 pre-merge release gate

The release workflow also runs when Android distribution files change on the `stage17-ksi-lite-distribution` branch. Until the three protected signing secrets exist, that branch run is expected to stop at the signing-secret gate. Once the secrets are stored, rerun the failed job; it will verify the permanent certificate, build the signed APK/AAB and publish `KSI-Lite.apk` before the web landing-page download is allowed into production.

After Stage 17 is merged, normal wrapper releases are manual via `workflow_dispatch` and only needed when the Android wrapper itself changes.

## Release model

`.github/workflows/android-lite-release.yml` builds a signed APK and AAB with Bubblewrap and publishes a GitHub Release. The APK asset is always named `KSI-Lite.apk`, allowing the public landing page to use GitHub's stable `releases/latest/download` URL without a KSI web deployment for every wrapper version.
