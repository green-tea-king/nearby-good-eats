"use strict";
const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BLOCKED_EXACT = new Set([
  "AGENTS.md", "agent.md", "firebase.json", "firestore.rules",
  "firebase-debug.log", "package.json", "package-lock.json", ".env"
]);
const BLOCKED_PREFIXES = [
  ".git/", ".github/", "docs/", "experiment/", "functions/", "node_modules/",
  "dist/", "build/", "cache/", "logs/"
];
const BLOCKED_NAMES = /(^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|log)|(?:service-account|credentials?|token)(?:[-_.].*)?\.json)$/i;
const TRACKED_FILES_CACHE = new Map();
const GIT_TRANSIENT_ERROR = /(?:EPERM|EACCES|EBUSY|ENOENT|ENOTEMPTY|unable to read current working directory|not a git repository|Invalid argument|The cloud file provider|系統找不到指定的檔案|裝置尚未就緒|雲端檔案提供者)/i;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function stableProcessWorkingDirectory() {
  try {
    return fs.realpathSync.native(os.tmpdir());
  } catch {
    return os.tmpdir();
  }
}

function sleepMs(ms) {
  if (ms <= 0) return;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, ms);
}

function summarizeError(error) {
  return error && error.stderr ? String(error.stderr).trim() : (error && error.message) || String(error);
}

function runWithWebDavRetry(label, operation, { maxAttempts = 3, delayMs = 150 } = {}) {
  let lastError;
  let attempts = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      return operation();
    } catch (error) {
      lastError = error;
      const detail = summarizeError(error);
      if (attempt >= maxAttempts || !GIT_TRANSIENT_ERROR.test(detail)) break;
      sleepMs(delayMs * attempt);
    }
  }
  const detail = summarizeError(lastError);
  throw new Error(label + " after " + attempts + " attempt(s): " + detail);
}

function getTrackedFiles(repoRoot, { refresh = false } = {}) {
  const resolvedRepo = path.resolve(repoRoot);
  if (!refresh && TRACKED_FILES_CACHE.has(resolvedRepo)) {
    return TRACKED_FILES_CACHE.get(resolvedRepo);
  }
  try {
    const output = runWithWebDavRetry(
      "無法讀取 Git 追蹤清單",
      () => childProcess.execFileSync(
        "git",
        [
          "-c", "safe.directory=" + resolvedRepo,
          "--git-dir=" + path.join(resolvedRepo, ".git"),
          "--work-tree=" + resolvedRepo,
          "ls-files",
          "-z"
        ],
        {
          cwd: stableProcessWorkingDirectory(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        }
      )
    );
    const trackedFiles = new Set(output.split("\0").filter(Boolean).map((entry) => entry.replaceAll("\\", "/")));
    TRACKED_FILES_CACHE.set(resolvedRepo, trackedFiles);
    return trackedFiles;
  } catch (error) {
    throw new Error("無法讀取 Git 追蹤清單: " + summarizeError(error));
  }
}

function isTracked(repoRoot, entry, trackedFiles) {
  return (trackedFiles || getTrackedFiles(repoRoot)).has(entry);
}

function validateManifest(files, repoRoot) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Pages manifest 必須是非空陣列");
  }
  const trackedFiles = getTrackedFiles(repoRoot);
  const seen = new Set();
  return files.map((entry) => {
    if (typeof entry !== "string" || entry.length === 0 || entry !== entry.trim()) {
      throw new Error("Pages manifest 路徑格式錯誤");
    }
    if (entry.includes("\\")) {
      throw new Error("Pages manifest 必須使用 / 斜線: " + entry);
    }
    if (
      path.posix.isAbsolute(entry) ||
      /^[A-Za-z]:/.test(entry) ||
      path.posix.normalize(entry) !== entry ||
      entry === "." ||
      entry.startsWith("../")
    ) {
      throw new Error("Pages manifest 含不安全路徑: " + entry);
    }
    if (seen.has(entry)) {
      throw new Error("Pages manifest 含重複路徑: " + entry);
    }
    if (
      BLOCKED_EXACT.has(entry) ||
      BLOCKED_PREFIXES.some((prefix) => entry.startsWith(prefix)) ||
      BLOCKED_NAMES.test(entry)
    ) {
      throw new Error("Pages manifest 禁止發布: " + entry);
    }
    const source = path.resolve(repoRoot, ...entry.split("/"));
    if (!isInside(repoRoot, source) || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error("Pages manifest 找不到一般檔案: " + entry);
    }
    if (!trackedFiles.has(entry)) {
      throw new Error("Pages manifest 禁止未追蹤檔案: " + entry);
    }
    seen.add(entry);
    return entry;
  });
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function buildArtifact({
  repoRoot = path.resolve(__dirname, ".."),
  manifestPath = path.join(__dirname, "pages-files.json"),
  outputDir,
  copyFile = fs.copyFileSync
} = {}) {
  if (!outputDir) throw new Error("必須提供 outputDir");
  const resolvedRepo = path.resolve(repoRoot);
  const resolvedOutput = path.resolve(outputDir);
  if (resolvedOutput === resolvedRepo || isInside(resolvedRepo, resolvedOutput)) {
    throw new Error("artifact 輸出目錄不可位於 repository 內");
  }
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length !== 0) {
    throw new Error("artifact 輸出目錄必須不存在或為空");
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = validateManifest(manifest, resolvedRepo).map((relativePath) => {
    const source = path.join(resolvedRepo, ...relativePath.split("/"));
    const target = path.join(resolvedOutput, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    copyFile(source, target);
    const sourceHash = sha256(source);
    const targetHash = sha256(target);
    if (sourceHash !== targetHash) {
      throw new Error("artifact SHA-256 不一致: " + relativePath);
    }
    return { path: relativePath, sha256: targetHash };
  });

  return {
    manifestCount: manifest.length,
    copiedCount: files.length,
    entryFile: "index.html",
    version: fs.readFileSync(path.join(resolvedRepo, "VERSION"), "utf8").trim(),
    outputPath: resolvedOutput,
    files
  };
}

if (require.main === module) {
  const result = buildArtifact({ outputDir: process.argv[2] });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
module.exports = { buildArtifact, isTracked, validateManifest };
