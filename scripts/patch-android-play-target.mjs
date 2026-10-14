// Bubblewrap generates Gradle source from a pinned template during release.
// Protect first Play upload against an out-of-date target SDK in that template.
import { readFile, writeFile } from "node:fs/promises";

const gradleFile = process.argv[2];
if (!gradleFile) throw new Error("Pass the generated app/build.gradle path.");

let source = await readFile(gradleFile, "utf8");

function bumpSdk(pattern, label) {
  const found = [...source.matchAll(pattern)];
  if (found.length !== 1) {
    throw new Error(`Expected exactly one generated ${label} in Gradle; found ${found.length}. Refusing unsafe patch.`);
  }
  const match = found[0];
  const current = Number(match[2]);
  if (!Number.isInteger(current) || current < 1) {
    throw new Error(`Invalid generated ${label}: ${match[2]}`);
  }
  if (current < 36) {
    source = source.replace(match[0], `${match[1]}36`);
    console.log(`KSI Play: raised ${label} from ${current} to 36.`);
  } else {
    console.log(`KSI Play: ${label}=${current} meets API 36 minimum.`);
  }
}

bumpSdk(/(\bcompileSdk(?:Version)?\s*(?:=\s*)?)(\d+)/g, "compileSdk");
bumpSdk(/(\btargetSdk(?:Version)?\s*(?:=\s*)?)(\d+)/g, "targetSdk");

await writeFile(gradleFile, source);
