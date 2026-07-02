const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const manualPath = path.join(repoRoot, "assets", "external-awards.manual.json");
const outPath = path.join(repoRoot, "assets", "world-culinary-awards-taiwan-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "world-culinary-awards-taiwan-2025-import-report.json");

const SOURCE_URL = "https://worldculinaryawards.com/award/taiwan-best-restaurant/2025";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const manual = readJson(manualPath);
  const generatedAt = new Date().toISOString();
  const rows = (manual.restaurants || [])
    .filter((row) => (row.awards || []).some((award) => award.guide === "worldculinary" && award.year === 2025))
    .map((row) => ({
      name: row.name,
      city: row.city || "",
      district: row.district || "",
      address: row.address || "",
      cuisine: row.cuisine || "",
      aliases: row.aliases || [],
      awards: (row.awards || [])
        .filter((award) => award.guide === "worldculinary" && award.year === 2025)
        .map((award) => ({
          guide: award.guide,
          awardName: award.awardName || "World Culinary Awards Taiwan Best Restaurant",
          year: award.year,
          level: award.level || "",
          winner: award.winner === true,
          url: award.url || SOURCE_URL,
          capturedAt: award.capturedAt || "2026-07-02",
          notes: award.notes || "Collected from World Culinary Awards Taiwan Best Restaurant 2025 official public page.",
        })),
      importConfidence: "high",
      sourceUrls: [...new Set((row.awards || []).filter((award) => award.guide === "worldculinary").map((award) => award.url).filter(Boolean))],
    }))
    .sort((a, b) => `${a.city}${a.name}`.localeCompare(`${b.city}${b.name}`, "zh-Hant"));

  const winnerCount = rows.reduce((sum, row) => sum + row.awards.filter((award) => award.winner).length, 0);
  const nomineeCount = rows.reduce((sum, row) => sum + row.awards.filter((award) => !award.winner).length, 0);

  const payload = {
    version: "world-culinary-awards-taiwan-2025-candidates",
    generatedAt,
    sourceUrl: SOURCE_URL,
    sourceCatalog: [
      {
        id: "world-culinary-awards-taiwan-2025",
        label: "World Culinary Awards Taiwan Best Restaurant 2025",
        url: SOURCE_URL,
      },
    ],
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_page_batch",
      authority: "international_hospitality_award",
      notes: [
        "Only World Culinary Awards Taiwan Best Restaurant 2025 entries are included.",
        "Rows keep year, level, source URL, capturedAt, and notes for review provenance.",
        "No runtime scraping or API lookup is used by the frontend.",
      ],
    },
    restaurants: rows,
  };

  const report = {
    generatedAt,
    sourceUrl: SOURCE_URL,
    restaurants: rows.length,
    awards: rows.reduce((sum, row) => sum + (row.awards || []).length, 0),
    winnerCount,
    nomineeCount,
    names: rows.map((row) => ({
      name: row.name,
      city: row.city,
      awards: (row.awards || []).map((award) => award.level),
    })),
  };

  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
