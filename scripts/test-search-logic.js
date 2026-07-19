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
  keywordMatchDetails,
  resolveCandidateLocation,
  mergeCandidateContext,
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
  assert.deepEqual(page, [], "下一組不足三家時不得顯示殘缺頁");
  assert.deepEqual(
    nextResultPage(
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }],
      new Set(["a", "b", "c"]),
      3,
    ).map(x => x.id),
    ["d", "e", "f"],
    "下一組有完整三家時應沿用候選池回傳",
  );

  assert.equal(
    keywordMatchDetails(
      {
        name: "S&D 好食光後山埤門市",
        ptd: "咖啡廳",
        queryTerms: ["滷肉飯"],
        address: "臺北市信義區",
      },
      "滷肉飯",
    ).ok,
    false,
    "使用者輸入的搜尋詞本身不得當成店家符合關鍵字的證據",
  );
  assert.equal(
    keywordMatchDetails(
      { name: "今大魯肉飯", ptd: "台灣餐廳", address: "新北市三重區" },
      "滷肉飯",
    ).ok,
    true,
    "店名中的魯肉／滷肉同義字應視為真實命中",
  );

  assert.deepEqual(
    resolveCandidateLocation({
      address: "No. 23, Datong N. Rd., Sanchong District, New Taipei City, Taiwan",
      contextCity: "臺北市",
      contextArea: "中正區",
      cities: ["臺北市", "新北市"],
      areasByCity: { 臺北市:["中正區"], 新北市:["三重區"] },
    }),
    { city:"新北市", area:"" },
    "地址中的真實縣市必須優先於搜尋查詢的縣市標籤",
  );
  assert.deepEqual(
    mergeCandidateContext(
      { id:"place-1", city:"新北市", area:"三重區", queryTerms:[] },
      { city:"臺北市", area:"中正區", queryTerms:["滷肉飯"], areaScopeKey:"taipei-query" },
    ),
    {
      id:"place-1",
      city:"新北市",
      area:"三重區",
      queryTerms:["滷肉飯"],
      areaScopeKey:"taipei-query",
    },
    "補上查詢中繼資料時不得再次覆蓋地址解析出的縣市",
  );

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
