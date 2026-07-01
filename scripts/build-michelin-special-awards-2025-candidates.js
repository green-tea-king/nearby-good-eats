const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "michelin-special-awards-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "michelin-special-awards-2025-import-report.json");
const sourceUrl = "https://www.michelin.com/en/publications/products-and-services/the-michelin-guide-taiwan-2025-unveiled";

const ROWS = [
  {
    name: "Hosu",
    city: "臺北市",
    aliases: ["好嶼", "HOSU"],
    level: "侍酒師大獎",
    awardName: "Sommelier Award",
    recipient: "Yia Yia Chen",
  },
  {
    name: "The Front House",
    city: "高雄市",
    aliases: ["方蒔", "the FRONT HOUSE 方蒔", "方蒔 the Front House"],
    level: "服務大獎",
    awardName: "Service Award",
    recipient: "Kiky Chen",
  },
  {
    name: "aMaze",
    city: "臺北市",
    aliases: ["心宴", "aMaze 心宴"],
    level: "年度開業大獎",
    awardName: "Opening of the Year Award",
  },
  {
    name: "永筵小館",
    city: "高雄市",
    aliases: ["Yung Yen"],
    level: "年輕主廚大獎",
    awardName: "Young Chef Award",
    recipient: "Yung Yen Hsia",
  },
];

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = ROWS.map((row) => ({
    name: row.name,
    city: row.city,
    aliases: row.aliases || [],
    awards: [{
      guide: "michelinspecial",
      year: 2025,
      level: row.level,
      awardName: row.awardName,
      ...(row.recipient ? { recipient: row.recipient } : {}),
      url: sourceUrl,
    }],
    importConfidence: "high",
  }));
  const payload = {
    version: "michelin-special-awards-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_article_batch",
      notes: [
        "來源為 Michelin 官方企業新聞稿，列出 2025 臺灣米其林指南特別獎項。",
        "特別獎項作為徽章與中低權重加分，不改變既有星級、必比登、入選資料。",
      ],
    },
    restaurants,
  };
  const report = {
    generatedAt,
    sourceUrl,
    candidates: restaurants.length,
    awards: restaurants.map((row) => `${row.name} ${row.awards[0].level}`),
    errors: [],
  };
  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
