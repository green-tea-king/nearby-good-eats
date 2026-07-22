const assert = require("node:assert/strict");

const startedAt = Date.now();
require("./index");
const elapsedMs = Date.now() - startedAt;

assert.ok(
  elapsedMs < 8000,
  `functions source discovery should load in under 8000ms; actual ${elapsedMs}ms`,
);

console.log(`source discovery load test passed in ${elapsedMs}ms`);
process.exit(0);
