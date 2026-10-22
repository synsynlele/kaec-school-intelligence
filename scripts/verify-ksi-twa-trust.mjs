import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const pattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export async function verifyKsiTwaTrust({
  expectedPlaySha256 = process.env.KSI_PLAY_APP_SIGNING_SHA256 || "",
  checkLive = process.argv.includes("--live"),
} = {}) {
  const [twa, links, workflow] = await Promise.all([
    readJson("android-lite/twa-manifest.production.json"),
    readJson("public/.well-known/assetlinks.json"),
    readFile(".github/workflows/android-lite-release.yml", "utf8"),
  ]);
  assert.equal(twa.packageId, "ng.name.ksi.lite", "Unexpected KSI Android package.");
  assert.equal(twa.host, "www.ksi.name.ng", "TWA host must match the canonical HTTPS website.");
  assert.equal(twa.startUrl, "/auth/resolve", "TWA must launch on the canonical website.");

  const productionUploadKey = twa.fingerprints?.find(
    (entry) => entry.name === "KSI Lite production key",
  )?.value;
  assert.match(productionUploadKey ?? "", pattern, "Production APK upload key must be a valid SHA-256 fingerprint.");
  assert(Array.isArray(links), "Digital Asset Links must contain a JSON array.");

  const matching = links.filter((entry) =>
    entry.relation?.includes("delegate_permission/common.handle_all_urls") &&
    entry.target?.namespace === "android_app" &&
    entry.target?.package_name === twa.packageId
  );
  assert.equal(matching.length, 1, "KSI must publish one trusted package binding containing all signer fingerprints.");

  const fingerprintList = matching[0].target.sha256_cert_fingerprints;
  assert(Array.isArray(fingerprintList) && fingerprintList.length > 0,
    "Digital Asset Links must publish signer SHA-256 fingerprints.");
  for (const fingerprint of fingerprintList) {
    assert.match(fingerprint, pattern, "Malformed Android SHA-256 signing fingerprint.");
  }
  assert.equal(new Set(fingerprintList).size, fingerprintList.length,
    "Duplicate Android signing fingerprint in Digital Asset Links.");
  assert(fingerprintList.includes(productionUploadKey),
    "Keep the permanent downloadable APK certificate in Digital Asset Links.");

  if (expectedPlaySha256) {
    const playKey = expectedPlaySha256.trim();
    assert.match(playKey, pattern, "Play App Signing SHA-256 must be uppercase colon-separated bytes.");
    assert(fingerprintList.includes(playKey),
      "Google Play App Signing certificate is missing from Digital Asset Links. Add it alongside the permanent APK signing certificate.");
  } else {
    console.log("Play App Signing certificate not supplied; fullscreen verification for Play-installed KSI cannot be confirmed.");
  }

  // Updating this web-hosted file must not rebuild/clobber a Play AAB or APK.
  assert(!/^\s+- public\/\.well-known\/assetlinks\.json\s*$/m.test(workflow),
    "Changing assetlinks.json must not trigger a signed Android release.");

  if (checkLive) {
    const origin = "https://" + twa.host;
    const response = await fetch(origin + "/.well-known/assetlinks.json", { redirect: "manual" });
    assert.equal(response.status, 200, "Digital Asset Links must be served with HTTP 200, without redirect.");
    const contentType = response.headers.get("content-type") || "";
    assert(contentType.includes("application/json"),
      "Digital Asset Links should be served as application/json.");
    const live = await response.json();
    const liveBinding = live.find((entry) =>
      entry.target?.package_name === twa.packageId &&
      entry.relation?.includes("delegate_permission/common.handle_all_urls")
    );
    assert(liveBinding, "Live website missing the KSI Android binding.");
    const expected = expectedPlaySha256 ? [productionUploadKey, expectedPlaySha256.trim()] : [productionUploadKey];
    for (const fingerprint of expected) {
      assert(liveBinding.target.sha256_cert_fingerprints?.includes(fingerprint),
        "Live Digital Asset Links missing fingerprint " + fingerprint);
      const url = new URL("https://digitalassetlinks.googleapis.com/v1/assetlinks:check");
      url.searchParams.set("source.web.site", origin);
      url.searchParams.set("relation", "delegate_permission/common.handle_all_urls");
      url.searchParams.set("target.androidApp.packageName", twa.packageId);
      url.searchParams.set("target.androidApp.certificate.sha256Fingerprint", fingerprint);
      const verification = await fetch(url);
      assert.equal(verification.status, 200, "Google Digital Asset Links verification API request failed.");
      const verdict = await verification.json();
      assert(verdict.linked === true,
        "Google does not verify Android signer " + fingerprint + " for " + origin);
    }
    console.log("KSI Digital Asset Links verified live on " + origin + ".");
  }
  console.log("KSI Trusted Web Activity certificate configuration checks passed.");
}

await verifyKsiTwaTrust();
