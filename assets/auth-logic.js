(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.NGE_AUTH_LOGIC = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  function loginStrategy({ embedded = false } = {}) {
    return embedded ? "external-browser-required" : "popup";
  }

  return { loginStrategy };
});
