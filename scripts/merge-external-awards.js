const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const externalAwardsPath = path.join(repoRoot, "assets", "external-awards.manual.json");
const fiftyDiscoveryCandidatesPath = path.join(repoRoot, "assets", "50best-discovery-taiwan-candidates.json");
const oadCandidatesPath = path.join(repoRoot, "assets", "oad-asia-2025-candidates.json");
const bestChefCandidatesPath = path.join(repoRoot, "assets", "thebestchef-taiwan-2025-candidates.json");
const designAwardsCandidatesPath = path.join(repoRoot, "assets", "restaurant-design-awards-taiwan-candidates.json");
const fmgCandidatesPath = path.join(repoRoot, "assets", "fmg-taiwan-2025-candidates.json");
const greenVeggieCandidatesPath = path.join(repoRoot, "assets", "green-veggie-guide-2025-candidates.json");
const gdgAwardsCandidatesPath = path.join(repoRoot, "assets", "gdg-awards-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "external-awards-merge-report.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function normalizeCity(value) {
  return String(value || "").replace(/台/g, "臺").trim();
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&+]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function identityKeys(row) {
  const city = normalizeCity(row.city);
  return [row.name, ...(row.aliases || [])]
    .map((name) => normalizeName(name))
    .filter(Boolean)
    .map((name) => `${city}|${name}`);
}

function mergeAliases(name, existingAliases, incomingAliases) {
  const nameKey = normalizeName(name);
  const seen = new Set();
  const aliases = [];
  for (const alias of [...(existingAliases || []), ...(incomingAliases || [])]) {
    const key = normalizeName(alias);
    if (!key || key === nameKey || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

function awardKey(award) {
  return [
    award.guide,
    award.year || "",
    award.level || "",
    award.rank || "",
    award.plates || "",
    award.bowls || "",
    award.sweets || "",
  ].join("|");
}

function validateExternalAwards(data) {
  const errors = [];
  if (!data.policy || data.policy.runtimeExternalLookup !== false || data.policy.batchOnly !== true || data.policy.noFakeData !== true) {
    errors.push("external awards policy must enforce runtimeExternalLookup=false, batchOnly=true, noFakeData=true");
  }
  for (const [index, row] of (data.restaurants || []).entries()) {
    const prefix = `restaurants[${index}]`;
    if (!row.name) errors.push(`${prefix} missing name`);
    if (!row.city) errors.push(`${prefix} missing city`);
    if (!Array.isArray(row.awards) || !row.awards.length) errors.push(`${prefix} missing awards`);
    for (const award of row.awards || []) {
      if (!award.guide) errors.push(`${prefix} award missing guide`);
      if (!award.year) errors.push(`${prefix} award missing year`);
      if (!award.url) errors.push(`${prefix} award missing url`);
    }
  }
  return errors;
}

function main() {
  const awards = readJson(awardsPath);
  const externalAwards = readJson(externalAwardsPath);
  const fiftyDiscoveryCandidates = fs.existsSync(fiftyDiscoveryCandidatesPath) ? readJson(fiftyDiscoveryCandidatesPath) : { restaurants: [] };
  const oadCandidates = fs.existsSync(oadCandidatesPath) ? readJson(oadCandidatesPath) : { restaurants: [] };
  const bestChefCandidates = fs.existsSync(bestChefCandidatesPath) ? readJson(bestChefCandidatesPath) : { restaurants: [] };
  const designAwardsCandidates = fs.existsSync(designAwardsCandidatesPath) ? readJson(designAwardsCandidatesPath) : { restaurants: [] };
  const fmgCandidates = fs.existsSync(fmgCandidatesPath) ? readJson(fmgCandidatesPath) : { restaurants: [] };
  const greenVeggieCandidates = fs.existsSync(greenVeggieCandidatesPath) ? readJson(greenVeggieCandidatesPath) : { restaurants: [] };
  const gdgAwardsCandidates = fs.existsSync(gdgAwardsCandidatesPath) ? readJson(gdgAwardsCandidatesPath) : { restaurants: [], needsCityReview: [] };
  const mergeCandidates = [
    ...(externalAwards.restaurants || []),
    ...(fiftyDiscoveryCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
    ...(oadCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
    ...(bestChefCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
    ...(designAwardsCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
    ...(fmgCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
    ...(greenVeggieCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
    ...(gdgAwardsCandidates.restaurants || []).filter((row) => row.importConfidence === "high"),
  ];
  const rows = Array.isArray(awards.restaurants) ? awards.restaurants : [];
  const errors = validateExternalAwards(externalAwards);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      "assets/external-awards.manual.json",
      ...(fs.existsSync(fiftyDiscoveryCandidatesPath) ? ["assets/50best-discovery-taiwan-candidates.json"] : []),
      ...(fs.existsSync(oadCandidatesPath) ? ["assets/oad-asia-2025-candidates.json"] : []),
      ...(fs.existsSync(bestChefCandidatesPath) ? ["assets/thebestchef-taiwan-2025-candidates.json"] : []),
      ...(fs.existsSync(designAwardsCandidatesPath) ? ["assets/restaurant-design-awards-taiwan-candidates.json"] : []),
      ...(fs.existsSync(fmgCandidatesPath) ? ["assets/fmg-taiwan-2025-candidates.json"] : []),
      ...(fs.existsSync(greenVeggieCandidatesPath) ? ["assets/green-veggie-guide-2025-candidates.json"] : []),
      ...(fs.existsSync(gdgAwardsCandidatesPath) ? ["assets/gdg-awards-2025-candidates.json"] : []),
    ],
    candidates: mergeCandidates.length,
    manualCandidates: (externalAwards.restaurants || []).length,
    fiftyDiscoveryCandidates: (fiftyDiscoveryCandidates.restaurants || []).length,
    oadCandidates: (oadCandidates.restaurants || []).length,
    bestChefCandidates: (bestChefCandidates.restaurants || []).length,
    designAwardsCandidates: (designAwardsCandidates.restaurants || []).length,
    fmgCandidates: (fmgCandidates.restaurants || []).length,
    greenVeggieCandidates: (greenVeggieCandidates.restaurants || []).length,
    gdgAwardsCandidates: (gdgAwardsCandidates.restaurants || []).length,
    skippedFiftyDiscoveryNeedsReview: (fiftyDiscoveryCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    skippedOadNeedsReview: (oadCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    skippedBestChefNeedsReview: (bestChefCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    skippedDesignAwardsNeedsReview: (designAwardsCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    skippedFmgNeedsReview: (fmgCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    skippedGreenVeggieNeedsReview: (greenVeggieCandidates.needsCityReview || []).length
      + (greenVeggieCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    skippedGdgAwardsNeedsReview: (gdgAwardsCandidates.needsCityReview || []).length
      + (gdgAwardsCandidates.restaurants || []).filter((row) => row.importConfidence !== "high").length,
    addedRestaurants: 0,
    updatedExistingRestaurants: 0,
    skippedDuplicateAward: 0,
    mergedAwards: 0,
    errors,
  };

  if (errors.length) {
    writeJson(reportPath, report);
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  const byKey = new Map();
  for (const row of rows) {
    for (const key of identityKeys(row)) byKey.set(key, row);
  }

  for (const candidate of mergeCandidates) {
    const keys = identityKeys(candidate);
    let target = keys.map((key) => byKey.get(key)).find(Boolean);
    const existed = Boolean(target);
    if (!target) {
      target = {
        name: candidate.name,
        city: normalizeCity(candidate.city),
        address: candidate.address || "",
        aliases: mergeAliases(candidate.name, [], candidate.aliases),
        awards: [],
      };
      rows.push(target);
      report.addedRestaurants += 1;
    } else {
      target.city = normalizeCity(target.city || candidate.city);
      target.aliases = mergeAliases(target.name, target.aliases, candidate.aliases);
    }

    const existingAwards = new Set((target.awards || []).map(awardKey));
    for (const award of candidate.awards || []) {
      if (existingAwards.has(awardKey(award))) {
        report.skippedDuplicateAward += 1;
        continue;
      }
      target.awards = target.awards || [];
      target.awards.push(award);
      existingAwards.add(awardKey(award));
      report.mergedAwards += 1;
      if (existed) report.updatedExistingRestaurants += 1;
    }

    for (const key of identityKeys(target)) byKey.set(key, target);
  }

  awards.restaurants = rows.sort((a, b) => `${a.city || ""}${a.name}`.localeCompare(`${b.city || ""}${b.name}`, "zh-Hant"));
  awards.updated = taipeiDate();
  awards._sources = [...new Set([
    ...(awards._sources || []),
    ...((externalAwards.sources || []).map((source) => source.url)),
    ...(fiftyDiscoveryCandidates.sourceUrl ? [fiftyDiscoveryCandidates.sourceUrl] : []),
    ...(oadCandidates.sourceUrl ? [oadCandidates.sourceUrl] : []),
    ...(bestChefCandidates.source ? [bestChefCandidates.source] : []),
    ...(designAwardsCandidates.sourceUrl ? [designAwardsCandidates.sourceUrl] : []),
    ...(fmgCandidates.sourceUrl ? [fmgCandidates.sourceUrl] : []),
    ...(greenVeggieCandidates.sourceUrl ? [greenVeggieCandidates.sourceUrl] : []),
    ...(gdgAwardsCandidates.sourceUrl ? [gdgAwardsCandidates.sourceUrl] : []),
  ].filter(Boolean))];

  writeJson(awardsPath, awards);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
