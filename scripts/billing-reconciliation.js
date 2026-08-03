const fs = require("fs");

function sumBy(rows, keyName, valueName) {
  return rows.reduce((result, row) => {
    const key = String(row?.[keyName] || "").trim();
    const value = Number(row?.[valueName]);
    if (!key || !Number.isFinite(value)) return result;
    result[key] = Number(((result[key] || 0) + value).toFixed(6));
    return result;
  }, {});
}

function aggregateBillingRows(rows) {
  return sumBy(rows, "service", "cost");
}

function aggregateEstimatedRows(rows) {
  return sumBy(rows, "action", "estimatedCostUsd");
}

function buildReconciliation(estimated, billed) {
  return [...new Set([...Object.keys(estimated), ...Object.keys(billed)])]
    .sort((a, b) => a.localeCompare(b))
    .map((category) => {
      const estimatedUsd = Number(estimated[category] || 0);
      const billedUsd = Number(billed[category] || 0);
      return {
        category,
        estimatedUsd,
        billedUsd,
        differenceUsd: Number((billedUsd - estimatedUsd).toFixed(6))
      };
    });
}

function readJsonArray(path) {
  const value = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!Array.isArray(value)) throw new Error(`${path} must contain a JSON array`);
  return value;
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

if (require.main === module) {
  const billingPath = argValue(process.argv, "--billing");
  const eventsPath = argValue(process.argv, "--events");
  if (!billingPath || !eventsPath) {
    throw new Error("Usage: node scripts/billing-reconciliation.js --billing <normalized-billing.json> --events <admin-api-events.json>");
  }
  const billed = aggregateBillingRows(readJsonArray(billingPath));
  const estimated = aggregateEstimatedRows(readJsonArray(eventsPath));
  process.stdout.write(`${JSON.stringify({ estimated, billed, reconciliation: buildReconciliation(estimated, billed) }, null, 2)}\n`);
}

module.exports = { aggregateBillingRows, aggregateEstimatedRows, buildReconciliation };
