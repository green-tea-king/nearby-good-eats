const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceUrl = "https://500times.udn.com/wtimes/story/123497/8874123";
const candidatesPath = path.join(repoRoot, "assets", "500bowl-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "500bowl-2025-import-report.json");

const CITY_ALIASES = {
  "台北": ["台北市"],
  "新北": ["新北市"],
  "桃園": ["桃園市"],
  "新竹": ["新竹市", "新竹縣"],
  "苗栗": ["苗栗縣"],
  "台中": ["台中市"],
  "南投": ["南投縣"],
  "彰化": ["彰化縣"],
  "雲林": ["雲林縣"],
  "嘉義": ["嘉義市", "嘉義縣"],
  "台南": ["台南市"],
  "高雄": ["高雄市"],
  "屏東": ["屏東縣"],
  "宜蘭": ["宜蘭縣"],
  "花蓮": ["花蓮縣"],
  "台東": ["台東縣"],
  "基隆": ["基隆市"],
  "離島": ["澎湖縣", "金門縣", "連江縣"],
};

function requestText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(body);
      });
    }).on("error", reject);
  });
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripTags(html) {
  return decodeEntities(String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n"));
}

function storyText(html) {
  const match = String(html).match(/<div class="story_body_content[^"]*"[^>]*>([\s\S]*?)<div id="story_end"/);
  return stripTags(match ? match[1] : html);
}

function normalizeName(value) {
  return String(value || "")
    .replace(/（[^）]*店）/g, "")
    .replace(/\([^)]*店\)/g, "")
    .replace(/（總店|本店|創始總店|總店／民生店）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNames(value) {
  return String(value || "")
    .split("、")
    .map((name) => normalizeName(name))
    .filter((name) => name && !/^facebook$/i.test(name) && !/^〖/.test(name));
}

function addCandidate(rows, rawCity, rawName, bowls) {
  const cities = CITY_ALIASES[rawCity] || [rawCity];
  const name = normalizeName(rawName);
  if (!name || name.length < 2) return;
  rows.push({
    name,
    city: cities.length === 1 ? cities[0] : "",
    cityCandidates: cities,
    aliases: rawName !== name ? [rawName] : [],
    awards: [{
      guide: "500bowl",
      year: 2025,
      bowls,
      level: `${bowls}碗`,
      url: sourceUrl,
    }],
    source: {
      title: "2025【500碗】第三屆完整得獎名單",
      url: sourceUrl,
      rawCity,
      rawName,
      note: "官方頁文字名單；頁面註明如有誤植或更動，以圖片公告為準。",
    },
    importConfidence: cities.length === 1 ? "high" : "needs_city_review",
  });
}

function parse(text) {
  const rows = [];
  let bowls = 0;
  for (const rawLine of String(text).split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^●\s*([123])碗|^([123])碗[:：]/);
    if (header) {
      bowls = Number(header[1] || header[2] || 0);
      continue;
    }
    if (!bowls || !line.includes("｜")) continue;
    const [cityPart, namesPart] = line.split("｜");
    if (!cityPart || !namesPart) continue;
    const rawCities = cityPart.split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
    for (const name of splitNames(namesPart)) {
      if (rawCities.length === 1) {
        addCandidate(rows, rawCities[0], name, bowls);
      } else {
        rows.push({
          name,
          city: "",
          cityCandidates: rawCities.flatMap((city) => CITY_ALIASES[city] || [city]),
          aliases: [],
          awards: [{
            guide: "500bowl",
            year: 2025,
            bowls,
            level: `${bowls}碗`,
            url: sourceUrl,
          }],
          source: { title: "2025【500碗】第三屆完整得獎名單", url: sourceUrl, rawCity: cityPart, rawName: name, note: "跨縣市同列，需人工確認實際縣市。" },
          importConfidence: "needs_city_review",
        });
      }
    }
  }
  return rows;
}

async function main() {
  const html = await requestText(sourceUrl);
  const text = storyText(html);
  const rows = parse(text);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    candidates: rows.length,
    highConfidence: rows.filter((row) => row.importConfidence === "high").length,
    needsCityReview: rows.filter((row) => row.importConfidence !== "high").length,
    byBowls: rows.reduce((acc, row) => {
      const bowls = String(row.awards[0].bowls);
      acc[bowls] = (acc[bowls] || 0) + 1;
      return acc;
    }, {}),
    note: "候選資料來自 500碗官方頁文字名單；頁面註明文字如有誤植或更動，以圖片公告為準。只建候選與高信心合併，跨縣市列需人工覆核。",
  };
  fs.writeFileSync(candidatesPath, `${JSON.stringify({ version: "500bowl-2025-candidates", sourceUrl, generatedAt: report.generatedAt, restaurants: rows }, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
