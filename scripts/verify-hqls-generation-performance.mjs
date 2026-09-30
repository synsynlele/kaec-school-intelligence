import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const route = await readFile(join(ROOT, "app/api/hqls/route.ts"), "utf8");
const engine = await readFile(join(ROOT, "lib/hqls/engine.ts"), "utf8");
const openai = await readFile(join(ROOT, "lib/ai/openai.ts"), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Guard the latency work as part of KSI's structural release checks so later
// refactors cannot silently restore the old full-repair / oversized-output path.
// This verification intentionally travels with the product code into release CI.
for (const requirement of [
  "HQLS_MAX_OUTPUT_TOKENS = 8000",
  "HQLS_STAGE_REPAIR_MAX_OUTPUT_TOKENS = 3500",
  "KSI_HQLS_OPENAI_MODEL",
  '"gpt-5.6-terra"',
  "configuredHqlsReasoningEffort",
  "promptCacheKey",
  'textVerbosity: "low"',
  'repairMode: "none" | "single_stage" | "parallel_stages" | "full_lesson"',
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
    route.includes("failedStages.length === 1") &&
    route.includes('repairMode !== "full_lesson"') &&
    route.includes("KSI_HQLS_FIDELITY_FAILED"),
  "HQLS generation must use targeted repair first, escalate one unresolved edge case to a full repair, and retain safe failure diagnostics.",
);
assert(
  !route.includes("maxOutputTokens: 14000"),
  "The HQLS generation path must not regress to the old 14k output ceiling.",
);
assert(
  !engine.includes("micro.teacherPrompts.length > 3") &&
    !engine.includes("micro.learnerActions.length > 1") &&
    engine.includes("Micro-Illumination is checked by function, not field counts"),
  "Micro-Illumination fidelity must not reject valid minimal-clarity stages because of prompt/action counts; only genuine premature task behaviour may fail.",
);


assert(
  engine.includes('HQLS_PROMPT_v1.16') &&
    engine.includes("PLAIN-ENGLISH RULES FOR EVERY STAGE") &&
    engine.includes("BENCHMARK TEACHER-PLAN SHAPE") &&
    engine.includes("teacherPrompts must be short exact words or actions") &&
    engine.includes("roughly 400–650 words") &&
    engine.includes("use up to about 750") &&
    engine.includes("serious teaching core, not a chapter") &&
    engine.includes("without needing a separate lesson note") &&
    engine.includes("SUSPENSE BEFORE FULL ILLUMINATION") &&
    engine.includes("Awakening (Curiosity & Meaning) → Exploration (Crude Thinking) → Micro-Illumination (Minimal Clarity) → Trial (First Attempt)") &&
    engine.includes("pre_illumination_topic_revealed") &&
    engine.includes("micro_illumination_becomes_task") &&
    engine.includes("topicRevealCandidates") &&
    engine.includes("3–5 short oral questions") &&
    engine.includes("up to three brief guiding questions") &&
    engine.includes("2–4 clear outputs") &&
    engine.includes("identity connection") &&
    !engine.includes("Do not artificially shorten Full Illumination"),
  "HQLS prompting must keep teacher actions plain-English, preserve the Curiosity & Meaning → Crude Thinking → Minimal Clarity → First Attempt flow, conceal the formal topic through Stage 4, permit rich Exploration and guiding Micro-Illumination without premature teaching, and keep Full Illumination teacher-ready and substantial.",
);
for (const requirement of [
  'OpenAIReasoningEffort = "none"',
  "input.model?.trim()",
  "prompt_cache_key",
  "prompt_cache_options",
  "verbosity: input.textVerbosity",
  '"gpt-5-mini"',
]) {
  assert(openai.includes(requirement), `OpenAI low-latency control missing: ${requirement}`);
}

console.log(
  "HQLS generation performance verification passed: HQLS-specific Terra selection, platform cost fallback, concise output, cached low-reasoning first pass, targeted repair and parallel I/O are enforced.",
);
