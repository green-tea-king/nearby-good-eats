const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.500sweet-2025-draft.json");

const MIN_GUIDE_COUNT = 30;
const DEFAULT_EXCLUDED_GUIDES = [
  "50best",
  "50bestdiscovery",
  "designawards",
  "fmg",
  "gdgawards",
  "greenstar",
  "michelinspecial",
  "oad",
  "taichunglowcarbon",
  "tatlerbest",
  "tcfpraise",
  "thebestchef",
  "worldculinary",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countGuides(rows) {
  const guides = {};
  for (const row of rows || []) {
    for (const award of row.awards || []) {
      const guide = String(award.guide || "").trim();
      if (!guide) continue;
      guides[guide] = (guides[guide] || 0) + 1;
    }
  }
  return guides;
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

function pruneFile(file, excludedGuides = null) {
  const awards = readJson(file);
  const beforeRows = awards.restaurants || [];
  const counts = countGuides(beforeRows);
  const finalExcludedGuides = excludedGuides || Object.entries(counts)
    .filter(([, count]) => Number(count) < MIN_GUIDE_COUNT)
    .map(([guide]) => guide)
    .sort();
  const excludedSet = new Set(finalExcludedGuides);

  let removedAwards = 0;
  let removedRestaurants = 0;

  const nextRows = beforeRows
    .map((row) => {
      const nextAwards = (row.awards || []).filter((award) => {
        const keep = !excludedSet.has(String(award.guide || "").trim());
        if (!keep) removedAwards += 1;
        return keep;
      });
      return {
        ...row,
        awards: nextAwards,
      };
    })
    .filter((row) => {
      const keep = Array.isArray(row.awards) && row.awards.length > 0;
      if (!keep) removedRestaurants += 1;
      return keep;
    });

  awards.restaurants = nextRows;
  awards.updated = taipeiDate();
  awards._smallSampleThreshold = MIN_GUIDE_COUNT;
  awards._excludedSmallSampleGuides = finalExcludedGuides;

  writeJson(file, awards);

  return {
    file: path.relative(repoRoot, file).replace(/\\/g, "/"),
    excludedGuides: finalExcludedGuides,
    removedAwards,
    removedRestaurants,
    remainingRestaurants: nextRows.length,
    remainingGuides: countGuides(nextRows),
  };
}

function main() {
  const primary = pruneFile(awardsPath, DEFAULT_EXCLUDED_GUIDES);
  const reports = [primary];
  if (fs.existsSync(draftPath)) {
    reports.push(pruneFile(draftPath, primary.excludedGuides));
  }
  console.log(JSON.stringify({
    ok: true,
    threshold: MIN_GUIDE_COUNT,
    excludedGuides: primary.excludedGuides,
    files: reports,
  }, null, 2));
}

main();
