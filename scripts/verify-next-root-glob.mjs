import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pluginPackage = require.resolve("@next/eslint-plugin-next/package.json");
const pluginRequire = createRequire(pluginPackage);
const adapter = pluginRequire("fast-glob");
assert.equal(pluginRequire("fast-glob/package.json").name, "@ksi/next-root-glob");
const { getRootDirs } = pluginRequire("./dist/utils/get-root-dirs.js");
// A plugin upgrade must be reviewed if its adapter API consumption changes.
const source = readFileSync(pluginRequire.resolve("./dist/utils/get-root-dirs.js"), "utf8");
assert.match(source, /\.globSync\)\(rootDir/);
assert.match(source, /onlyDirectories: true/);
assert.deepEqual(Object.keys(adapter), ["globSync"]);

const root = mkdtempSync(join(tmpdir(), "ksi-lint-roots-"));
const originalCwd = process.cwd();
const a = join(root, "apps", "alpha");
const b = join(root, "apps", "beta");
try {
  mkdirSync(join(a, "pages"), { recursive: true });
  mkdirSync(join(b, "app"), { recursive: true });
  writeFileSync(join(root, "apps", "readme.txt"), "not a directory");
  const roots = (setting) => getRootDirs({ cwd: root, settings: { next: { rootDir: setting } } }).sort();
  assert.deepEqual(roots(undefined), [root]);
  assert.deepEqual(roots(a), [a]);
  assert.deepEqual(roots(`${root}/apps/*`), [a, b]);
  assert.deepEqual(roots(`${root}/apps/{alpha,beta}`), [a, b]);
  assert.deepEqual(roots([a, b]), [a, b]);
  assert.deepEqual(roots(`${root}/missing/*`), []);
  assert.deepEqual(roots(a.replaceAll("/", "\\")), [a]);
  assert.deepEqual(roots(`${root}/apps/**`), [a, join(a, "pages"), b, join(b, "app")].sort());
  process.chdir(root);
  assert.deepEqual(roots("apps/*"), ["apps/alpha", "apps/beta"]);
  assert.deepEqual(roots("apps/alpha"), ["apps/alpha"]);
  console.log("Next ESLint root discovery: scoped adapter and 10 directory cases passed.");
} finally {
  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
}
