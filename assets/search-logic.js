(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.NGE_SEARCH_LOGIC = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  function isReusableSearchCacheValue(value) {
    return !Array.isArray(value) || value.length > 0;
  }

  function locationModeFilter(filter = {}) {
    return Object.assign({}, filter, { travel:null });
  }

  function travelOriginFilter(filter = {}, defaultTravel = "走路") {
    return Object.assign({}, filter, {
      city:"",
      area:"",
      village:"",
      travel:filter.travel || defaultTravel,
    });
  }

  function withBaseAreaSearchQuery(queries = []) {
    return Array.isArray(queries) && queries.length ? queries : [""];
  }

  function defaultSearchFilter(overrides = {}) {
    return Object.assign({
      keyword: "",
      meal: null,
      travel: "走路",
      open: "營業中",
      cuisine: null,
      service: null,
      diet: null,
      award: [],
      city: "",
      area: "",
      village: "",
    }, overrides);
  }

  async function autoRelaxCandidates({
    items = [],
    minimum = 3,
    initialFilter = {},
    relaxations = [],
    fetchItems,
    sortItems = list => list,
  }) {
    let best = Array.isArray(items) ? items.slice() : [];
    let currentFilter = Object.assign({}, initialFilter);
    let relaxed = false;
    let lastRelaxation = null;
    if (best.length >= minimum) return { items:best, relaxed:false, relaxation:null };
    for (const step of relaxations) {
      currentFilter = Object.assign({}, currentFilter, step.patch || {});
      const fetched = await fetchItems(currentFilter);
      const next = sortItems(Array.isArray(fetched) ? fetched.slice() : [], currentFilter);
      if (next.length > best.length) {
        best = next;
        relaxed = true;
        lastRelaxation = step;
      }
      if (best.length >= minimum) break;
    }
    return { items:best, relaxed, relaxation:lastRelaxation };
  }

  function nextResultPage(items = [], shownIds = new Set(), size = 3) {
    const seen = shownIds instanceof Set ? shownIds : new Set(shownIds || []);
    const page = items.filter(item => item && item.id && !seen.has(item.id)).slice(0, size);
    return page.length === size ? page : [];
  }

  function normalizeKeywordValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/臺/g, "台")
      .replace(/魯肉/g, "滷肉");
  }

  function keywordTermVariants(term) {
    const base = normalizeKeywordValue(term);
    if (!base) return [];
    const variants = new Set([base]);
    variants.add(base.replace(/滷肉/g, "魯肉"));
    variants.add(base.replace(/魯肉/g, "滷肉"));
    variants.add(base.replace(/台/g, "臺"));
    variants.add(base.replace(/臺/g, "台"));
    variants.add(base.replace(/麵線/g, "面線"));
    variants.add(base.replace(/面線/g, "麵線"));
    return [...variants].filter(Boolean);
  }

  function keywordMatchDetails(item = {}, keyword = "") {
    const rawTokens = String(keyword || "").split(/[\s,，、]+/).map(value => value.trim()).filter(Boolean);
    const terms = rawTokens.length > 1 ? rawTokens : [String(keyword || "").trim()].filter(Boolean);
    if (!terms.length) return { ok:true, score:0, hits:[], missing:[] };
    const fields = [
      { key:"name", label:"店名", weight:8, text:item.name },
      { key:"type", label:"類型", weight:5, text:[item.ptd, item.typeName, item.pt].join(" ") },
      { key:"review", label:"評論摘要", weight:4, text:item.reviewSummary },
      { key:"summary", label:"Google 摘要", weight:3.5, text:[item.summary, item.generativeSummary].join(" ") },
    ].map(field => ({ ...field, normalized:normalizeKeywordValue(field.text) }));
    const hits = [];
    const missing = [];
    let score = 0;
    for (const term of terms) {
      const variants = keywordTermVariants(term);
      let best = null;
      for (const field of fields) {
        const found = variants.find(variant => field.normalized.includes(variant));
        if (!found) continue;
        const candidate = {
          term,
          source:field.label,
          field:field.key,
          score:field.weight + Math.min(found.length, 8) / 10,
        };
        if (!best || candidate.score > best.score) best = candidate;
      }
      if (best) {
        hits.push(best);
        score += best.score;
      } else {
        missing.push(term);
      }
    }
    return { ok:missing.length === 0, score, hits, missing };
  }

  const TAIWAN_CITY_ADDRESS_ALIASES = [
    ["新北市", "new taipei city"], ["臺北市", "taipei city"],
    ["桃園市", "taoyuan city"], ["臺中市", "taichung city"],
    ["臺南市", "tainan city"], ["高雄市", "kaohsiung city"],
    ["基隆市", "keelung city"], ["新竹縣", "hsinchu county"],
    ["新竹市", "hsinchu city"], ["苗栗縣", "miaoli county"],
    ["彰化縣", "changhua county"], ["南投縣", "nantou county"],
    ["雲林縣", "yunlin county"], ["嘉義縣", "chiayi county"],
    ["嘉義市", "chiayi city"], ["屏東縣", "pingtung county"],
    ["宜蘭縣", "yilan county"], ["花蓮縣", "hualien county"],
    ["臺東縣", "taitung county"], ["澎湖縣", "penghu county"],
    ["金門縣", "kinmen county"], ["連江縣", "lienchiang county"],
  ];

  function resolveCandidateLocation({
    address = "",
    contextCity = "",
    contextArea = "",
    cities = [],
    areasByCity = {},
  } = {}) {
    const normalizedAddress = String(address || "").replace(/台/g, "臺");
    const normalizedEnglishAddress = normalizedAddress.toLowerCase().replace(/[^a-z]+/g, " ").trim();
    const knownCities = Array.isArray(cities) ? cities : [];
    let actualCity = knownCities.find(city => normalizedAddress.includes(String(city).replace(/台/g, "臺"))) || "";
    if (!actualCity) {
      const aliasMatch = TAIWAN_CITY_ADDRESS_ALIASES.find(([city, alias]) =>
        knownCities.includes(city) && normalizedEnglishAddress.includes(alias)
      );
      actualCity = aliasMatch?.[0] || "";
    }
    const areas = actualCity && Array.isArray(areasByCity[actualCity]) ? areasByCity[actualCity] : [];
    const actualArea = areas.find(area => normalizedAddress.includes(area)) || "";
    const normalizedContextCity = String(contextCity || "").replace(/台/g, "臺");
    return {
      city:actualCity || normalizedContextCity,
      area:actualArea || (!actualCity || actualCity === normalizedContextCity ? contextArea : ""),
    };
  }

  function mergeCandidateContext(item = {}, context = {}) {
    return Object.assign({}, context, item, {
      queryTerms:context.queryTerms || item.queryTerms || [],
    });
  }

  function normalizeAwardFilterValue(value) {
    const text = String(value || "").trim();
    return text === "米其林星" ? "米其林星級" : text;
  }

  function normalizeTaiwanText(value) {
    return String(value || "").trim().replace(/台/g, "臺").replace(/\s+/g, "");
  }

  function awardOptionForValue(value, options = []) {
    const normalized = normalizeAwardFilterValue(value);
    return (Array.isArray(options) ? options : []).find(option =>
      normalizeAwardFilterValue(option?.label) === normalized
    ) || { label:normalized };
  }

  function awardMatchesOption(award = {}, option = {}) {
    if (option.guide) {
      return award.guide === option.guide && (!option.level || award.level === option.level);
    }
    const value = normalizeAwardFilterValue(option.label);
    if (value === "米其林三星") return award.guide === "michelin" && award.level === "三星";
    if (value === "米其林二星") return award.guide === "michelin" && award.level === "二星";
    if (value === "米其林一星") return award.guide === "michelin" && award.level === "一星";
    if (value === "米其林星級") return award.guide === "michelin";
    if (value === "米其林入選") return award.guide === "michelin_selected";
    if (value === "必比登") return award.guide === "bib";
    if (value === "500盤") return award.guide === "500plate";
    if (value === "500碗") return award.guide === "500bowl";
    if (value === "500甜") return award.guide === "500sweet";
    return false;
  }

  function awardEntryMatchesValues(entry = {}, values = [], options = []) {
    const selected = [...new Set((Array.isArray(values) ? values : [values])
      .map(normalizeAwardFilterValue)
      .filter(value => value && value !== "不限"))];
    if (!selected.length) return false;
    const awards = Array.isArray(entry.awards) ? entry.awards : [];
    if (!awards.length) return false;
    const selectedOptions = selected.map(value => awardOptionForValue(value, options));
    return awards.some(award => selectedOptions.some(option => awardMatchesOption(award, option)));
  }

  function awardSearchQueriesFromEntries(entries = [], values = [], options = [], { city = "", area = "", limit = 8 } = {}) {
    const normalizedCity = normalizeTaiwanText(city);
    const normalizedArea = normalizeTaiwanText(area);
    const max = Math.max(1, Number(limit) || 8);
    const queries = [];
    const seen = new Set();
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!awardEntryMatchesValues(entry, values, options)) continue;
      const entryCity = normalizeTaiwanText(entry.city);
      const entryArea = normalizeTaiwanText(entry.district || entry.area);
      const entryAddress = normalizeTaiwanText(entry.address);
      if (normalizedCity && entryCity !== normalizedCity) continue;
      if (normalizedArea && entryArea !== normalizedArea && !entryAddress.includes(normalizedArea)) continue;
      const name = String(entry.name || "").trim();
      if (!name) continue;
      const cityText = String(city || entry.city || "").trim();
      const areaText = String(area || entry.district || entry.area || "").trim();
      const textQuery = [cityText, areaText, name, "餐廳"].filter(Boolean).join(" ");
      const key = normalizeTaiwanText(textQuery);
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push({
        textQuery,
        entryName:name,
        city:cityText,
        area:areaText,
        awardValues:[...new Set((Array.isArray(values) ? values : [values]).map(normalizeAwardFilterValue).filter(Boolean))],
      });
      if (queries.length >= max) break;
    }
    return queries;
  }

  function relaxedAwardValues(values = []) {
    const selected = [...new Set((Array.isArray(values) ? values : [values]).map(normalizeAwardFilterValue).filter(Boolean))];
    if (!selected.length) return [];
    const michelinLevels = new Set(["米其林一星", "米其林二星", "米其林三星"]);
    if (!selected.some(value => michelinLevels.has(value))) return [];
    const relaxed = [];
    for (const value of selected) {
      const next = michelinLevels.has(value) ? "米其林星級" : value;
      if (!relaxed.includes(next)) relaxed.push(next);
    }
    return relaxed;
  }

  function automaticFallbackRelaxations(filter = {}) {
    const steps = [];
    const add = (key, patch, note) => steps.push({ key, patch, note });
    if (filter.meal) add("clear-meal", { meal:null }, "結果不足，已放寬時段");
    if (filter.village) add("clear-village", { village:"" }, "結果不足，已放寬為整個行政區");
    if (filter.area) add("clear-area", { area:"", village:"" }, "結果不足，已放寬為整個縣市");
    if (filter.city) add("clear-city", { city:"", area:"", village:"" }, "結果不足，已放寬地區限制");
    if (filter.open === "營業中") add("open-any", { open:"不限" }, "結果不足，已納入目前未營業的店家");
    if (filter.service) add("clear-service", { service:null }, "結果不足，已放寬供餐方式");
    const relaxedAwards = relaxedAwardValues(filter.award || []);
    if (relaxedAwards.length) add("relax-award-level", { award:relaxedAwards }, "結果不足，已放寬為所有米其林星級");
    if ((filter.award || []).length) add("clear-award", { award:[] }, "結果不足，已放寬評鑑限制");
    if (filter.cuisine) add("clear-cuisine", { cuisine:null }, "結果不足，已放寬菜系");
    if (filter.diet) add("clear-diet", { diet:null }, "結果不足，已放寬飲食限制");
    return steps;
  }

  function shouldDeferFilterRebuild(activeElementId, composing = false) {
    return composing === true || activeElementId === "rkKeyword";
  }

  return {
    isReusableSearchCacheValue,
    locationModeFilter,
    travelOriginFilter,
    withBaseAreaSearchQuery,
    defaultSearchFilter,
    autoRelaxCandidates,
    nextResultPage,
    keywordMatchDetails,
    resolveCandidateLocation,
    mergeCandidateContext,
    normalizeAwardFilterValue,
    awardEntryMatchesValues,
    awardSearchQueriesFromEntries,
    relaxedAwardValues,
    automaticFallbackRelaxations,
    shouldDeferFilterRebuild,
  };
});
