"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ID = "nearby-good-eats";
const FIREBASE_TOOLS_VERSION = "15.24.0";

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Refusing to reuse pre-existing emulator endpoints; run this command from a clean shell");
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nge-admin-runtime-"));
const configPath = path.join(tempDir, "firebase.runtime-test.json");
const rulesPath = path.join(tempDir, "firestore.runtime-test.rules");
const config = {
  firestore: { rules: path.basename(rulesPath) },
  emulators: {
    auth: { host: "127.0.0.1", port: 19099 },
    firestore: { host: "127.0.0.1", port: 18080 },
    ui: { enabled: false },
    singleProjectMode: true,
  },
};

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
fs.writeFileSync(
  rulesPath,
  "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}\n",
  "utf8"
);

const testPath = path.join(__dirname, "test-admin-runtime-contract.js");
let emulatorCommand = `"${process.execPath}" "${testPath}"`;
if (process.platform === "win32") {
  const testCommandPath = path.join(tempDir, "run-runtime-test.cmd");
  fs.writeFileSync(testCommandPath, `@"${process.execPath}" "${testPath}"\r\n`, "utf8");
  emulatorCommand = path.basename(testCommandPath);
}
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCommand,
  [
    "--yes",
    "-p",
    `firebase-tools@${FIREBASE_TOOLS_VERSION}`,
    "firebase",
    "emulators:exec",
    "--project",
    PROJECT_ID,
    "--config",
    configPath,
    "--only",
    "auth,firestore",
    emulatorCommand,
  ],
  {
    cwd: tempDir,
    env: {
      ...process.env,
      GCLOUD_PROJECT: PROJECT_ID,
      GOOGLE_CLOUD_PROJECT: PROJECT_ID,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
