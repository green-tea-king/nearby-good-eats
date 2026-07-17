const assert = require("node:assert/strict");
const {
  defaultSearchFilter,
  autoRelaxCandidates,
  nextResultPage,
  relaxedAwardValues,
  automaticFallbackRelaxations,
  shouldDeferFilterRebuild,
  isReusableSearchCacheValue,
  locationModeFilter,
  withBaseAreaSearchQuery,
} = require("../assets/search-logic.js");

async function run() {
  assert.equal(isReusableSearchCacheValue([]), false, "空搜尋結果不得沿用快取");
  assert.equal(isReusableSearchCacheValue(["place"]), true, "有資料的搜尋結果可沿用快取");
  assert.equal(isReusableSearchCacheValue({ items:[] }), true, "非候選陣列維持既有快取行為");
  assert.equal(locationModeFilter({ travel:"走路", city:"臺北市" }).travel, null, "地區模式不得保留交通選取狀態");
  assert.deepEqual(withBaseAreaSearchQuery([]), [""], "只選地區時仍須建立基本餐廳查詢");
  assert.deepEqual(withBaseAreaSearchQuery(["火鍋"]), ["火鍋"], "已有條件時不得增加重複查詢");
  assert.equal(
    automaticFallbackRelaxations({ city:"臺北市", area:"信義區", meal:"消夜" })[0].key,
    "clear-meal",
    "結果不足時應先放寬自動時段，保留使用者指定地區",
  );
  assert.equal(defaultSearchFilter().travel, "走路");
  assert.equal(defaultSearchFilter().open, "營業中");

  const zero = await autoRelaxCandidates({
    items: [],
    minimum: 3,
    relaxations: [],
    fetchItems: async () => [{ id: "wrong-condition" }],
  });
  assert.deepEqual(zero.items, []);
  assert.equal(zero.relaxed, false);

  const cumulative = await autoRelaxCandidates({
    items: [{ id: "a" }],
    minimum: 3,
    initialFilter: { keyword: "麵線", open: "營業中" },
    relaxations: [
      { key: "radius-1200", patch: { radius: 1200 } },
      { key: "radius-2000", patch: { radius: 2000 } },
    ],
    fetchItems: async filter => {
      assert.equal(filter.keyword, "麵線");
      assert.equal(filter.open, "營業中");
      return filter.radius === 2000
      ? [{ id: "a" }, { id: "b" }, { id: "c" }]
      : [{ id: "a" }, { id: "b" }];
    },
  });
  assert.deepEqual(cumulative.items.map(x => x.id), ["a", "b", "c"]);
  assert.equal(cumulative.relaxed, true);

  const page = nextResultPage(
    [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    new Set(["a", "b", "c"]),
    3,
  );
  assert.deepEqual(page.map(x => x.id), ["d"]);

  assert.deepEqual(relaxedAwardValues(["米其林一星"]), ["米其林星"]);
  assert.deepEqual(relaxedAwardValues(["米其林二星", "必比登"]), ["米其林星", "必比登"]);
  assert.deepEqual(relaxedAwardValues(["必比登"]), []);

  const fallbackSteps = automaticFallbackRelaxations({
    keyword: "麵線",
    open: "營業中",
    city: "台北市",
    area: "中正區",
    village: "黎明里",
    award: ["米其林一星"],
    cuisine: "台灣菜",
  });
  assert.deepEqual(fallbackSteps.map(step => step.key), [
    "clear-village",
    "clear-area",
    "clear-city",
    "open-any",
    "relax-award-level",
    "clear-award",
    "clear-cuisine",
  ]);
  assert.equal(fallbackSteps.some(step => Object.hasOwn(step.patch, "keyword")), false);
  assert.equal(shouldDeferFilterRebuild("rkKeyword", false), true);
  assert.equal(shouldDeferFilterRebuild("rkKeyword", true), true);
  assert.equal(shouldDeferFilterRebuild("rkCity", false), false);

  console.log("search logic tests passed");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
