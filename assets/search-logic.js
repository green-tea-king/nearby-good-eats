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
    return items.filter(item => item && item.id && !seen.has(item.id)).slice(0, size);
  }

  function relaxedAwardValues(values = []) {
    const selected = [...new Set((Array.isArray(values) ? values : [values]).filter(Boolean))];
    if (!selected.length) return [];
    const michelinLevels = new Set(["米其林一星", "米其林二星", "米其林三星"]);
    if (!selected.some(value => michelinLevels.has(value))) return [];
    const relaxed = [];
    for (const value of selected) {
      const next = michelinLevels.has(value) ? "米其林星" : value;
      if (!relaxed.includes(next)) relaxed.push(next);
    }
    return relaxed;
  }

  function automaticFallbackRelaxations(filter = {}) {
    const steps = [];
    const add = (key, patch, note) => steps.push({ key, patch, note });
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
    if (filter.meal) add("clear-meal", { meal:null }, "結果不足，已放寬時段");
    return steps;
  }

  function shouldDeferFilterRebuild(activeElementId, composing = false) {
    return composing === true || activeElementId === "rkKeyword";
  }

  return {
    isReusableSearchCacheValue,
    locationModeFilter,
    withBaseAreaSearchQuery,
    defaultSearchFilter,
    autoRelaxCandidates,
    nextResultPage,
    relaxedAwardValues,
    automaticFallbackRelaxations,
    shouldDeferFilterRebuild,
  };
});
