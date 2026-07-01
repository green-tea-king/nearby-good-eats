const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "muslim-friendly-2026-candidates.json");
const reportPath = path.join(repoRoot, "assets", "muslim-friendly-2026-import-report.json");
const sourceUrl = "https://www.taiwan.net.tw/m1.aspx?sNo=0020118";
const pageUrl = (page) => page === 1 ? sourceUrl : `https://www.taiwan.net.tw/m1.aspx?page=${page}&sNo=0020118`;

const CITIES = [
  "臺北市", "新北市", "基隆市", "宜蘭縣", "桃園市", "新竹縣", "新竹市", "苗栗縣",
  "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "嘉義市", "臺南市", "高雄市",
  "屏東縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
];
const RESTAURANT_CERTS = new Set(["MR", "MFR", "MFT", "HK", "AH", "HCI", "HR"]);
const SKIP_NATURE = /(旅宿|飯店|住宿|酒店|會館|渡假|民宿)/;
const DISTRICT_PATTERN = /(?:臺|台).+?[市縣](.+?[區鄉鎮市])/;

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePage(html) {
  const rows = [];
  const blocks = String(html || "").match(/<tbody>[\s\S]*?<\/tbody>/gi) || [];
  for (const block of blocks) {
    const name = decodeEntities(block.match(/<td class="name"[\s\S]*?>([\s\S]*?)<\/td>/i)?.[1] || "");
    const certType = decodeEntities(block.match(/data-th="認證別："[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    const city = decodeEntities(block.match(/data-th="地區："[\s\S]*?>([\s\S]*?)<\/td>/i)?.[1] || "");
    const nature = decodeEntities(block.match(/data-th="性質："[\s\S]*?>([\s\S]*?)<\/td>/i)?.[1] || "");
    const certifier = decodeEntities(block.match(/data-th="認證單位："[\s\S]*?>([\s\S]*?)<\/td>/i)?.[1] || "");
    const phone = decodeEntities(block.match(/<span>電話：<\/span>([\s\S]*?)<\/div>/i)?.[1] || "");
    const address = decodeEntities(block.match(/<span>地址：<\/span><a[\s\S]*?>([\s\S]*?)<\/a>/i)?.[1] || "");
    if (!name || !certType || !city || !CITIES.includes(city)) continue;
    if (!address) continue;
    rows.push({
      name,
      certType,
      city,
      nature,
      certifier,
      phone,
      address,
    });
  }
  return rows;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`fetch ${url} failed ${response.status}`);
  return response.text();
}

async function main() {
  const generatedAt = new Date().toISOString();
  const extractedAt = taipeiDate();
  const allRows = [];
  for (let page = 1; page <= 5; page += 1) {
    const html = await fetchText(pageUrl(page));
    allRows.push(...parsePage(html).map((row) => ({ ...row, page })));
  }
  const seen = new Set();
  const restaurants = [];
  const skipped = [];
  for (const row of allRows) {
    const key = `${row.certType}|${row.city}|${row.name}|${row.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!RESTAURANT_CERTS.has(row.certType) || SKIP_NATURE.test(row.nature)) {
      skipped.push({ ...row, reason: "non_restaurant_or_lodging_focused" });
      continue;
    }
    restaurants.push({
      name: row.name,
      city: row.city,
      district: row.address.match(DISTRICT_PATTERN)?.[1] || "",
      address: row.address,
      cuisine: row.nature,
      aliases: [],
      awards: [{
        guide: "muslimfriendly",
        year: "年份待確認",
        level: row.certType,
        awardName: "穆斯林友善餐飲認證",
        certType: row.certType,
        cuisine: row.nature,
        sourceName: "交通部觀光署接待穆斯林餐廳及旅館",
        certifier: row.certifier || "交通部觀光署穆斯林友善環境清單",
        extractedAt,
        notes: "來源清單未提供逐店認證年份；依使用者規則標記為年份待確認。",
        url: pageUrl(row.page),
      }],
      importConfidence: "high",
    });
  }
  const payload = {
    version: "muslim-friendly-2026-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_page_batch",
      nationalCertificationList: true,
      notes: [
        "來源為交通部觀光署「接待穆斯林餐廳及旅館」公開清單。",
        "本批匯入餐飲相關認證類型 MR/MFR/MFT/HK/AH/HCI/HR；純旅宿或環境認證不匯入餐廳卡片。",
        "來源未提供逐店認證年份；year 欄位標記為「年份待確認」，並以 extractedAt 記錄資料擷取日期。",
      ],
    },
    restaurants,
    skipped,
  };
  const countsByCert = {};
  for (const row of restaurants) countsByCert[row.awards[0].certType] = (countsByCert[row.awards[0].certType] || 0) + 1;
  const report = {
    generatedAt,
    sourceUrl,
    pages: 5,
    sourceRows: allRows.length,
    candidates: restaurants.length,
    skipped: skipped.length,
    countsByCert,
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
    pages: 5,
    sourceRows: 0,
    candidates: 0,
    skipped: 0,
    errors: [error.message],
  };
  writeJson(reportPath, report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
