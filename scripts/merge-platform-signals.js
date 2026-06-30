const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const externalSignalsPath = path.join(repoRoot, "assets", "external-signals.json");
const manualSignalsPath = path.join(repoRoot, "assets", "platform-signals.manual.json");

const ALLOWED_SOURCE_IDS = new Set(["ifoodie", "openrice-tw", "tripadvisor-tw"]);
const ALLOWED_TYPES = new Set(["platformRating", "platformCertification", "mediaMention", "socialBuzz", "queueSignal"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function signalKey(signal) {
  return `${signal.type}|${signal.sourceId}|${signal.url || ""}`;
}

function validateManual(manual) {
  const errors = [];
  if (!manual.policy || manual.policy.runtimeExternalLookup !== false || manual.policy.batchOnly !== true) {
    errors.push("manual policy must enforce runtimeExternalLookup=false and batchOnly=true");
  }
  const rows = Array.isArray(manual.restaurants) ? manual.restaurants : [];
  rows.forEach((row, rowIndex) => {
    if (!row.name) errors.push(`restaurants[${rowIndex}] missing name`);
    if (!row.city) errors.push(`restaurants[${rowIndex}] missing city`);
    const signals = Array.isArray(row.signals) ? row.signals : [];
    signals.forEach((signal, signalIndex) => {
      const prefix = `restaurants[${rowIndex}].signals[${signalIndex}]`;
      if (!ALLOWED_TYPES.has(signal.type)) errors.push(`${prefix} invalid type: ${signal.type}`);
      if (!ALLOWED_SOURCE_IDS.has(signal.sourceId)) errors.push(`${prefix} invalid sourceId: ${signal.sourceId}`);
      if (!ALLOWED_CONFIDENCE.has(signal.confidence)) errors.push(`${prefix} invalid confidence: ${signal.confidence}`);
      if (!Number.isFinite(Number(signal.score)) || Number(signal.score) < 0 || Number(signal.score) > 100) {
        errors.push(`${prefix} score must be 0-100`);
      }
      if (!signal.url) errors.push(`${prefix} missing url`);
      if (!signal.updated) errors.push(`${prefix} missing updated`);
      if (!signal.reviewedBy) errors.push(`${prefix} missing reviewedBy`);
    });
  });
  return errors;
}

function findOrCreateRestaurant(signals, row) {
  signals.restaurants = Array.isArray(signals.restaurants) ? signals.restaurants : [];
  const rowNames = [row.name, ...(row.aliases || [])].map(normalizeName);
  let target = signals.restaurants.find((item) => {
    if ((item.city || "") !== (row.city || "")) return false;
    const names = [item.name, ...(item.aliases || [])].map(normalizeName);
    return rowNames.some((name) => names.includes(name));
  });
  if (!target) {
    target = {
      placeId: row.placeId || "",
      name: row.name,
      city: row.city || "",
      area: row.area || "",
      aliases: row.aliases || [],
      signals: [],
    };
    signals.restaurants.push(target);
  }
  return target;
}

function mergeManualSignals(signals, manual) {
  const report = {
    mergedRestaurants: 0,
    mergedSignals: 0,
    skippedRows: 0,
  };

  const rows = Array.isArray(manual.restaurants) ? manual.restaurants : [];
  rows.forEach((row) => {
    const manualSignals = (row.signals || []).filter((signal) => ALLOWED_SOURCE_IDS.has(signal.sourceId));
    if (!manualSignals.length) {
      report.skippedRows += 1;
      return;
    }
    const target = findOrCreateRestaurant(signals, row);
    const existing = new Map((target.signals || []).map((signal) => [signalKey(signal), signal]));
    manualSignals.forEach((signal) => {
      const normalized = {
        ...signal,
        score: Number(signal.score),
        generatedBy: signal.generatedBy || "scripts/merge-platform-signals.js",
      };
      existing.set(signalKey(normalized), normalized);
      report.mergedSignals += 1;
    });
    target.signals = [...existing.values()].sort((a, b) => {
      return String(a.sourceId).localeCompare(String(b.sourceId)) || String(a.type).localeCompare(String(b.type));
    });
    report.mergedRestaurants += 1;
  });

  const today = taipeiDate();
  signals.version = `platform-merge-${today}`;
  signals.updated = today;
  signals.automation = {
    ...(signals.automation || {}),
    platformManualMerge: {
      lastRun: new Date().toISOString(),
      sourceFile: "assets/platform-signals.manual.json",
      mergedRestaurants: report.mergedRestaurants,
      mergedSignals: report.mergedSignals,
    },
  };
  return report;
}

function main() {
  const manual = readJson(manualSignalsPath);
  const errors = validateManual(manual);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  const signals = readJson(externalSignalsPath);
  const report = mergeManualSignals(signals, manual);
  writeJson(externalSignalsPath, signals);
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main();
