const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");

const CANONICAL_GROUPS = [
  {
    city: "臺北市",
    canonicalName: "頤宮",
    aliases: ["Le Palais", "頤宮中餐廳", "頤宮中餐廳 Le Palais"],
  },
  {
    city: "臺北市",
    canonicalName: "心宴 aMaze",
    aliases: ["aMaze", "aMaze 心宴", "心宴"],
  },
];

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&+]/g, "")
    .toLowerCase();
}

function normalizeCity(value) {
  return String(value || "").replace(/台/g, "臺").trim();
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
    award.knives || "",
  ].join("|");
}

function groupKey(row) {
  const city = normalizeCity(row.city);
  const keys = [row.name, ...(row.aliases || [])].map(normalizeName).filter(Boolean);
  for (const group of CANONICAL_GROUPS) {
    if (normalizeCity(group.city) !== city) continue;
    const groupKeys = [group.canonicalName, ...(group.aliases || [])].map(normalizeName);
    if (keys.some((key) => groupKeys.includes(key))) return `${city}|${normalizeName(group.canonicalName)}`;
  }
  return `${city}|${normalizeName(row.name)}`;
}

function mergeRow(target, row) {
  if (!target.address && row.address) target.address = row.address;
  if (!target.source && row.source) target.source = row.source;
  const sourceUrls = new Set();
  const sources = [];
  for (const source of [...(target.sources || []), ...(row.sources || [])]) {
    const key = [source.guide || "", source.year || "", source.url || "", source.note || ""].join("|");
    if (sourceUrls.has(key)) continue;
    sourceUrls.add(key);
    sources.push(source);
  }
  if (sources.length) target.sources = sources;

  const awards = target.awards || [];
  const awardKeys = new Set(awards.map(awardKey));
  for (const award of row.awards || []) {
    const key = awardKey(award);
    if (awardKeys.has(key)) continue;
    awardKeys.add(key);
    awards.push(award);
  }
  target.awards = awards;

  target.aliases = [
    ...(target.aliases || []),
    row.name,
    ...(row.aliases || []),
  ];
}

function main() {
  const data = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
  let selfAliases = 0;
  let duplicateAliases = 0;
  let mergedRows = 0;

  const byGroup = new Map();
  const rows = [];
  for (const row of data.restaurants || []) {
    row.city = normalizeCity(row.city);
    const group = CANONICAL_GROUPS.find((candidate) => `${normalizeCity(candidate.city)}|${normalizeName(candidate.canonicalName)}` === groupKey(row));
    if (group) {
      row.name = group.canonicalName;
      row.aliases = [...(row.aliases || []), ...group.aliases];
    }
    const key = groupKey(row);
    const existing = byGroup.get(key);
    if (existing) {
      mergeRow(existing, row);
      mergedRows += 1;
    } else {
      byGroup.set(key, row);
      rows.push(row);
    }
  }
  data.restaurants = rows;

  for (const row of data.restaurants || []) {
    const nameKey = normalizeName(row.name);
    const seen = new Set();
    const aliases = [];
    for (const alias of row.aliases || []) {
      const key = normalizeName(alias);
      if (!key) continue;
      if (key === nameKey) {
        selfAliases += 1;
        continue;
      }
      if (seen.has(key)) {
        duplicateAliases += 1;
        continue;
      }
      seen.add(key);
      aliases.push(alias);
    }
    row.aliases = aliases;
  }

  fs.writeFileSync(awardsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ selfAliases, duplicateAliases, mergedRows }, null, 2));
}

main();
