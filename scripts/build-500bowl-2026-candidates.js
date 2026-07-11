const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceUrl = "https://500times.udn.com/wtimes/story/123497/9547367";
const mapId = "19E5ausxMMacpaiOhadZFvns_UOlgFNo";
const mapUrl = `https://www.google.com/maps/d/viewer?mid=${mapId}`;
const kmlUrl = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1`;
const candidatesPath = path.join(repoRoot, "assets", "500bowl-2026-candidates.json");
const reportPath = path.join(repoRoot, "assets", "500bowl-2026-import-report.json");
const kmlSnapshotPath = path.join(repoRoot, "assets", "500bowl-2026-google-map.kml");
const EXTRACTED_DATE = "2026-07-11";

const CITY_ALIASES = {
  "台北": ["台北市"],
  "臺北": ["台北市"],
  "新北": ["新北市"],
  "桃園": ["桃園市"],
  "新竹": ["新竹市", "新竹縣"],
  "苗栗": ["苗栗縣"],
  "台中": ["台中市"],
  "臺中": ["台中市"],
  "南投": ["南投縣"],
  "彰化": ["彰化縣"],
  "雲林": ["雲林縣"],
  "嘉義": ["嘉義市", "嘉義縣"],
  "台南": ["台南市"],
  "臺南": ["台南市"],
  "高雄": ["高雄市"],
  "屏東": ["屏東縣"],
  "宜蘭": ["宜蘭縣"],
  "花蓮": ["花蓮縣"],
  "台東": ["台東縣"],
  "臺東": ["台東縣"],
  "基隆": ["基隆市"],
  "馬祖": ["連江縣"],
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
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n"));
}

function storyText(html) {
  const match = String(html).match(/<div class="story_body_content[^"]*"[^>]*>([\s\S]*?)<div id="story_end"/);
  return stripTags(match ? match[1] : html);
}

function getTag(block, tag) {
  const match = String(block || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeEntities(stripCdata(match[1]).trim()) : "";
}

function stripCdata(value) {
  return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function extendedValue(block, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(block || "").match(new RegExp(`<Data\\s+name="${escaped}">[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>[\\s\\S]*?<\\/Data>`));
  return match ? decodeEntities(stripCdata(match[1]).trim()) : "";
}

function cityFromAddress(address, fallbackRegion) {
  const text = String(address || "").replace(/臺/g, "台");
  const match = text.match(/(台北市|新北市|桃園市|台中市|台南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/);
  if (match) return match[1];
  const cities = CITY_ALIASES[fallbackRegion] || [];
  return cities.length === 1 ? cities[0] : "";
}

function districtFromAddress(address) {
  const text = String(address || "").replace(/臺/g, "台");
  const city = cityFromAddress(text, "");
  if (!city) return "行政區待確認";
  const afterCity = text.slice(text.indexOf(city) + city.length);
  const match = afterCity.match(/^([^0-9\s]{1,8}?(?:區|鄉|鎮|市))/);
  return match ? match[1] : "行政區待確認";
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

function awardPayload(bowls) {
  return {
    guide: "500bowl",
    year: 2026,
    bowls,
    level: `${bowls}碗`,
    url: mapUrl,
    sourceName: "500碗 2026 官方 Google 地圖",
    sourceUrl: mapUrl,
    extractedDate: EXTRACTED_DATE,
    awardName: `500碗${bowls}碗`,
    notes: `批次整理匯入；來源：500碗 2026 官方頁與官方 Google 地圖；擷取日：${EXTRACTED_DATE}；${sourceUrl}；${mapUrl}`,
    award: `500碗${bowls}碗`,
    extractedAt: EXTRACTED_DATE,
  };
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
    awards: [awardPayload(bowls)],
    source: {
      title: "2026【500碗】第四屆完整得獎名單",
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
    const header = line.match(/[〖●]?\s*([123])\s*碗(?:得獎名單|得主|[:：])/);
    if (header) {
      bowls = Number(header[1] || 0);
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
          awards: [awardPayload(bowls)],
          source: {
            title: "2026【500碗】第四屆完整得獎名單",
            url: sourceUrl,
            rawCity: cityPart,
            rawName: name,
            note: "跨縣市同列，需人工確認實際縣市。",
          },
          importConfidence: "needs_city_review",
        });
      }
    }
  }
  return rows;
}

function parseKml(kml) {
  const rows = [];
  const placemarks = String(kml || "").match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
  for (const placemark of placemarks) {
    const name = normalizeName(getTag(placemark, "name"));
    const bowls = Math.round(Number(extendedValue(placemark, "總得碗數") || 0));
    const dish = extendedValue(placemark, "得獎菜色");
    const region = extendedValue(placemark, "地區");
    const cuisine = extendedValue(placemark, "菜系") || "菜系待確認";
    const judges = extendedValue(placemark, "推薦評審");
    const address = extendedValue(placemark, "地址");
    const hours = extendedValue(placemark, "營業時間");
    const phone = extendedValue(placemark, "電話");
    if (!name || !bowls) continue;
    const city = cityFromAddress(address, region);
    rows.push({
      name,
      city: city || "",
      cityCandidates: city ? [city] : (CITY_ALIASES[region] || []),
      aliases: [],
      district: districtFromAddress(address),
      address: address || "地址待確認",
      cuisine,
      awards: [awardPayload(bowls)],
      source: {
        title: "2026【500碗】第四屆完整得獎名單 Google 地圖",
        url: mapUrl,
        kmlUrl,
        officialArticleUrl: sourceUrl,
        rawRegion: region,
        rawName: name,
        dish,
        judges,
        hours,
        phone,
        note: "官方頁連結之 500碗 2026 全台入選小吃 Google 地圖 KML；用於補齊官方文字層缺口。",
      },
      importConfidence: city ? "high" : "needs_city_review",
    });
  }
  return rows;
}

async function main() {
  const html = await requestText(sourceUrl);
  const textRows = parse(storyText(html));
  const kml = await requestText(kmlUrl);
  fs.writeFileSync(kmlSnapshotPath, kml, "utf8");
  const rows = parseKml(kml);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    mapUrl,
    kmlUrl,
    extractedDate: EXTRACTED_DATE,
    candidates: rows.length,
    highConfidence: rows.filter((row) => row.importConfidence === "high").length,
    needsCityReview: rows.filter((row) => row.importConfidence !== "high").length,
    textLayerCandidates: textRows.length,
    kmlPlacemarks: rows.length,
    byBowls: rows.reduce((acc, row) => {
      const bowls = String(row.awards[0].bowls);
      acc[bowls] = (acc[bowls] || 0) + 1;
      return acc;
    }, {}),
    note: "候選資料以官方頁連結之 Google My Maps KML 為主，官方頁文字層作為交叉檢查；只自動合併可確認縣市資料，無法確認縣市列需人工覆核。",
  };
  fs.writeFileSync(candidatesPath, `${JSON.stringify({ version: "500bowl-2026-candidates", sourceUrl, mapUrl, kmlUrl, generatedAt: report.generatedAt, restaurants: rows }, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
