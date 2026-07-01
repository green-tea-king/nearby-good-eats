const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceUrl = "https://500times.udn.com/wtimes/story/124537/8931871";
const candidatesPath = path.join(repoRoot, "assets", "500sweet-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "500sweet-2025-import-report.json");

const CITY_ALIASES = {
  "基隆": ["基隆市"],
  "台北": ["台北市"],
  "新北": ["新北市"],
  "桃園": ["桃園市"],
  "新竹": ["新竹市", "新竹縣"],
  "苗栗": ["苗栗縣"],
  "台中": ["台中市"],
  "彰化": ["彰化縣"],
  "南投": ["南投縣"],
  "雲林": ["雲林縣"],
  "嘉義": ["嘉義市", "嘉義縣"],
  "台南": ["台南市"],
  "高雄": ["高雄市"],
  "屏東": ["屏東縣"],
  "宜蘭": ["宜蘭縣"],
  "花蓮": ["花蓮縣"],
  "台東": ["台東縣"],
  "金門": ["金門縣"],
  "澎湖": ["澎湖縣"],
  "連江": ["連江縣"],
};

const NON_CITY_BUCKETS = new Set(["連鎖", "線上通路"]);

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
    .normalize("NFKC")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/（[^）]*(店|門市|專櫃|分店|統一時代台北店)[^）]*）/g, "")
    .replace(/\([^)]*(店|門市|專櫃|分店|統一時代台北店)[^)]*\)/g, "")
    .replace(/^[「『]|[」』]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNames(value) {
  return String(value || "")
    .split("、")
    .map((name) => normalizeName(name))
    .filter((name) => name && !/^facebook$/i.test(name) && !/^●/.test(name));
}

function addCandidate(rows, rawCity, rawName, sweets) {
  const name = normalizeName(rawName);
  if (!name || name.length < 2) return;
  const cityCandidates = CITY_ALIASES[rawCity] || [];
  const isNonCity = NON_CITY_BUCKETS.has(rawCity);
  rows.push({
    name,
    city: cityCandidates.length === 1 ? cityCandidates[0] : "",
    cityCandidates,
    aliases: rawName !== name ? [rawName] : [],
    awards: [{
      guide: "500sweet",
      year: 2025,
      sweets,
      level: `${sweets}甜`,
      url: sourceUrl,
    }],
    source: {
      title: "2025【500甜】第一屆完整得獎名單",
      url: sourceUrl,
      rawCity,
      rawName,
      note: "官方頁文字名單；頁面註明實際甜點名稱以各店家菜單為準。文字或圖片若有差異，應人工覆核。",
    },
    importConfidence: cityCandidates.length === 1 ? "high" : (isNonCity ? "skip_non_city_bucket" : "needs_city_review"),
  });
}

function parse(text) {
  const rows = [];
  let sweets = 0;
  for (const rawLine of String(text).split("\n")) {
    const line = rawLine.trim();
    if (!line || /^facebook$/i.test(line) || /^圖／/.test(line)) continue;
    const header = line.match(/^●\s*(\d+)甜|^(\d+)甜[:：]/);
    if (header) {
      sweets = Number(header[1] || header[2] || 0);
      continue;
    }
    if (!sweets || !line.includes("：")) continue;
    const [rawCity, ...nameParts] = line.split("：");
    const city = rawCity.trim();
    const names = nameParts.join("：").trim();
    if (!city || !names) continue;
    if (!CITY_ALIASES[city] && !NON_CITY_BUCKETS.has(city)) continue;
    for (const name of splitNames(names)) {
      addCandidate(rows, city, name, sweets);
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
    needsCityReview: rows.filter((row) => row.importConfidence === "needs_city_review").length,
    skippedNonCityBucket: rows.filter((row) => row.importConfidence === "skip_non_city_bucket").length,
    bySweets: rows.reduce((acc, row) => {
      const key = String(row.awards[0].sweets);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    note: "候選資料來自 500甜官方頁文字名單。只自動合併有單一明確縣市的高信心資料；連鎖與線上通路不自動匯入，避免跨地區誤標。",
  };
  fs.writeFileSync(candidatesPath, `${JSON.stringify({ version: "500sweet-2025-candidates", sourceUrl, generatedAt: report.generatedAt, restaurants: rows }, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
