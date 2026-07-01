const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "green-veggie-guide-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "green-veggie-guide-2025-import-report.json");
const sourceUrl = "https://ipuregreen.org/veg/";

const TAGS = [
  { tag: "3star2025", stars: 3 },
  { tag: "2star2025", stars: 2 },
  { tag: "1star2025", stars: 1 },
];

const CITY_BY_NAME = new Map([
  ["foldie 蔬食餐酒館", "臺北市"],
  ["THE ARIGATOU 蔬食餐廳", "臺北市"],
  ["山間倉房", "臺北市"],
  ["五郎時食", "臺北市"],
  ["祥和蔬食料理", "臺北市"],
  ["善菓堂 SHAN GUO TANG", "臺北市"],
  ["BaganHood 蔬食餐酒館", "臺北市"],
  ["Plants Eatery", "臺北市"],
  ["小小樹食", "臺北市"],
  ["小小樹食0km山物所", "臺北市"],
  ["不葷主義", "臺北市"],
  ["茶苑 Cha Lounge", "臺北市"],
  ["陽明春天", "臺北市"],
  ["蔬軾 So Veg Restaurant", "臺北市"],
  ["自在天 昆布水つけ麺", "臺北市"],
  ["雲川水月 Clavius", "新北市"],
  ["新築窟", "新竹市"],
  ["漢來蔬食 Hi Lai vegetables", "高雄市"],
  ["惠中蔬食", "高雄市"],
  ["植橪．和食", "臺中市"],
  ["越哉Viet Chay 越南素料理", "臺中市"],
  ["綠舍奇蹟健康蔬食", "臺中市"],
  ["掬翠拾煙蔬食創作料理", "臺中市"],
  ["春草舒願", "臺南市"],
  ["布佬廚房 Bruce’s Kitchen", "新北市"],
  ["食不二蔬食", "宜蘭縣"],
  ["菜鳥書蒔", "臺北市"],
  ["旭穗蔬食VEGANala", "臺北市"],
  ["養心沙龍", "臺北市"],
  ["鈺善閣 ‧ 素 ‧ 養生懷石", "臺北市"],
  ["遇見蔬食館", "臺北市"],
  ["無所洋食", "臺北市"],
  ["斐得蔬食Verdure", "臺北市"],
  ["原蔬生活", "臺北市"],
  ["美蔬齋 Mei shu zhai", "臺北市"],
  ["知初 the Root Kitchen", "臺北市"],
  ["大人山養", "臺北市"],
  ["Yache 韓式蔬食", "臺北市"],
  ["Preserve For our Future", "臺北市"],
  ["Uncle Q by Veganday", "臺北市"],
  ["Herbivore Vegan", "臺北市"],
  ["養心茶樓-台北中山", "臺北市"],
  ["福屋拉麵 (福屋ラーメン)", "臺北市"],
  ["毋肉 Vegetable 1999", "新北市"],
  ["心怡素食", "新北市"],
  ["TERRA de Verdant 豐土", "臺中市"],
  ["Enrich Restaurant & Cafe", "臺中市"],
  ["貓居蔬食", "臺中市"],
  ["SUN BERNO光焙若蔬食", "臺中市"],
  ["Anjali Café & Yoga 植物飲食瑜伽聚落", "新竹市"],
  ["毛蔬亞洲蔬食", "臺南市"],
  ["八寶閣御廚房", "臺南市"],
  ["慈香庭素食餐廳高雄旗艦店", "高雄市"],
  ["小明星餐館 Little Star Diner", "高雄市"],
  ["蔬慕 Vegan Amore", "高雄市"],
  ["打舖2號店", "屏東縣"],
  ["入木三分無菜單料理", "桃園市"],
  ["pitatto+菜", "花蓮縣"],
]);

const ALIASES = new Map([
  ["善菓堂 SHAN GUO TANG", ["善菓堂"]],
  ["祥和蔬食料理", ["祥和蔬食"]],
  ["茶苑 Cha Lounge", ["茶苑", "Cha Lounge"]],
  ["Plants Eatery", ["Plants"]],
  ["布佬廚房 Bruce’s Kitchen", ["布佬廚房"]],
  ["漢來蔬食 Hi Lai vegetables", ["漢來蔬食"]],
  ["雲川水月 Clavius", ["雲川水月", "Clavius"]],
  ["蔬軾 So Veg Restaurant", ["蔬軾"]],
  ["TERRA de Verdant 豐土", ["豐土"]],
  ["Anjali Café & Yoga 植物飲食瑜伽聚落", ["Anjali Café & Yoga"]],
  ["小明星餐館 Little Star Diner", ["小明星餐館"]],
  ["SUN BERNO光焙若蔬食", ["光焙若蔬食", "SUN BERNO"]],
]);

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "nearby-good-eats batch source checker (non-runtime)" } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        res.resume();
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "’")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractTitles(html) {
  return [...html.matchAll(/title="([^"]+)"/g)]
    .map((match) => stripTags(match[1]))
    .filter((title) => title && !title.includes("綠・蔬食評鑑指南") && !title.includes("訂閱"))
    .filter((title) => !["RSD", "Menu"].includes(title))
    .filter((title, index, arr) => arr.indexOf(title) === index);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = [];
  const needsCityReview = [];
  const errors = [];

  for (const item of TAGS) {
    const url = `${sourceUrl}?tag=${item.tag}`;
    try {
      const html = await fetchText(url);
      for (const title of extractTitles(html)) {
        const city = CITY_BY_NAME.get(title);
        const row = {
          name: title,
          city: city || "",
          aliases: ALIASES.get(title) || [],
          awards: [{
            guide: "greenveggie",
            year: 2025,
            level: `${item.stars}星`,
            stars: item.stars,
            url,
          }],
          importConfidence: city ? "high" : "needs_city_review",
        };
        if (city) restaurants.push(row);
        else needsCityReview.push(row);
      }
    } catch (error) {
      errors.push({ tag: item.tag, url, error: error.message });
    }
  }

  const payload = {
    version: "green-veggie-guide-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_site_batch",
      vegetarianSignalOnly: true,
      notes: [
        "綠色公益基金會 2025《綠・蔬食評鑑指南》星級名單批次整理。",
        "只匯入可判定城市的高信心資料；城市未確定者保留在 needsCityReview，避免跨城市誤配。",
      ],
    },
    restaurants,
    needsCityReview,
  };
  const report = {
    generatedAt,
    sourceUrl,
    candidates: restaurants.length,
    needsCityReview: needsCityReview.length,
    counts: {
      threeStar: restaurants.filter((row) => row.awards[0].stars === 3).length,
      twoStar: restaurants.filter((row) => row.awards[0].stars === 2).length,
      oneStar: restaurants.filter((row) => row.awards[0].stars === 1).length,
    },
    errors,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
