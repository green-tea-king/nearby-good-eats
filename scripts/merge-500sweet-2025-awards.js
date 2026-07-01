const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const manualPath = path.join(repoRoot, "assets", "500sweet-2025-manual.json");
const candidatesPath = path.join(repoRoot, "assets", "500sweet-2025-candidates.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.500sweet-2025-draft.json");
const reportPath = path.join(repoRoot, "assets", "500sweet-2025-merge-report.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/臺/g, "台")
    .replace(/[’‘`´]/g, "'")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×\s]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function identity(row) {
  return `${row.city || ""}|${normalizeName(row.name)}`;
}

function identityKeys(row) {
  return [row.name, ...(row.aliases || [])]
    .map((name) => `${row.city || ""}|${normalizeName(name)}`)
    .filter((key) => !key.endsWith("|"));
}

function awardKey(award) {
  return [award.guide, award.year || "", award.level || "", award.sweets || "", Array.isArray(award.dishSweets) ? award.dishSweets.join(",") : ""].join("|");
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

function validateManual(manual) {
  const errors = [];
  if (!manual.policy || manual.policy.runtimeExternalLookup !== false || manual.policy.batchOnly !== true) {
    errors.push("manual 500sweet policy must enforce runtimeExternalLookup=false and batchOnly=true");
  }
  for (const [index, row] of (manual.restaurants || []).entries()) {
    const prefix = `restaurants[${index}]`;
    if (!row.name) errors.push(`${prefix} missing name`);
    if (!row.city) errors.push(`${prefix} missing city`);
    if (!row.sourceUrl) errors.push(`${prefix} missing sourceUrl`);
    if (!row.reviewedBy) errors.push(`${prefix} missing reviewedBy`);
    if (row.sweets != null && (!Number.isFinite(Number(row.sweets)) || Number(row.sweets) < 0)) errors.push(`${prefix} invalid sweets`);
    if (row.dishSweets != null && (!Array.isArray(row.dishSweets) || row.dishSweets.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0))) {
      errors.push(`${prefix} invalid dishSweets`);
    }
  }
  return errors;
}

function validateCandidates(candidates) {
  const errors = [];
  for (const [index, row] of (candidates.restaurants || []).entries()) {
    const prefix = `candidates.restaurants[${index}]`;
    if (!row.name) errors.push(`${prefix} missing name`);
    if (row.importConfidence === "high" && !row.city) errors.push(`${prefix} high confidence row missing city`);
    for (const award of row.awards || []) {
      if (award.guide !== "500sweet") errors.push(`${prefix} invalid guide ${award.guide}`);
      if (award.year !== 2025) errors.push(`${prefix} invalid year ${award.year}`);
      if (!award.url) errors.push(`${prefix} award missing url`);
    }
  }
  return errors;
}

function buildAward(row) {
  const dishSweets = Array.isArray(row.dishSweets) ? row.dishSweets.map(Number).filter((value) => Number.isFinite(value) && value > 0) : [];
  const sweets = Number(row.sweets || (dishSweets.length ? dishSweets.reduce((sum, value) => sum + value, 0) : 0)) || undefined;
  return {
    guide: "500sweet",
    year: 2025,
    ...(sweets ? { sweets } : {}),
    ...(dishSweets.length ? { dishSweets } : {}),
    level: row.level || (sweets ? `${sweets}甜` : "入選"),
    url: row.sourceUrl,
  };
}

function candidateToManualShape(row) {
  const award = (row.awards || []).find((item) => item.guide === "500sweet") || {};
  return {
    name: row.name,
    city: row.city,
    address: row.address || "",
    aliases: row.aliases || [],
    sweets: award.sweets,
    dishSweets: award.dishSweets,
    level: award.level,
    sourceUrl: award.url || row.source?.url,
    reviewedBy: "scripts/build-500sweet-2025-candidates.js",
  };
}

function merge() {
  const awards = readJson(awardsPath);
  const manual = readJson(manualPath);
  const candidates = fs.existsSync(candidatesPath) ? readJson(candidatesPath) : { restaurants: [] };
  const errors = [...validateManual(manual), ...validateCandidates(candidates)];
  const candidateRows = (candidates.restaurants || [])
    .filter((row) => row.importConfidence === "high")
    .map(candidateToManualShape);
  const manualRows = manual.restaurants || [];
  const mergeRows = [...candidateRows, ...manualRows];
  const report = {
    generatedAt: new Date().toISOString(),
    source: candidates.sourceUrl || manual.sourceUrl,
    candidates: (candidates.restaurants || []).length,
    highConfidenceCandidates: candidateRows.length,
    manualRows: manualRows.length,
    skippedNeedsReview: (candidates.restaurants || []).filter((row) => row.importConfidence === "needs_city_review").length,
    skippedNonCityBucket: (candidates.restaurants || []).filter((row) => row.importConfidence === "skip_non_city_bucket").length,
    addedRestaurants: 0,
    updatedExistingRestaurants: 0,
    skippedDuplicateAward: 0,
    errors,
  };
  if (errors.length) {
    writeJson(reportPath, report);
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  const rows = Array.isArray(awards.restaurants) ? awards.restaurants : [];
  const byKey = new Map();
  for (const row of rows) {
    for (const key of identityKeys(row)) byKey.set(key, row);
  }
  for (const candidate of mergeRows) {
    const key = identity(candidate);
    let target = byKey.get(key);
    const existed = Boolean(target);
    if (!target) {
      target = {
        name: candidate.name,
        address: candidate.address || "",
        awards: [],
        city: candidate.city,
        area: candidate.area || "",
        aliases: candidate.aliases || [],
      };
      rows.push(target);
      byKey.set(key, target);
      report.addedRestaurants += 1;
    } else {
      const aliases = new Set([...(target.aliases || []), ...(candidate.aliases || [])].filter(Boolean));
      target.aliases = [...aliases];
    }

    const award = buildAward(candidate);
    const existingAwards = new Set((target.awards || []).map(awardKey));
    if (existingAwards.has(awardKey(award))) {
      report.skippedDuplicateAward += 1;
      continue;
    }
    target.awards = target.awards || [];
    target.awards.push(award);
    if (existed) report.updatedExistingRestaurants += 1;
  }

  awards.restaurants = rows.sort((a, b) => `${a.city || ""}${a.name}`.localeCompare(`${b.city || ""}${b.name}`, "zh-Hant"));
  awards.updated = taipeiDate();
  awards._README = awards._README
    .replace("500甜保留格式，尚未匯入未驗證資料", "500甜已匯入 2025 官方文字名單高信心資料")
    .replace("500甜目前先支援格式與徽章，待批次來源驗證後再匯入正式資料", "500甜已匯入 2025 官方文字名單高信心資料");
  awards._coverage.note = `${String(awards._coverage.note || "").replace("500甜僅先支援格式與前端徽章，待批次來源驗證後再匯入。", "500甜已匯入 2025 官方文字名單高信心資料，連鎖與線上通路保留在 merge report 待人工覆核。")} 2025 500甜已匯入官方文字名單高信心資料。`;
  if (candidates.sourceUrl && !awards._sources.includes(candidates.sourceUrl)) awards._sources.push(candidates.sourceUrl);
  if ((manual.restaurants || []).length && !awards._sources.includes(manual.sourceUrl)) awards._sources.push(manual.sourceUrl);

  writeJson(draftPath, awards);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

merge();
