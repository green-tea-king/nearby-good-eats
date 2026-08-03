const assert = require("assert");
const {
  aggregateBillingRows,
  aggregateEstimatedRows,
  buildReconciliation
} = require("./billing-reconciliation.js");

const billing = aggregateBillingRows([
  { service: "Google Maps Platform", cost: "1.25", currency: "USD" },
  { service: "Cloud Functions", cost: "0.75", currency: "USD" },
  { service: "Cloud Functions", cost: "", currency: "USD" }
]);
assert.deepStrictEqual(billing, { "Google Maps Platform": 1.25, "Cloud Functions": 0.75 });

const estimates = aggregateEstimatedRows([
  { action: "placesSearch", estimatedCostUsd: "0.4" },
  { action: "routes", estimatedCostUsd: 0.6 },
  { action: "routes", estimatedCostUsd: "not-a-number" }
]);
assert.deepStrictEqual(estimates, { placesSearch: 0.4, routes: 0.6 });

assert.deepStrictEqual(
  buildReconciliation({ Maps: 2 }, { Maps: 1.5, Functions: 0.5 }),
  [
    { category: "Functions", estimatedUsd: 0, billedUsd: 0.5, differenceUsd: 0.5 },
    { category: "Maps", estimatedUsd: 2, billedUsd: 1.5, differenceUsd: -0.5 }
  ]
);

console.log("billing reconciliation tests passed");
