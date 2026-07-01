const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "fmg-taiwan-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "fmg-taiwan-2025-import-report.json");
const sourceUrl = "https://www.gdg.asia/article/235/1421";

const ROWS = [
  { name: "SMOK製甜所", city: "南投縣", stars: 3 },
  { name: "小川埔里環保酵素園區", city: "南投縣", stars: 3 },
  { name: "山慕民宿", city: "南投縣", stars: 3 },
  { name: "仕合廖家", city: "南投縣", stars: 3, aliases: ["仕合廖家手作", "仕合廖家手作便當"] },
  { name: "吟詩企業有限公司", city: "南投縣", stars: 3 },
  { name: "雲品溫泉酒店 雲月舫", city: "南投縣", stars: 3, aliases: ["雲品溫泉酒店-雲月舫", "雲月舫"] },
  { name: "慢午野食有限公司", city: "南投縣", stars: 3, aliases: ["慢午野食"] },
  { name: "A-Teng生態飲食工作坊x飲食空間", city: "彰化縣", stars: 3, aliases: ["A-Teng生態飲食工作坊", "A-Teng"] },
  { name: "TU PANG地坊", city: "臺中市", stars: 3, aliases: ["地坊", "TU PANG"] },
  { name: "心雕居", city: "苗栗縣", stars: 3 },
  { name: "台北君悅酒店 茶苑", city: "臺北市", stars: 3, aliases: ["台北君悅酒店-茶苑", "茶苑", "Grand Hyatt Taipei 茶苑"] },
  { name: "小半天風味餐坊", city: "南投縣", stars: 2, aliases: ["田媽媽小半天風味餐坊"] },
  { name: "山中小廚房", city: "南投縣", stars: 2 },
  { name: "丘山茶", city: "南投縣", stars: 2, aliases: ["丘山茶Hilltea", "Hilltea"] },
  { name: "虎嘯山嵐", city: "南投縣", stars: 2 },
  { name: "FIRNS", city: "臺中市", stars: 2 },
  { name: "山東餃子牛肉麵館", city: "臺中市", stars: 2 },
  { name: "不老夢想125號 不老食光", city: "臺中市", stars: 2, aliases: ["不老夢想125號-不老食光", "不老食光"] },
  { name: "泔米食堂", city: "臺北市", stars: 2, aliases: ["泔 米食堂"] },
  { name: "臺北醫學大學附設醫院營養室", city: "臺北市", stars: 2 },
];

function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = ROWS.map((row) => ({
    name: row.name,
    city: row.city,
    aliases: row.aliases || [],
    awards: [{
      guide: "fmg",
      year: 2025,
      level: `${row.stars}星`,
      stars: row.stars,
      url: sourceUrl,
    }],
    importConfidence: "high",
  }));
  const payload = {
    version: "fmg-taiwan-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_article_batch",
      sustainabilitySignalOnly: true,
      notes: [
        "綠色餐飲指南 GDG 官方文章列出 2025 Food Made Good 星級認證名單。",
        "FMG 是永續餐飲評鑑；只做永續徽章與小幅加分，不取代 Google 評分、評論數與餐飲評鑑主體。",
      ],
    },
    restaurants,
  };
  const report = {
    generatedAt,
    sourceUrl,
    candidates: restaurants.length,
    threeStar: restaurants.filter((row) => row.awards[0].stars === 3).length,
    twoStar: restaurants.filter((row) => row.awards[0].stars === 2).length,
    names: restaurants.map((row) => `${row.name} ${row.awards[0].level}`),
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
