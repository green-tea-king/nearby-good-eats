const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "taichung-low-carbon-2023-candidates.json");
const reportPath = path.join(repoRoot, "assets", "taichung-low-carbon-2023-import-report.json");
const sourceUrl = "https://travel.taichung.gov.tw/content/files/High-quality-restaurants.pdf";

const ROWS = [
  { name: "築間幸福鍋物-臺中市政二店", address: "臺中市西屯區文心路二段 213 號", aliases: ["築間幸福鍋物(市政二店)"] },
  { name: "有之和牛-臺中文心店", address: "臺中市西屯區文心路二段 568 號" },
  { name: "馨苑小料理-西區店", address: "臺中市西區民生北路 106 號", aliases: ["馨苑"] },
  { name: "馨苑小料理-北屯店", address: "臺中市北屯區文昌東十一街 14 巷 1 號" },
  { name: "金色三麥-臺中市政店", address: "臺中市西屯區市政路 20 號" },
  { name: "梨子咖啡館-崇德店", address: "臺中市北屯區崇德路三段 1 號" },
  { name: "三時福利社", address: "臺中市西區民生路 356 號" },
  { name: "水相餐聚苑", address: "臺中市北屯區經貿三路二段 100 號" },
  { name: "臺中日月千禧酒店-旅覓酒吧", address: "臺中市西屯區市政路 77 號", aliases: ["旅覓酒吧"] },
  { name: "長榮桂冠酒店咖啡廳", address: "臺中市西屯區臺灣大道二段 666 號" },
  { name: "屋馬燒肉-中港店", address: "臺中市西屯區臺灣大道三段 300 號", aliases: ["屋馬燒肉(臺中中港店)", "屋馬燒肉中港店"] },
  { name: "屋馬燒肉-文心店", address: "臺中市南屯區文心路一段 436 號", aliases: ["屋馬燒肉文心店"] },
  { name: "屋馬燒肉-園邸店", address: "臺中市西區公益路 111 號 1 樓", aliases: ["屋馬燒肉園邸店"] },
  { name: "紅巢燒肉工房", address: "臺中市南屯區公益路二段 836 號", aliases: ["Hongchao BBQ Restaurant"] },
  { name: "JAI-臺中水湳店", address: "臺中市北屯區中清路二段 903 號二樓", aliases: ["JAI 臺中水湳店"] },
  { name: "HUN-臺中一中店", address: "臺中市北區三民路三段 114 號 2 樓", aliases: ["HUN 臺中一中店", "HUN混 義大利麵 一中店"] },
  { name: "滬舍餘味餐館", address: "臺中市南屯區公益路二段 537 號", aliases: ["滬舍餘味"] },
  { name: "熱浪島南洋蔬食茶堂", address: "臺中市南屯區向上路三段 536 號" },
  { name: "膳馨民間創作料理", address: "臺中市西區存中街 21 號" },
  { name: "默爾 Pasta Pizza-北屯店", address: "臺中市北屯區安順四街 2 號", aliases: ["默爾 Pasta Pizza 北屯店"] },
];

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = ROWS.map((row) => ({
    name: row.name,
    city: "臺中市",
    address: row.address,
    aliases: row.aliases || [],
    awards: [{
      guide: "taichunglowcarbon",
      year: 2023,
      level: "低碳認證",
      url: sourceUrl,
    }],
    importConfidence: "high",
  }));
  const payload = {
    version: "taichung-low-carbon-2023-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_pdf_batch",
      localGovernmentCertification: true,
      notes: [
        "來源為臺中市政府觀光旅遊局 PDF：112 年臺中市優質餐飲店家分級評核獲獎名單。",
        "本批只匯入文件開頭明確列出的「臺中市餐廳飲食店低碳認證書 20 家」。",
        "低碳認證作為地方政府認證徽章與低權重加分，不取代 Google 評分、評論數與主要餐飲評鑑。",
      ],
    },
    restaurants,
  };
  const report = {
    generatedAt,
    sourceUrl,
    candidates: restaurants.length,
    names: restaurants.map((row) => row.name),
    errors: [],
  };
  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
