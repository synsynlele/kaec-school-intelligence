import { readFile, writeFile } from "node:fs/promises";

const launcherPath = process.argv[2];
if (!launcherPath) {
  throw new Error("Pass the generated LauncherActivity.java path.");
}

const marker = "    @Override\n    protected Uri getLaunchingUrl()";
const chromeTwaOverride = `    @Override
    protected com.google.androidbrowserhelper.trusted.TwaLauncher createTwaLauncher() {
        try {
            getPackageManager().getPackageInfo("com.android.chrome", 0);
            return new com.google.androidbrowserhelper.trusted.TwaLauncher(
                    this, "com.android.chrome");
        } catch (android.content.pm.PackageManager.NameNotFoundException ignored) {
            return super.createTwaLauncher();
        }
    }

`;

const source = await readFile(launcherPath, "utf8");
if (source.includes('this, "com.android.chrome"')) {
  console.log("KSI Lite launcher already prefers Chrome TWA.");
  process.exit(0);
}
if (!source.includes(marker)) {
  throw new Error("Bubblewrap LauncherActivity marker changed; refusing an unsafe patch.");
}

await writeFile(launcherPath, source.replace(marker, `${chromeTwaOverride}${marker}`));
console.log("KSI Lite launcher patched to prefer Chrome TWA with recoverable fallback.");
