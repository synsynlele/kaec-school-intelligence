import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [layout, transport, nextConfig] = await Promise.all([
  text("app/layout.tsx"),
  text("components/network/ksi-ai-transport.tsx"),
  text("next.config.ts"),
]);

assert(layout.includes("KsiAiTransport"), "Root layout must mount the resilient AI transport.");
assert(layout.includes("<KsiAiTransport />"), "Root layout must activate the AI transport before interactive generation.");

for (const required of [
  "https://kaec-school-intelligence.vercel.app",
  '"/api/diagnosis"',
  '"/api/assessment"',
  '"/api/hqls"',
  'requestMethod(input, init) !== "POST"',
  "currentUrl.origin !== window.location.origin",
]) {
  assert(transport.includes(required), `AI transport protection is missing: ${required}`);
}

for (const required of [
  'key: "Access-Control-Allow-Origin"',
  'key: "Access-Control-Allow-Methods"',
  'value: "POST, OPTIONS"',
  'key: "Access-Control-Allow-Headers"',
  'value: "Authorization, Content-Type"',
  'source: "/api/diagnosis"',
  'source: "/api/assessment"',
  'source: "/api/hqls"',
]) {
  assert(nextConfig.includes(required), `Direct AI API CORS protection is missing: ${required}`);
}

console.log("KSI resilient AI generation transport verification passed.");
