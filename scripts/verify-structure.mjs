import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

async function text(path) {
  return readFile(join(ROOT, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedStages = [
  'key: "awakening"',
  'key: "exploration"',
  'key: "micro_illumination"',
  'key: "trial_first"',
  'key: "full_illumination"',
  'key: "trial_second"',
  'key: "integration"',
];

const hqls = await text("lib/domain/hqls.ts");
let previousIndex = -1;
for (const stage of expectedStages) {
  const index = hqls.indexOf(stage);
  assert(index >= 0, `Missing constitutional HQLS stage: ${stage}`);
  assert(index > previousIndex, `HQLS stages are not in constitutional order at ${stage}`);
  previousIndex = index;
}
assert(
  hqls.includes('"full_teaching_before_first_struggle"'),
  "HQLS automatic-failure rule for teaching before struggle is missing.",
);
assert(
  hqls.includes('"integration_missing"'),
  "HQLS automatic-failure rule for missing reflection/integration is missing.",
);

const migrationFiles = (await readdir(join(ROOT, "supabase/migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
assert(migrationFiles.length >= 11, "Stage 1 migration set is incomplete.");

const prefixes = migrationFiles.map((name) => name.split("_")[0]);
assert(
  new Set(prefixes).size === prefixes.length,
  `Duplicate local migration versions detected: ${migrationFiles.join(", ")}`,
);

const lessonMigration = await text(
  "supabase/migrations/008_stage1_hqls_lesson_structure.sql",
);
for (const [number, key] of [
  [1, "awakening"],
  [2, "exploration"],
  [3, "micro_illumination"],
  [4, "trial_first"],
  [5, "full_illumination"],
  [6, "trial_second"],
  [7, "integration"],
]) {
  assert(
    lessonMigration.includes(`stage_number = ${number} and stage_key = '${key}'`),
    `Database does not enforce HQLS stage ${number} → ${key}.`,
  );
}
assert(
  lessonMigration.includes("create_hqls_lesson_draft"),
  "Atomic HQLS lesson-draft RPC is missing.",
);

const diagnosisIntegrity = await text(
  "supabase/migrations/009_stage1_diagnosis_review_integrity.sql",
);
assert(
  diagnosisIntegrity.includes("review_diagnosis"),
  "Diagnosis review RPC is missing.",
);
assert(
  diagnosisIntegrity.includes("finalise_diagnosis"),
  "Diagnosis finalisation RPC is missing.",
);

const storageIntegrity = await text(
  "supabase/migrations/006_stage1_resource_storage_integrity.sql",
);
assert(
  storageIntegrity.includes("private.is_workspace_member"),
  "Private resource storage is not bound to workspace membership.",
);

const productCodePaths = ["app", "components", "lib"];
for (const rootPath of productCodePaths) {
  const queue = [rootPath];
  while (queue.length) {
    const current = queue.shift();
    const entries = await readdir(join(ROOT, current), { withFileTypes: true });
    for (const entry of entries) {
      const relative = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(relative);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
      const source = await text(relative);
      assert(
        !source.includes("SUPABASE_SERVICE_ROLE_KEY") &&
          !source.includes("service_role") &&
          !source.includes("pipupath-staging"),
        `Forbidden privileged credential or PipuPath backend reference found in ${relative}.`,
      );
      assert(
        !source.includes("GEMINI_API_KEY") &&
          !source.includes("generateGemini") &&
          !source.includes("GeminiProviderError"),
        `Obsolete Gemini Stage 2 provider reference found in ${relative}.`,
      );
    }
  }
}

const health = await text("app/api/health/route.ts");
assert(
  health.includes("zaoxfjbiizargeclnzmo.supabase.co"),
  "Health contract no longer pins the dedicated KSI Supabase project.",
);

const stage2Spec = await text("docs/STAGE_2_HQLS_LESSON_INTELLIGENCE.md");
assert(
  stage2Spec.includes("Generate seven-stage HQLS lesson") &&
    stage2Spec.includes("Independent Validation"),
  "Stage 2 HQLS acceptance contract is missing or incomplete.",
);
assert(
  stage2Spec.includes("OpenAI Responses API") &&
    stage2Spec.includes("Authenticated live OpenAI generation E2E"),
  "Stage 2 specification does not declare OpenAI as the active provider path.",
);
assert(
  !stage2Spec.includes("Gemini"),
  "Stage 2 specification still contains obsolete Gemini provider references.",
);

const stage2Engine = await text("lib/hqls/engine.ts");
for (const required of [
  "HQLS_ENGINE_v1.0",
  "HQLS_PROMPT_v1.1",
  "validateHqlsLesson",
  "full_illumination_ignores_revealed_gaps",
  "trial_second_has_no_genuine_reattempt",
  "integration_reflection_missing",
  "reflectionPrompt",
  "teaching_content_outside_full_illumination",
]) {
  assert(
    stage2Engine.includes(required),
    `Stage 2 HQLS engine is missing ${required}.`,
  );
}

const stage2Route = await text("app/api/hqls/route.ts");
assert(
  stage2Route.includes("createLesson"),
  "Stage 2 route does not use canonical lesson persistence.",
);
assert(
  stage2Route.includes("hqls_fidelity_checks") &&
    stage2Route.includes("artifact_resource_links"),
  "Stage 2 route is missing HQLS fidelity or source-provenance persistence.",
);
assert(
  stage2Route.includes('action === "save_edits"') &&
    stage2Route.includes('action === "regenerate_stage"'),
  "Stage 2 route is missing edit or stage-regeneration flow.",
);
assert(
  stage2Route.includes('provider: "openai"') &&
    stage2Route.includes("generateOpenAIJson"),
  "Stage 2 route is not wired to OpenAI generation/provenance.",
);
assert(
  !stage2Route.includes("Gemini") && !stage2Route.includes('provider: "google"'),
  "Stage 2 route still contains obsolete Gemini/Google provider wiring.",
);

const openai = await text("lib/ai/openai.ts");
assert(
  openai.includes("process.env.OPENAI_API_KEY"),
  "OpenAI server credential lookup is missing.",
);
assert(
  openai.includes("https://api.openai.com/v1/responses"),
  "OpenAI adapter is not using the Responses API.",
);
assert(
  openai.includes('type: "json_schema"') && openai.includes("strict: true"),
  "OpenAI adapter is not using strict Structured Outputs.",
);
assert(
  openai.includes("store: false"),
  "OpenAI generation requests must explicitly disable provider response storage for KSI Stage 2.",
);
assert(
  !openai.includes("NEXT_PUBLIC_OPENAI"),
  "OpenAI credential must never be public/browser-scoped.",
);

const hqlsClient = await text("components/hqls/hqls-client.tsx");
assert(
  hqlsClient.includes("/api/hqls"),
  "HQLS teacher UI is not connected to the secure server route.",
);
assert(
  hqlsClient.includes("Reflection — how thinking changed") &&
    hqlsClient.includes("payload.validation"),
  "HQLS teacher UI must expose explicit reflection and fidelity failure details.",
);
for (const action of [
  "Improve",
  "Simplify",
  "Increase Challenge",
  "Make More Practical",
  "Reduce Resource Dependence",
  "Regenerate",
]) {
  assert(hqlsClient.includes(action), `HQLS stage action is missing: ${action}`);
}

console.log(
  `Stage 2 structural verification passed: ${expectedStages.length} HQLS stages, ${migrationFiles.length} unique Stage 1 migrations, governed HQLS engine/validator/OpenAI Responses route/UI present.`,
);
