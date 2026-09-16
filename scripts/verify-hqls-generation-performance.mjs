import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const route = await readFile(join(ROOT, "app/api/hqls/route.ts"), "utf8");
const engine = await readFile(join(ROOT, "lib/hqls/engine.ts"), "utf8");
const openai = await readFile(join(ROOT, "lib/ai/openai.ts"), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const requirement of [
  "HQLS_MAX_OUTPUT_TOKENS = 8000",
  "HQLS_STAGE_REPAIR_MAX_OUTPUT_TOKENS = 3500",
  "KSI_HQLS_OPENAI_MODEL",
  "configuredHqlsReasoningEffort",
  "promptCacheKey",
  'textVerbosity: "low"',
  'repairMode: "none" | "single_stage" | "full_lesson"',
  "KSI_HQLS_TIMING",
]) {
  assert(route.includes(requirement), `HQLS performance requirement missing: ${requirement}`);
}

assert(
  route.includes("const [workspace, input] = await Promise.all") &&
    route.includes("const [, resources] = await Promise.all"),
  "HQLS preflight work must remain parallelised.",
);
assert(
  route.includes('schemaName: "ksi_hqls_stage_repair"') &&
    route.includes("failedStages.length === 1"),
  "A single deterministic stage failure must use targeted repair rather than a full lesson rewrite.",
);
assert(
  !route.includes("maxOutputTokens: 14000"),
  "The HQLS generation path must not regress to the old 14k output ceiling.",
);
assert(
  engine.includes('HQLS_PROMPT_v1.4') &&
    engine.includes("roughly 250–450 words") &&
    !engine.includes("Do not artificially shorten Full Illumination"),
  "HQLS prompting must keep Full Illumination concise and objective-led.",
);
for (const requirement of [
  'OpenAIReasoningEffort = "none"',
  "input.model?.trim()",
  "prompt_cache_key",
  "prompt_cache_options",
  "verbosity: input.textVerbosity",
  '"gpt-5.6-terra"',
]) {
  assert(openai.includes(requirement), `OpenAI low-latency control missing: ${requirement}`);
}

console.log(
  "HQLS generation performance verification passed: concise output, cached low-reasoning first pass, targeted repair and parallel I/O are enforced.",
);
