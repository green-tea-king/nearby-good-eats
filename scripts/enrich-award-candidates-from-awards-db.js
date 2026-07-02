const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const targetFiles = [
  "tatler-best-taiwan-2025-candidates.json",
  "world-culinary-awards-taiwan-2025-candidates.json",
  "asias-50-best-restaurants-2026-candidates.json",
  "50best-discovery-taiwan-candidates.json",
].map((name) => path.join(repoRoot, "assets", name));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[()\-_/,&+]/g, "")
    .toLowerCase();
}

function buildAwardsIndex(rows) {
  const index = new Map();
  for (const row of rows || []) {
    const keys = [row.name, ...(row.aliases || [])]
      .map((value) => normalize(value))
      .filter(Boolean);
    for (const key of keys) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(row);
    }
  }
  return index;
}

function pickBestMatch(candidate, matches) {
  const city = String(candidate.city || "").trim();
  const cityMatches = matches.filter((row) => String(row.city || "").trim() === city);
  if (cityMatches.length === 1) return cityMatches[0];
  if (cityMatches.length > 1) {
    const exactName = cityMatches.find((row) => normalize(row.name) === normalize(candidate.name));
    if (exactName) return exactName;
  }
  if (matches.length === 1) return matches[0];
  return matches.find((row) => normalize(row.name) === normalize(candidate.name)) || null;
}

function enrichFile(file, awardsIndex) {
  const data = readJson(file);
  let enrichedRows = 0;
  let unresolvedRows = 0;
  let districtFilled = 0;
  let addressFilled = 0;
  let cuisineFilled = 0;

  for (const row of data.restaurants || []) {
    const keys = [row.name, ...(row.aliases || [])].map((value) => normalize(value)).filter(Boolean);
    const matches = [...new Set(keys.flatMap((key) => awardsIndex.get(key) || []))];
    const match = pickBestMatch(row, matches);
    if (!match) {
      unresolvedRows += 1;
      continue;
    }
    const before = JSON.stringify({
      district: row.district || "",
      address: row.address || "",
      cuisine: row.cuisine || "",
    });
    if (!row.district && match.district) {
      row.district = match.district;
      districtFilled += 1;
    }
    if (!row.address && match.address) {
      row.address = match.address;
      addressFilled += 1;
    }
    if (!row.cuisine && match.cuisine) {
      row.cuisine = match.cuisine;
      cuisineFilled += 1;
    }
    const after = JSON.stringify({
      district: row.district || "",
      address: row.address || "",
      cuisine: row.cuisine || "",
    });
    if (before !== after) enrichedRows += 1;
  }

  writeJson(file, data);
  return {
    file: path.relative(repoRoot, file).replace(/\\/g, "/"),
    rows: (data.restaurants || []).length,
    enrichedRows,
    unresolvedRows,
    districtFilled,
    addressFilled,
    cuisineFilled,
  };
}

function main() {
  const awards = readJson(awardsPath);
  const awardsIndex = buildAwardsIndex(awards.restaurants || []);
  const report = {
    generatedAt: new Date().toISOString(),
    source: "assets/awards-taiwan.json",
    files: targetFiles.filter((file) => fs.existsSync(file)).map((file) => enrichFile(file, awardsIndex)),
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
