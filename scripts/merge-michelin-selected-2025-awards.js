const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const candidatesPath = path.join(repoRoot, "assets", "michelin-taiwan-2025-official-candidates.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.michelin-selected-2025-draft.json");
const reportPath = path.join(repoRoot, "assets", "michelin-selected-2025-merge-report.json");
const sourceUrl = "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/taiwan-full-list";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function namesOf(row) {
  return [row.name, ...(row.aliases || [])].filter(Boolean);
}

function cleanAliases(name, aliases) {
  const nameKey = normalizeName(name);
  return [...new Set((aliases || []).filter(Boolean))]
    .filter((alias) => normalizeName(alias) && normalizeName(alias) !== nameKey);
}

function awardKey(award) {
  return [award.guide, award.level || "", award.year || "", award.plates || "", award.bowls || "", award.sweets || ""].join("|");
}

function selectedAward(candidate) {
  return (candidate.awards || []).find((award) => award.guide === "michelin_selected") || null;
}

function findMatch(candidate, rows) {
  const city = candidate.city || "";
  const candidateNames = namesOf(candidate).map(normalizeName).filter(Boolean);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if ((row.city || "") !== city) continue;
    const rowNames = namesOf(row).map(normalizeName).filter(Boolean);
    if (candidateNames.some((name) => rowNames.includes(name))) return { index, row };
  }
  return null;
}

function addAward(row, award) {
  row.awards = row.awards || [];
  const keys = new Set(row.awards.map(awardKey));
  const key = awardKey(award);
  if (keys.has(key)) return false;
  row.awards.push(award);
  return true;
}

function main() {
  const awards = readJson(awardsPath);
  const candidates = readJson(candidatesPath);
  const rows = JSON.parse(JSON.stringify(awards.restaurants || []));
  const report = {
    generatedAt: new Date().toISOString(),
    source: sourceUrl,
    candidates: 0,
    mergedExisting: 0,
    addedRestaurants: 0,
    skippedDuplicate: 0,
    skippedMissingCityOrName: 0,
    policy: "Michelin selected restaurants are imported as weak guide=michelin_selected awards. They get low rank bonus and lower-priority badges than stars/Bib/500-series.",
  };

  for (const candidate of candidates.restaurants || []) {
    const award = selectedAward(candidate);
    if (!award) continue;
    report.candidates += 1;
    if (!candidate.city || !candidate.name) {
      report.skippedMissingCityOrName += 1;
      continue;
    }
    const normalizedAward = {
      guide: "michelin_selected",
      level: "入選餐廳",
      year: award.year || 2025,
      url: award.url || sourceUrl,
    };
    const match = findMatch(candidate, rows);
    if (match) {
      match.row.aliases = cleanAliases(match.row.name, [
        ...(match.row.aliases || []),
        candidate.name,
        ...(candidate.aliases || []),
      ]);
      if (addAward(match.row, normalizedAward)) report.mergedExisting += 1;
      else report.skippedDuplicate += 1;
      continue;
    }
    rows.push({
      name: candidate.name,
      aliases: cleanAliases(candidate.name, candidate.aliases),
      city: candidate.city,
      address: candidate.address || "",
      source: candidate.source || sourceUrl,
      awards: [normalizedAward],
    });
    report.addedRestaurants += 1;
  }

  const draft = JSON.parse(JSON.stringify(awards));
  draft.restaurants = rows.sort((a, b) => `${a.city || ""}${a.name}`.localeCompare(`${b.city || ""}${b.name}`, "zh-Hant"));
  draft.updated = "2026-07-01";
  draft._README = draft._README.replace("guide 可為 michelin / bib / greenstar", "guide 可為 michelin / michelin_selected / bib / greenstar");
  draft._coverage.note = `${draft._coverage.note} 2025 Michelin 入選餐廳已以低權重弱徽章匯入，來源為官方完整名單。`;
  if (!draft._sources.includes(sourceUrl)) draft._sources.push(sourceUrl);

  writeJson(draftPath, draft);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
