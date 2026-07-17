"use strict";
const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "pages-files.json");
const { buildArtifact, isTracked, validateManifest } = require("./build-pages-artifact");

function listFiles(root, current = "") {
  return fs.readdirSync(path.join(root, current), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(current.replaceAll("\\", "/"), entry.name);
      return entry.isDirectory() ? listFiles(root, relative) : [relative];
    })
    .sort();
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.strictEqual(manifest.length, 69);
assert.strictEqual(new Set(manifest).size, manifest.length);
assert.strictEqual(
  crypto.createHash("sha256").update(manifest.join("\n")).digest("hex"),
  "6792d9d3f2814b110de12120359239eb5b5985e262402ab6eb2c14701469beed",
  "manifest 必須精確維持切換前 69-file allowlist 與順序"
);
for (const required of [
  "index.html", "admin.html", ".nojekyll", "VERSION", "design.md", "project-rules.md",
  "assets/app-settings.js", "assets/filter-rules.js", "assets/search-logic.js",
  "assets/auth-logic.js", "scripts/smoke-live-site.ps1"
]) {
  assert(manifest.includes(required), "manifest 缺少 " + required);
}
for (const forbidden of [
  "AGENTS.md", "firebase.json", "firestore.rules", "functions/index.js",
  ".github/workflows/deploy-pages.yml", "firebase-debug.log"
]) {
  assert(!manifest.includes(forbidden), "manifest 不得包含 " + forbidden);
}

assert.throws(() => validateManifest([...manifest, manifest[0]], repoRoot), /重複/);
assert.throws(() => validateManifest(["../secret.txt"], repoRoot), /不安全/);
assert.throws(() => validateManifest(["functions/index.js"], repoRoot), /禁止發布/);
assert.throws(() => validateManifest(["assets\\search-logic.js"], repoRoot), /斜線/);
assert.throws(() => validateManifest(["missing-file.txt"], repoRoot), /找不到/);
assert.strictEqual(isTracked(repoRoot, "firebase-debug.log"), false);
childProcess.execFileSync(
  process.execPath,
  [path.join(__dirname, "test-static-asset-versions.js")],
  { cwd: repoRoot, stdio: "pipe" }
);
const canonicalVersion = fs.readFileSync(path.join(repoRoot, "VERSION"), "utf8").trim();
const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
assert(
  indexHtml.includes('const APP_VERSION_FALLBACK = "' + canonicalVersion + '";'),
  "APP_VERSION_FALLBACK 必須等於 VERSION"
);

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "nearby-good-eats-pages-"));
const result = buildArtifact({ repoRoot, manifestPath, outputDir });
assert.strictEqual(result.manifestCount, manifest.length);
assert.strictEqual(result.copiedCount, manifest.length);
assert.strictEqual(result.entryFile, "index.html");
assert.strictEqual(result.version, canonicalVersion);
assert.strictEqual(result.outputPath, outputDir);
assert.deepStrictEqual(listFiles(outputDir), [...manifest].sort());
for (const file of result.files) assert.match(file.sha256, /^[a-f0-9]{64}$/);
assert(!fs.existsSync(path.join(outputDir, "functions")));
assert(!fs.existsSync(path.join(outputDir, ".github")));
assert(!fs.existsSync(path.join(outputDir, "AGENTS.md")));

const nonEmptyOutput = fs.mkdtempSync(path.join(os.tmpdir(), "nearby-good-eats-pages-nonempty-"));
fs.writeFileSync(path.join(nonEmptyOutput, "unexpected.txt"), "unexpected");
assert.throws(
  () => buildArtifact({ repoRoot, manifestPath, outputDir: nonEmptyOutput }),
  /必須不存在或為空/
);

const corruptedOutput = fs.mkdtempSync(path.join(os.tmpdir(), "nearby-good-eats-pages-corrupt-"));
assert.throws(
  () => buildArtifact({
    repoRoot,
    manifestPath,
    outputDir: corruptedOutput,
    copyFile(source, target) {
      fs.copyFileSync(source, target);
      if (path.basename(target) === "index.html") fs.appendFileSync(target, "corrupted");
    }
  }),
  /SHA-256 不一致/
);
console.log("PASS: Pages artifact " + result.copiedCount + " files verified at " + outputDir);
