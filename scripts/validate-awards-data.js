const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.michelin-taiwan-2025-official-draft.json");

const ALLOWED_GUIDES = new Set(["michelin", "bib", "greenstar", "500plate", "50best"]);
const EXPECTED = {
  restaurants: 427,
  guides: {
    michelin: 53,
    bib: 144,
    greenstar: 7,
    "500plate": 260,
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
    .replace(/臺/g, "台")
    .replace(/[’‘`´]/g, "'")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×\s]/g, "")
    .toLowerCase();
}

function awardKey(award) {
  return [award.guide, award.level || "", award.year || "", award.plates || ""].join("|");
}

function comparableRows(data) {
  return (data.restaurants || [])
    .map((row) => ({
      name: row.name,
      city: row.city,
      district: row.district || "",
      aliases: [...(row.aliases || [])].sort(),
      awards: (row.awards || [])
        .map((award) => ({
          guide: award.guide,
          level: award.level || "",
          year: award.year || "",
          plates: award.plates || "",
          url: award.url || "",
        }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    }))
    .sort((a, b) => `${a.city}${a.name}`.localeCompare(`${b.city}${b.name}`, "zh-Hant"));
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
      if (!ALLOWED_GUIDES.has(award.guide)) errors.push(`unknown guide: ${row.name}|${award.guide}`);
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

function compareFormalAndDraft(formal, draft) {
  const formalRows = comparableRows(formal);
  const draftRows = comparableRows(draft);
  const formalMap = new Map(formalRows.map((row) => [`${row.city}|${row.name}`, row]));
  const draftMap = new Map(draftRows.map((row) => [`${row.city}|${row.name}`, row]));
  const errors = [];

  for (const key of formalMap.keys()) {
    if (!draftMap.has(key)) errors.push(`draft missing row: ${key}`);
    else if (JSON.stringify(formalMap.get(key)) !== JSON.stringify(draftMap.get(key))) {
      errors.push(`draft differs: ${key}`);
    }
  }

  for (const key of draftMap.keys()) {
    if (!formalMap.has(key)) errors.push(`draft extra row: ${key}`);
  }

  return errors;
}

function main() {
  const formal = readJson(awardsPath);
  const draft = readJson(draftPath);
  const result = validateAwards(formal);
  const draftErrors = compareFormalAndDraft(formal, draft);
  const errors = [...result.errors, ...draftErrors];

  const summary = {
    ok: errors.length === 0,
    restaurants: (formal.restaurants || []).length,
    guides: result.guides,
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exit(1);
}

main();
