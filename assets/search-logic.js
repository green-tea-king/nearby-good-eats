(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.NGE_SEARCH_LOGIC = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
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

  return { defaultSearchFilter, autoRelaxCandidates, nextResultPage };
});
