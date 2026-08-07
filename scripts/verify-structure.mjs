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

const lessonMigration = await text("supabase/migrations/008_stage1_hqls_lesson_structure.sql");
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
assert(diagnosisIntegrity.includes("review_diagnosis"), "Diagnosis review RPC is missing.");
assert(diagnosisIntegrity.includes("finalise_diagnosis"), "Diagnosis finalisation RPC is missing.");

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
    }
  }
}

const health = await text("app/api/health/route.ts");
assert(
  health.includes("zaoxfjbiizargeclnzmo.supabase.co"),
  "Health contract no longer pins the dedicated KSI Supabase project.",
);

console.log(
  `Stage 1 structural verification passed: ${expectedStages.length} HQLS stages, ${migrationFiles.length} unique migrations, tenant/storage/diagnosis guards present.`,
);
