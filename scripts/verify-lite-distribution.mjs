import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const usesCanonicalIcon = (url) => {
  try {
    return new URL(url).pathname.endsWith("/app/icon.png");
  } catch {
    return false;
  }
};

const [
  layout,
  landing,
  distribution,
  manifest,
  pwaIconRenderer,
  twaText,
  bootstrapText,
  assetlinks,
] = await Promise.all([
  text("app/layout.tsx"),
  text("app/page.tsx"),
  text("components/pwa/landing-distribution-button.tsx"),
  text("app/manifest.ts"),
  text("lib/pwa/render-icon.ts"),
  text("android-lite/twa-manifest.production.json"),
  text("public/ksi-lite-bootstrap.webmanifest"),
  text("public/.well-known/assetlinks.json"),
]);

const twa = JSON.parse(twaText);
const bootstrap = JSON.parse(bootstrapText);

for (const required of [
  'manifest: "/manifest.webmanifest"',
  "beforeinstallprompt",
  'document.referrer.startsWith("android-app://")',
  'new Event("ksi:install-state")',
]) {
  assert(layout.includes(required), `KSI install capture is missing: ${required}`);
}

assert(
  landing.includes("LandingDistributionButton"),
  "The public landing page must expose the KSI distribution control.",
);

for (const required of [
  'DistributionMode = "hidden" | "android" | "desktop"',
  "Android|iPhone|iPad|iPod|Mobile",
  "isDesktopChromium",
  "Download App",
  "Install App",
  "releases/latest/download/KSI-Lite.apk",
  "await promptEvent.prompt()",
]) {
  assert(distribution.includes(required), `KSI distribution behavior is missing: ${required}`);
}

for (const required of [
  'start_url: "/sign-in"',
  'scope: "/"',
  'display: "standalone"',
  'sizes: "192x192"',
  'sizes: "512x512"',
]) {
  assert(manifest.includes(required), `KSI PWA manifest is missing: ${required}`);
}

assert(
  pwaIconRenderer.includes('"https://www.ksi.name.ng/icon.png"'),
  "KSI PWA icons must render from the canonical KSI favicon asset (/icon.png).",
);

assert(twa.packageId === "ng.name.ksi.lite", "KSI Lite package identity changed.");
assert(twa.host === "www.ksi.name.ng", "KSI Lite production host changed.");
assert(twa.startUrl === "/sign-in", "KSI Lite start route changed.");
assert(twa.name === "KSI", "The installed Android app name must be KSI.");
assert(twa.launcherName === "KSI", "The Android launcher label must be KSI.");
assert(
  typeof twa.appVersion === "string" && /^\d+\.\d+\.\d+$/.test(twa.appVersion),
  "KSI Lite appVersion must be semantic versioning.",
);
assert(
  Number.isInteger(twa.appVersionCode) && twa.appVersionCode >= 1,
  "KSI Lite appVersionCode must be a positive integer.",
);
assert(
  twa.fingerprints?.some(
    ({ value }) =>
      value ===
      "10:5B:EB:D5:27:D9:85:73:43:BF:10:A5:AA:9D:E0:0A:3E:7D:0A:E2:BC:9C:20:2C:2C:59:6C:B4:66:B6:85:DD",
  ),
  "KSI Lite permanent production signing certificate changed.",
);
assert(
  usesCanonicalIcon(twa.iconUrl) && usesCanonicalIcon(twa.maskableIconUrl),
  "KSI Lite launcher and maskable icons must use the canonical KSI app/favicon asset (app/icon.png).",
);
assert(
  bootstrap.icons?.some(({ src }) => usesCanonicalIcon(src)),
  "KSI Lite bootstrap manifest must use the canonical KSI app/favicon asset (app/icon.png).",
);

assert(
  assetlinks.includes('"package_name": "ng.name.ksi.lite"'),
  "Digital Asset Links must bind the permanent KSI Lite package.",
);
assert(
  !distribution.includes("HQLS Lite"),
  "KSI Lite must never create an HQLS Lite methodology or product pathway.",
);

console.log("KSI Lite distribution verification passed.");
