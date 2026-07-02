const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "asias-50-best-restaurants-2026-candidates.json");
const reportPath = path.join(repoRoot, "assets", "asias-50-best-restaurants-2026-import-report.json");
const sourceUrl = "https://www.theworlds50best.com/restaurants/best-in-asia/list/1-50";
const capturedAt = "2026-07-02";

const restaurants = [
  {
    name: "Logy",
    city: "臺北市",
    district: "大安區",
    address: "台北市大安區安和路一段",
    cuisine: "Modern European",
    aliases: ["logy"],
    awards: [{
      guide: "50best",
      awardName: "Asia's 50 Best Restaurants 2026",
      year: 2026,
      level: "Asia No.22",
      rank: 22,
      url: sourceUrl,
      capturedAt,
      notes: "Official list page shows Logy at No.22 in Taipei.",
    }],
  },
  {
    name: "JL Studio",
    city: "臺中市",
    district: "",
    address: "台中市",
    cuisine: "Modern Singaporean",
    aliases: [],
    awards: [{
      guide: "50best",
      awardName: "Asia's 50 Best Restaurants 2026",
      year: 2026,
      level: "Asia No.50",
      rank: 50,
      url: sourceUrl,
      capturedAt,
      notes: "Official list page shows JL Studio at No.50 in Taichung.",
    }],
  },
  {
    name: "MUME",
    city: "臺北市",
    district: "大安區",
    address: "No. 28 Siwei Road, Da'an District, Taipei, 106",
    cuisine: "Creative Cuisine",
    aliases: [],
    awards: [{
      guide: "50best",
      awardName: "Asia's 50 Best Restaurants 2026",
      year: 2026,
      level: "Asia No.61",
      rank: 61,
      url: sourceUrl,
      capturedAt,
      notes: "Official list page continues through No.100 and shows MUME at No.61 in Taipei.",
    }],
  },
  {
    name: "Silks House",
    city: "臺北市",
    district: "中山區",
    address: "Lane 39, 3F Zhongshan North Road, Zhongshan district, Taipei, 104",
    cuisine: "Cantonese",
    aliases: [],
    awards: [{
      guide: "50best",
      awardName: "Asia's 50 Best Restaurants 2026",
      year: 2026,
      level: "Asia No.64",
      rank: 64,
      url: sourceUrl,
      capturedAt,
      notes: "Official list page continues through No.100 and shows Silks House at No.64 in Taipei.",
    }],
  },
];

function main() {
  const generatedAt = new Date().toISOString();
  const payload = {
    version: "asias-50-best-restaurants-2026-candidates",
    generatedAt,
    sourceUrl,
    sourceCatalog: [
      {
        id: "asias-50-best-restaurants-2026",
        label: "Asia's 50 Best Restaurants 2026",
        url: sourceUrl,
      },
    ],
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_page_batch",
      authority: "international_restaurant_ranking",
      notes: [
        "Only Taiwan restaurants explicitly present on the official Asia's 50 Best Restaurants 2026 list are included.",
        "The official page continues beyond No.50 into the No.51-100 section on the same document.",
      ],
    },
    restaurants: restaurants.map((row) => ({
      ...row,
      importConfidence: "high",
      sourceUrls: [sourceUrl],
    })),
  };
  const report = {
    generatedAt,
    sourceUrl,
    candidates: restaurants.length,
    ranks: restaurants.map((row) => ({ name: row.name, rank: row.awards[0].rank, city: row.city })),
  };

  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
