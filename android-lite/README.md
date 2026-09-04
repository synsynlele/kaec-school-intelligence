# KSI Lite — Android distribution shell

KSI Lite is a Trusted Web Activity (TWA) wrapper around the production KSI web application. It is a distribution shell, not a reduced KSI product and not an HQLS Lite pathway.

## Production identity

- Display name: `KSI`
- Package ID: `ng.name.ksi.lite`
- Current version: `1.0.3`
- Version code: `4`
- Production origin: `https://www.ksi.name.ng`
- Start route: `/auth/resolve`
- Minimum Android API: 21
- Bubblewrap toolchain: `1.25.0`
- Stable public APK URL: `https://github.com/synsynlele/kaec-school-intelligence/releases/latest/download/KSI-Lite.apk`

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
