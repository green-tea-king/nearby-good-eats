const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const signalsPath = path.join(repoRoot, "assets", "external-signals.json");
const manualSignalsPath = path.join(repoRoot, "assets", "platform-signals.manual.json");

const ALLOWED_SIGNAL_TYPES = new Set([
  "award",
  "fiftyBest",
  "socialBuzz",
  "mediaMention",
  "platformCertification",
  "platformRating",
  "queueSignal",
  "youtubeBuzz",
]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function validate(data) {
  const errors = [];
  const catalog = Array.isArray(data.sourceCatalog) ? data.sourceCatalog : [];
  const sourceIds = new Set(catalog.map((source) => source.id).filter(Boolean));
  const requiredSources = [
    "michelin-guide",
    "bib-gourmand",
    "500plate",
    "500bowl",
    "500sweet",
    "google-maps-reviews",
    "ifoodie",
    "openrice-tw",
    "tripadvisor-tw",
    "youtube-api",
  ];

  for (const id of requiredSources) {
    if (!sourceIds.has(id)) errors.push(`missing sourceCatalog id: ${id}`);
  }

  for (const source of catalog) {
    if (!source.id) errors.push("sourceCatalog item missing id");
    if (!source.label) errors.push(`sourceCatalog ${source.id || "(unknown)"} missing label`);
    if (source.runtimeLookup !== false) errors.push(`sourceCatalog ${source.id || "(unknown)"} must set runtimeLookup=false`);
  }

  if (!data.policy || data.policy.runtimeExternalLookup !== false || data.policy.batchOnly !== true) {
    errors.push("policy must enforce runtimeExternalLookup=false and batchOnly=true");
  }

  const rows = Array.isArray(data.restaurants) ? data.restaurants : [];
  for (const [rowIndex, row] of rows.entries()) {
    if (!row.name) errors.push(`restaurants[${rowIndex}] missing name`);
    if (!row.city) errors.push(`restaurants[${rowIndex}] missing city`);
    const signals = Array.isArray(row.signals) ? row.signals : [];
    for (const [signalIndex, signal] of signals.entries()) {
      const prefix = `restaurants[${rowIndex}].signals[${signalIndex}]`;
      if (!ALLOWED_SIGNAL_TYPES.has(signal.type)) errors.push(`${prefix} invalid type: ${signal.type}`);
      if (!sourceIds.has(signal.sourceId)) errors.push(`${prefix} unknown sourceId: ${signal.sourceId}`);
      if (!ALLOWED_CONFIDENCE.has(signal.confidence)) errors.push(`${prefix} invalid confidence: ${signal.confidence}`);
      if (!Number.isFinite(Number(signal.score)) || Number(signal.score) < 0 || Number(signal.score) > 100) {
        errors.push(`${prefix} score must be 0-100`);
      }
      if (!signal.updated) errors.push(`${prefix} missing updated`);
      if (!signal.generatedBy && !signal.reviewedBy) errors.push(`${prefix} must have generatedBy or reviewedBy`);
      if ((signal.type === "platformRating" || signal.type === "platformCertification") && !signal.url) {
        errors.push(`${prefix} platform signal must include source url`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    sources: sourceIds.size,
    restaurants: rows.length,
    signals: rows.reduce((sum, row) => sum + (Array.isArray(row.signals) ? row.signals.length : 0), 0),
    errors,
  };
}

function validateManualPlatformSignals(data) {
  const errors = [];
  if (!data.policy || data.policy.runtimeExternalLookup !== false || data.policy.batchOnly !== true) {
    errors.push("platform-signals.manual.json policy must enforce runtimeExternalLookup=false and batchOnly=true");
  }
  const allowedSources = new Set(["ifoodie", "openrice-tw", "tripadvisor-tw"]);
  const rows = Array.isArray(data.restaurants) ? data.restaurants : [];
  for (const [rowIndex, row] of rows.entries()) {
    if (!row.name) errors.push(`platform manual restaurants[${rowIndex}] missing name`);
    if (!row.city) errors.push(`platform manual restaurants[${rowIndex}] missing city`);
    for (const [signalIndex, signal] of (row.signals || []).entries()) {
      const prefix = `platform manual restaurants[${rowIndex}].signals[${signalIndex}]`;
      if (!allowedSources.has(signal.sourceId)) errors.push(`${prefix} invalid sourceId: ${signal.sourceId}`);
      if (!ALLOWED_SIGNAL_TYPES.has(signal.type)) errors.push(`${prefix} invalid type: ${signal.type}`);
      if (!ALLOWED_CONFIDENCE.has(signal.confidence)) errors.push(`${prefix} invalid confidence: ${signal.confidence}`);
      if (!signal.url) errors.push(`${prefix} missing url`);
      if (!signal.updated) errors.push(`${prefix} missing updated`);
      if (!signal.reviewedBy) errors.push(`${prefix} missing reviewedBy`);
    }
  }
  return {
    rows: rows.length,
    signals: rows.reduce((sum, row) => sum + (Array.isArray(row.signals) ? row.signals.length : 0), 0),
    errors,
  };
}

const report = validate(readJson(signalsPath));
if (fs.existsSync(manualSignalsPath)) {
  const manualReport = validateManualPlatformSignals(readJson(manualSignalsPath));
  report.manualPlatformSignals = {
    rows: manualReport.rows,
    signals: manualReport.signals,
  };
  report.errors.push(...manualReport.errors);
  report.ok = report.errors.length === 0;
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
