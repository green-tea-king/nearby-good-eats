"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-pages.yml");
assert(fs.existsSync(workflowPath), "缺少 .github/workflows/deploy-pages.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

for (const token of [
  "pull_request:",
  "push:",
  "workflow_dispatch:",
  "workflow_run:",
  'workflows: ["Update external social signals"]',
  "actions/checkout@v6",
  "actions/setup-node@v7",
  "actions/configure-pages@v5",
  "actions/upload-pages-artifact@v4",
  "actions/deploy-pages@v4",
  "node-version: 22",
  "node scripts/test-pages-artifact.js",
  "node scripts/build-pages-artifact.js",
  "pages: write",
  "id-token: write",
  "name: github-pages"
]) {
  assert(workflow.includes(token), "workflow 缺少契約: " + token);
}

assert.match(workflow, /deploy:\s*[\s\S]*if:\s*>-[\s\S]*github\.event_name != 'pull_request'/);
assert.match(workflow, /Checkout workflow run result[\s\S]*github\.event_name == 'workflow_run'[\s\S]*ref:\s*main/);
assert.match(workflow, /Checkout source[\s\S]*github\.event_name != 'workflow_run'/);
assert.strictEqual((workflow.match(/github\.ref == 'refs\/heads\/main'/g) || []).length, 2);

const deployScriptPath = path.join(repoRoot, "scripts", "deploy-github-contents.ps1");
const deployScript = fs.readFileSync(deployScriptPath, "utf8");
assert.match(deployScript, /gh workflow run deploy-pages\.yml/);
assert.match(deployScript, /gh run watch/);
assert.match(deployScript, /Deployment target must be green-tea-king\/nearby-good-eats main/);
assert.match(deployScript, /Pages build_type must be workflow before dispatch/);
assert.match(deployScript, /pagesUrl = \$pages\.html_url/i);
assert.match(deployScript, /Invoke-GhCommandOnce -Label "workflow\/dispatch"[\s\S]{0,400}gh workflow run deploy-pages\.yml/);
assert.doesNotMatch(deployScript, /\/git\/(?:blobs|trees|commits|refs)/);
assert.doesNotMatch(deployScript, /\$Files\s*=\s*@\(/);
console.log("PASS: GitHub Pages workflow contract verified");
