import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [layout, landing, distribution, manifest, twa, assetlinks] = await Promise.all([
  text("app/layout.tsx"),
  text("app/page.tsx"),
  text("components/pwa/landing-distribution-button.tsx"),
  text("app/manifest.ts"),
  text("android-lite/twa-manifest.production.json"),
  text("public/.well-known/assetlinks.json"),
]);

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

for (const required of [
  '"packageId": "ng.name.ksi.lite"',
  '"host": "www.ksi.name.ng"',
  '"startUrl": "/sign-in"',
  '"appVersion": "1.0.0"',
  '"value": "10:5B:EB:D5:27:D9:85:73:43:BF:10:A5:AA:9D:E0:0A:3E:7D:0A:E2:BC:9C:20:2C:2C:59:6C:B4:66:B6:85:DD"',
]) {
  assert(twa.includes(required), `KSI Lite production identity is missing: ${required}`);
}

assert(
  assetlinks.includes('"package_name": "ng.name.ksi.lite"'),
  "Digital Asset Links must bind the permanent KSI Lite package.",
);
assert(
  !distribution.includes("HQLS Lite"),
  "KSI Lite must never create an HQLS Lite methodology or product pathway.",
);

console.log("KSI Lite distribution verification passed.");
