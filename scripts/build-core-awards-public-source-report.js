const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-public-source-report.json");
const coveragePath = path.join(repoRoot, "assets", "external-source-coverage.json");

const SOURCE_CATALOG = {
  michelin: {
    id: "michelin-guide-taiwan",
    label: "Michelin",
    urls: [
      "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/taiwan-full-list",
      "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/michelin-guide-taiwan-starred-restaurant-2025",
    ],
  },
  michelin_selected: {
    id: "michelin-selected-taiwan",
    label: "Michelin Selected",
    urls: [
      "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/taiwan-full-list",
      "https://guide.michelin.com/tw/zh_TW/taipei-region/taipei/restaurant/85td",
    ],
  },
  bib: {
    id: "bib-gourmand-taiwan",
    label: "Bib",
    urls: [
      "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/michelin-guide-taiwan-2025-bib-gourmand-selection",
    ],
  },
  "500plate": {
    id: "500plate",
    label: "500盤",
    urls: ["https://500times.udn.com/wtimes/story/122412/9007797"],
  },
  "500bowl": {
    id: "500bowl",
    label: "500碗",
    urls: [
      "https://500times.udn.com/wtimes/story/123497/8874123",
      "https://500times.udn.com/wtimes/story/123497/9547367",
      "https://www.google.com/maps/d/viewer?mid=19E5ausxMMacpaiOhadZFvns_UOlgFNo",
      "https://www.google.com/maps/d/kml?mid=19E5ausxMMacpaiOhadZFvns_UOlgFNo&forcekml=1",
    ],
  },
  "500sweet": {
    id: "500sweet",
    label: "500甜",
    urls: ["https://500times.udn.com/wtimes/story/124537/8931871"],
  },
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isPending(value) {
  return !String(value || "").trim() || /待確認|待補/.test(String(value || ""));
}

function inc(obj, key, amount = 1) {
  obj[key] = (obj[key] || 0) + amount;
}

function build() {
  const data = readJson(awardsPath);
  const rows = data.restaurants || [];
  const countsByGuide = {};
  const countsByGuideYear = {};
  const missingFieldsByGuide = {};
  const manualReviewItems = [];
  const restaurantsByGuide = {};

  for (const row of rows) {
    const rowGuides = new Set((row.awards || []).map((award) => award.guide).filter(Boolean));
    for (const guide of rowGuides) {
      inc(restaurantsByGuide, guide);
      if (!missingFieldsByGuide[guide]) missingFieldsByGuide[guide] = { district: 0, address: 0, cuisine: 0 };
      const missing = [];
      if (isPending(row.district)) { missingFieldsByGuide[guide].district += 1; missing.push("district"); }
      if (isPending(row.address)) { missingFieldsByGuide[guide].address += 1; missing.push("address"); }
      if (isPending(row.cuisine)) { missingFieldsByGuide[guide].cuisine += 1; missing.push("cuisine"); }
      if (missing.length) {
        manualReviewItems.push({
          name: row.name,
          city: row.city || "縣市待確認",
          guide,
          missing,
          note: "不猜測地址、行政區或菜系；需人工或 Google 真資料補強。",
        });
      }
    }
    for (const award of row.awards || []) {
      inc(countsByGuide, award.guide);
      if (!countsByGuideYear[award.guide]) countsByGuideYear[award.guide] = {};
      inc(countsByGuideYear[award.guide], String(award.year || "年份待確認"));
    }
  }

  const sources = Object.entries(SOURCE_CATALOG).map(([guide, meta]) => ({
    id: meta.id,
    label: meta.label,
    guide,
    status: "integrated_data",
    dataFile: "assets/awards-taiwan.json",
    awardCount: countsByGuide[guide] || 0,
    restaurantCount: restaurantsByGuide[guide] || 0,
    years: countsByGuideYear[guide] || {},
    sourceUrls: meta.urls,
    runtimeLookup: false,
  }));

  const report = {
    version: "core-awards-public-source-report-v1",
    generatedAt: new Date().toISOString(),
    extractedDate: "2026-07-11",
    dataFile: "assets/awards-taiwan.json",
    policy: {
      allowedGuides: Object.keys(SOURCE_CATALOG),
      runtimeExternalLookup: false,
      noGuessingYear: true,
      unknownYearValue: "年份待確認",
    },
    summary: {
      restaurants: rows.length,
      awardCount: Object.values(countsByGuide).reduce((sum, value) => sum + value, 0),
      countsByGuide,
      countsByGuideYear,
      manualReviewCount: manualReviewItems.length,
    },
    sources,
    missingFieldsByGuide,
    manualReviewItems,
  };

  const coverage = {
    version: "external-source-coverage-core-awards-2026-07-11",
    updated: "2026-07-11",
    policy: {
      runtimeExternalLookup: false,
      costFirst: true,
      noFakeData: true,
      onlyCoreAwardSources: true,
      notes: [
        "本檔只保留 Michelin / Bib / Michelin Selected / 500盤 / 500碗 / 500甜。",
        "Google 評分與評論數仍是排序主體，外部評鑑只做加分與徽章。",
        "使用者搜尋時不即時查外部網站，只讀批次產生的靜態資料。",
      ],
    },
    summary: {
      awardsRestaurants: rows.length,
      awardCount: report.summary.awardCount,
      manualReviewCount: manualReviewItems.length,
      countsByGuide,
      countsByGuideYear,
    },
    sources,
  };

  writeJson(reportPath, report);
  writeJson(coveragePath, coverage);
  console.log(JSON.stringify(report.summary, null, 2));
}

build();
