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
console.log("PASS: GitHub Pages workflow contract verified");
