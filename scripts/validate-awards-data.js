const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const sweetManualPath = path.join(repoRoot, "assets", "500sweet-2025-manual.json");
const sweetCandidatesPath = path.join(repoRoot, "assets", "500sweet-2025-candidates.json");

const ALLOWED_GUIDES = new Set([
  "michelin",
  "michelin_selected",
  "bib",
  "500plate",
  "500bowl",
  "500sweet",
]);

const EXPECTED = {
  restaurants: 1329,
  guides: {
    michelin: 53,
    michelin_selected: 223,
    bib: 144,
    "500plate": 260,
    "500bowl": 415,
    "500sweet": 328,
  },
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/[()\-_/&+,\s]/g, "")
    .toLowerCase();
}

function awardKey(award) {
  return [
    award.guide,
    award.level || "",
    award.year || "",
    award.plates || "",
    award.bowls || "",
    award.sweets || "",
  ].join("|");
}

function countGuides(data) {
  const guides = {};
  for (const row of data.restaurants || []) {
    for (const award of row.awards || []) {
      guides[award.guide] = (guides[award.guide] || 0) + 1;
    }
  }
  return guides;
}

function findDuplicateIdentityKeys(data) {
  const keys = new Map();
  for (const row of data.restaurants || []) {
    const names = [row.name, ...(row.aliases || [])].map(normalizeName).filter(Boolean);
    for (const name of names) {
      const key = `${row.city || ""}|${name}`;
      if (!keys.has(key)) keys.set(key, new Set());
      keys.get(key).add(row.name);
    }
  }
  return [...keys.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([key, names]) => ({ key, names: [...names] }));
}

function validateAwards(data) {
  const errors = [];
  const guides = countGuides(data);

  if ((data.restaurants || []).length !== EXPECTED.restaurants) {
    errors.push(`restaurants expected ${EXPECTED.restaurants}, got ${(data.restaurants || []).length}`);
  }

  for (const [guide, expected] of Object.entries(EXPECTED.guides)) {
    if ((guides[guide] || 0) !== expected) {
      errors.push(`${guide} expected ${expected}, got ${guides[guide] || 0}`);
    }
  }

  for (const row of data.restaurants || []) {
    if (!row.name || !row.city || !Array.isArray(row.awards) || row.awards.length === 0) {
      errors.push(`missing core fields: ${row.name || "(missing name)"}`);
      continue;
    }

    const aliasKeys = new Set();
    const nameKey = normalizeName(row.name);
    for (const alias of row.aliases || []) {
      const aliasKey = normalizeName(alias);
      if (!aliasKey) continue;
      if (aliasKey === nameKey) errors.push(`self alias: ${row.city || ""}|${row.name}|${alias}`);
      if (aliasKeys.has(aliasKey)) errors.push(`duplicate alias: ${row.city || ""}|${row.name}|${alias}`);
      aliasKeys.add(aliasKey);
    }

    const awardKeys = new Set();
    for (const award of row.awards || []) {
      if (!ALLOWED_GUIDES.has(award.guide)) {
        errors.push(`unknown guide: ${row.name}|${award.guide}`);
      }
      if (!award.year) {
        errors.push(`missing award year: ${row.city || ""}|${row.name}|${award.guide}`);
      }
      const key = awardKey(award);
      if (awardKeys.has(key)) errors.push(`duplicate award: ${row.name}|${key}`);
      awardKeys.add(key);
    }
  }

  for (const duplicate of findDuplicateIdentityKeys(data)) {
    errors.push(`duplicate identity key: ${duplicate.key} => ${duplicate.names.join(", ")}`);
  }

  return { guides, errors };
}

function validateSweetManual(data) {
  const errors = [];
  if (!data.policy || data.policy.runtimeExternalLookup !== false || data.policy.batchOnly !== true) {
    errors.push("500sweet manual policy must enforce runtimeExternalLookup=false and batchOnly=true");
  }
  for (const [index, row] of (data.restaurants || []).entries()) {
    const prefix = `500sweet manual restaurants[${index}]`;
    if (!row.name) errors.push(`${prefix} missing name`);
    if (!row.city) errors.push(`${prefix} missing city`);
    if (!row.sourceUrl) errors.push(`${prefix} missing sourceUrl`);
    if (!row.reviewedBy) errors.push(`${prefix} missing reviewedBy`);
  }
  return {
    rows: (data.restaurants || []).length,
    errors,
  };
}

function validateSweetCandidates(data) {
  const errors = [];
  const rows = data.restaurants || [];
  if (data.sourceUrl !== "https://500times.udn.com/wtimes/story/124537/8931871") {
    errors.push("500sweet candidates sourceUrl changed; review import source before accepting");
  }
  if (rows.length !== 356) errors.push(`500sweet candidates expected 356, got ${rows.length}`);
  const highConfidence = rows.filter((row) => row.importConfidence === "high").length;
  const skippedNonCity = rows.filter((row) => row.importConfidence === "skip_non_city_bucket").length;
  const needsCityReview = rows.filter((row) => row.importConfidence === "needs_city_review").length;
  if (highConfidence !== 328) errors.push(`500sweet high confidence expected 328, got ${highConfidence}`);
  if (skippedNonCity !== 23) errors.push(`500sweet skipped non-city expected 23, got ${skippedNonCity}`);
  if (needsCityReview !== 5) errors.push(`500sweet needs city review expected 5, got ${needsCityReview}`);
  return { rows: rows.length, highConfidence, skippedNonCity, needsCityReview, errors };
}

function main() {
  const formal = readJson(awardsPath);
  const result = validateAwards(formal);
  const sweetManual = fs.existsSync(sweetManualPath)
    ? validateSweetManual(readJson(sweetManualPath))
    : { rows: 0, errors: [] };
  const sweetCandidates = fs.existsSync(sweetCandidatesPath)
    ? validateSweetCandidates(readJson(sweetCandidatesPath))
    : { rows: 0, highConfidence: 0, skippedNonCity: 0, needsCityReview: 0, errors: ["missing 500sweet candidates"] };
  const errors = [...result.errors, ...sweetManual.errors, ...sweetCandidates.errors];

  const summary = {
    ok: errors.length === 0,
    restaurants: (formal.restaurants || []).length,
    guides: result.guides,
    sweetManualRows: sweetManual.rows,
    sweetCandidates: {
      rows: sweetCandidates.rows,
      highConfidence: sweetCandidates.highConfidence,
      skippedNonCity: sweetCandidates.skippedNonCity,
      needsCityReview: sweetCandidates.needsCityReview,
    },
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exit(1);
}

main();
