const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");

for (const asset of ["app-settings.js", "filter-rules.js", "search-logic.js", "auth-logic.js"]) {
  assert.match(
    html,
    new RegExp(`assets/${asset.replace(".", "\\.")}\\?v=${version.replaceAll(".", "\\.")}`),
    `${asset} 必須綁定目前版本，避免 HTML 與快取 JS 不相容`,
  );
}

assert.match(
  adminHtml,
  /source\.counts\?\.stars \?\? source\.awardCount/,
  "Michelin 統計缺少 counts 時必須回退到 awardCount",
);

console.log("static asset version tests passed");
