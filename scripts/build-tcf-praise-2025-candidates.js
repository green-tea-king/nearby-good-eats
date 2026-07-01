const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const outPath = path.join(repoRoot, "assets", "tcf-praise-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "tcf-praise-2025-import-report.json");
const sourceUrl = "https://www.tcf.org.tw/page/news/show.aspx?num=48&lang=TW";
const SOURCE_ROWS = [
  "府城食府正宗台南料理",
  "蛋小白",
  "南僑讚岐急凍熟麵",
  "BBJ",
  "黑金傳奇",
  "逸之牛",
  "稻香村懷舊料理",
  "澎富企業",
  "知山田頂級燒肉",
  "福相麻辣香鍋",
  "晶粵軒烤鴨餐廳",
  "鴨覓烤鴨餐廳",
  "福樓餐廳",
  "廚房有雞 粵菜餐廳",
  "田園素食",
  "福安專業土雞料理餐廳",
  "一鍋三饗",
  "大楊梅鵝莊",
  "趙海真私廚",
  "洪毓姗（蔡家虹）手作三明治",
  "聚豐園江浙美食餐廳",
  "焰遇燒肉",
  "星馬快餐",
  "SOL-Tainan",
  "小樽手作珈琲",
  "食代鐵板燒",
  "南星鐵板燒",
  "がんこ莞固和食",
  "悅華軒",
  "新方海鮮宴會館",
  "焿大王",
  "魔法咖哩",
  "Q勁麵館",
  "三個老總",
  "焦糖楓",
  "少點鹽健康餐盒專賣",
];

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
    .replace(/餐廳$/, "")
    .replace(/專賣店$/, "")
    .toLowerCase();
}

function buildExistingIndex(awards) {
  const byName = new Map();
  for (const row of awards.restaurants || []) {
    const names = [row.name, ...(row.aliases || [])];
    for (const name of names) {
      const key = normalizeName(name);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(row);
    }
  }
  return byName;
}

function findExisting(name, byName) {
  const key = normalizeName(name);
  const matches = (byName.get(key) || []).filter((match, index, arr) =>
    arr.findIndex((x) => normalizeName(x.name) === normalizeName(match.name) && x.city === match.city) === index
  );
  if (matches.length !== 1) return null;
  return matches[0];
}

async function main() {
  const generatedAt = new Date().toISOString();
  const awards = readJson(awardsPath);
  const byName = buildExistingIndex(awards);
  const names = [...new Set(SOURCE_ROWS)];
  const restaurants = [];
  const needsCityReview = [];

  for (const name of names) {
    const existing = findExisting(name, byName);
    const award = {
      guide: "tcfpraise",
      year: 2025,
      level: "美食指南點讚榜臺灣站",
      url: sourceUrl,
    };
    if (existing) {
      restaurants.push({
        name: existing.name,
        city: existing.city,
        aliases: [...new Set([name, ...(existing.aliases || [])])].filter((alias) => normalizeName(alias) !== normalizeName(existing.name)),
        awards: [award],
        importConfidence: "high",
        matchedBy: "unique_existing_awards_name",
      });
    } else {
      needsCityReview.push({
        name,
        reason: "city_not_in_source_and_no_unique_existing_match",
      });
    }
  }

  const payload = {
    version: "tcf-praise-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_article_batch_unique_existing_match_only",
      noCityGuess: true,
      notes: [
        "來源為社團法人台灣餐飲業聯盟公開新聞稿，列出 2025 美食指南點讚榜臺灣站 32 家入選名單。",
        "來源站目前 TLS 憑證與網域不匹配，為避免腳本關閉 TLS 驗證，名單以可追溯固定批次列入腳本。",
        "原文未列縣市；只有能從既有內建資料唯一比對到城市的店家自動匯入，其餘保留待人工補城市。",
        "此來源作為品牌/人氣認可徽章與低權重加分，不取代 Google 評分、評論數與主要餐飲評鑑。",
      ],
    },
    restaurants,
    needsCityReview,
  };
  const report = {
    generatedAt,
    sourceUrl,
    sourceRows: names.length,
    candidates: restaurants.length,
    needsCityReview: needsCityReview.length,
    errors: [],
  };
  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    sourceRows: 0,
    candidates: 0,
    needsCityReview: 0,
    errors: [error.message],
  };
  writeJson(reportPath, report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
