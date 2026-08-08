import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const text = (path) => readFile(join(ROOT, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const openai = await text("lib/ai/openai.ts");
for (const required of [
  "KSI_OPENAI_PRIMARY_MODEL",
  "KSI_OPENAI_REPAIR_MODEL",
  '"gpt-5-nano"',
  '"gpt-5-mini"',
  'modelRole: "primary"',
  'modelRole: "repair"',
  '.includes("repair")',
]) {
  assert(openai.includes(required), `AI cost policy is missing ${required}.`);
}
assert(
  openai.indexOf("KSI_OPENAI_PRIMARY_MODEL") < openai.indexOf("KSI_OPENAI_MODEL"),
  "Preview-safe primary model override must take precedence over the legacy model variable.",
);
assert(
  !openai.includes('||\n    "gpt-5.6-terra"'),
  "AI cost policy must not silently fall back to the former Terra default.",
);

const env = await text(".env.example");
assert(
  env.includes("KSI_OPENAI_PRIMARY_MODEL=gpt-5-nano"),
  "Environment example must document gpt-5-nano as the primary benchmark model.",
);
assert(
  env.includes("KSI_OPENAI_REPAIR_MODEL=gpt-5-mini"),
  "Environment example must document gpt-5-mini as repair fallback.",
);

console.log(
  "AI cost-policy verification passed: KSI uses nano-first structured generation with mini repair fallback while retaining legacy environment compatibility.",
);
