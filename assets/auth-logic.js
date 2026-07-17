(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.NGE_AUTH_LOGIC = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  function loginStrategy({ embedded = false } = {}) {
    return embedded ? "external-browser-required" : "popup";
  }

  function withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error("Google sign-in popup timed out");
        error.code = "auth/popup-timeout";
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([Promise.resolve(promise), timeout])
      .finally(() => clearTimeout(timeoutId));
  }

  return { loginStrategy, withTimeout };
});
