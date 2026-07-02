const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceManualPath = path.join(repoRoot, "assets", "external-awards.manual.json");
const outPath = path.join(repoRoot, "assets", "tatler-best-taiwan-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "tatler-best-taiwan-2025-import-report.json");

const SOURCE_URL = "https://www.tatlerasia.com/list/best-restaurants-taiwan";
const FILTER_URLS = {
  bestService: "https://www.tatlerasia.com/list/best-restaurants-taiwan?filter_1%5B%5D=french-tatler-best-restaurants",
  bestInnovation: "https://www.tatlerasia.com/list/best-restaurants-taiwan?filter_1%5B%5D=japanese-tatler-best-restaurants",
  risingStar: "https://www.tatlerasia.com/list/best-restaurants-taiwan?filter_1%5B%5D=japanese-tatler-best-restaurants",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildSourceCatalog() {
  return [
    {
      id: "tatler-best-taiwan-2025-top20",
      label: "Tatler Best Restaurants Taiwan 2025 Top 20",
      url: SOURCE_URL,
    },
    {
      id: "tatler-best-taiwan-2025-best-service",
      label: "Tatler Best Restaurants Taiwan 2025 Best Service",
      url: FILTER_URLS.bestService,
    },
    {
      id: "tatler-best-taiwan-2025-best-innovation",
      label: "Tatler Best Restaurants Taiwan 2025 Best Innovation",
      url: FILTER_URLS.bestInnovation,
    },
    {
      id: "tatler-best-taiwan-2025-rising-star",
      label: "Tatler Best Restaurants Taiwan 2025 Rising Star",
      url: FILTER_URLS.risingStar,
    },
    {
      id: "tatler-best-taiwan-2025-restaurant-of-the-year",
      label: "Tatler Best Restaurants Taiwan 2025 Restaurant of the Year",
      url: SOURCE_URL,
    },
    {
      id: "tatler-best-taiwan-2025-best-in-class",
      label: "Tatler Best Restaurants Taiwan 2025 Best-in-Class",
      url: SOURCE_URL,
    },
  ];
}

function main() {
  const manual = readJson(sourceManualPath);
  const generatedAt = new Date().toISOString();
  const rows = (manual.restaurants || [])
    .filter((row) => (row.awards || []).some((award) => award.guide === "tatlerbest" && award.year === 2025))
    .map((row) => ({
      name: row.name,
      city: row.city || "",
      district: row.district || "",
      address: row.address || "",
      cuisine: row.cuisine || "",
      aliases: row.aliases || [],
      awards: (row.awards || [])
        .filter((award) => award.guide === "tatlerbest" && award.year === 2025)
        .map((award) => ({
          guide: award.guide,
          awardName: award.awardName || "Tatler Best Restaurants Taiwan 2025",
          year: award.year,
          level: award.level || "",
          url: award.url || SOURCE_URL,
          capturedAt: award.capturedAt || "2026-07-02",
          notes: award.notes || "Collected from Tatler Best Restaurants Taiwan 2025 official public page.",
        })),
      importConfidence: "high",
      sourceUrls: [...new Set((row.awards || []).filter((award) => award.guide === "tatlerbest").map((award) => award.url).filter(Boolean))],
    }))
    .sort((a, b) => `${a.city}${a.name}`.localeCompare(`${b.city}${b.name}`, "zh-Hant"));

  const payload = {
    version: "tatler-best-taiwan-2025-candidates",
    generatedAt,
    sourceUrl: SOURCE_URL,
    sourceCatalog: buildSourceCatalog(),
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_page_batch",
      authority: "regional_hospitality_editorial_award",
      notes: [
        "Only Tatler Best Taiwan 2025 restaurant awards are included.",
        "Rows keep year, level, source URL, capturedAt, and notes for review provenance.",
        "No runtime scraping or API lookup is used by the frontend.",
      ],
    },
    restaurants: rows,
  };

  const levelCounts = {};
  for (const row of rows) {
    for (const award of row.awards || []) {
      levelCounts[award.level || "(none)"] = (levelCounts[award.level || "(none)"] || 0) + 1;
    }
  }

  const report = {
    generatedAt,
    sourceUrl: SOURCE_URL,
    restaurants: rows.length,
    awards: Object.values(levelCounts).reduce((sum, value) => sum + value, 0),
    levelCounts,
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
