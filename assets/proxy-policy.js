(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NGE_PROXY_POLICY = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function shouldAllowClientSearchFallback({ hasApiProxy, isProductionHost } = {}) {
    return hasApiProxy === true || isProductionHost !== true;
  }

  return { shouldAllowClientSearchFallback };
}));
