const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  awardSearchQueriesFromEntries,
  normalizeAwardFilterValue,
} = require("../assets/search-logic.js");

function loadFilterOptions() {
  const source = fs.readFileSync(path.join(__dirname, "..", "assets", "filter-rules.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "assets/filter-rules.js" });
  return sandbox.window.RANK_FILTER_DEFS.find(group => group.key === "award").opts;
}

function run() {
  assert.equal(normalizeAwardFilterValue("米其林星"), "米其林星級");

  const awardOptions = loadFilterOptions();
  const awards = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets", "awards-taiwan.json"), "utf8"));
  const entries = awards.restaurants || [];
  const labels = awardOptions.map(option => option.label).filter(label => label !== "不限");
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.ok(labels.includes("米其林星級"), "評鑑濾網必須使用畫面上的米其林星級標籤");
  assert.match(indexHtml, /本地評鑑名單/, "前台提示必須明確說明評鑑會先查本地資料");

  const awardLimitMatch = indexHtml.match(/RANK_AWARD_SEARCH_MAX_QUERIES:\s*(\d+)/);
  assert.ok(awardLimitMatch, "前台必須設定評鑑補查 Google 的上限");
  assert.ok(Number(awardLimitMatch[1]) <= 8, "評鑑補查 Google 的前台上限必須維持少量，避免過度外部 API");

  for (const label of labels) {
    const queries = awardSearchQueriesFromEntries(entries, [label], awardOptions, { limit: 6 });
    assert.ok(queries.length > 0, `${label} 必須能從正式評鑑資料產生 Google 搜尋查詢`);
    assert.ok(queries.every(query => query.textQuery.includes("餐廳")), `${label} 查詢必須明確搜尋餐廳`);
    assert.ok(
      queries.every(query => query.entryName && query.textQuery.includes(query.entryName)),
      `${label} 查詢必須包含真實評鑑餐廳名稱`,
    );
  }

  const taichungQueries = awardSearchQueriesFromEntries(entries, ["500碗"], awardOptions, {
    city: "臺中市",
    limit: 8,
  });
  assert.ok(taichungQueries.length > 0, "縣市篩選下仍要能從評鑑名單產生查詢");
  assert.ok(taichungQueries.every(query => query.city === "臺中市"), "縣市篩選不得混入其他縣市評鑑店");
  assert.ok(taichungQueries.every(query => query.textQuery.includes("臺中市")), "查詢文字必須包含縣市以提高 Google 命中率");

  const defaultQueries = awardSearchQueriesFromEntries(entries, ["500碗"], awardOptions);
  assert.ok(defaultQueries.length <= 8, "未指定上限時也只能產生少量 Google 查詢，避免把本地評鑑清單全量外查");

  console.log("award search contract tests passed");
}

run();
