const assert = require("assert");
const { shouldAllowClientSearchFallback } = require("../assets/proxy-policy.js");

assert.strictEqual(
  shouldAllowClientSearchFallback({ hasApiProxy: true, isProductionHost: true }),
  true,
  "production may use the proxy"
);
assert.strictEqual(
  shouldAllowClientSearchFallback({ hasApiProxy: false, isProductionHost: true }),
  false,
  "production must not fall back to browser Places search"
);
assert.strictEqual(
  shouldAllowClientSearchFallback({ hasApiProxy: false, isProductionHost: false }),
  true,
  "local development may use the existing browser fallback"
);

console.log("proxy policy tests passed");
