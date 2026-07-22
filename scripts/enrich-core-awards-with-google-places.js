const fs = require("fs");
const path = require("path");
const https = require("https");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-google-enrichment-report.json");
const TARGET_GUIDES = new Set(String(process.env.TARGET_GUIDES || "").split(",").map((x) => x.trim()).filter(Boolean));
const MAX_ROWS = Number(process.env.MAX_ROWS || "0");
const MIN_SCORE = Number(process.env.MIN_SCORE || "70");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readGoogleKey() {
  return String(process.env.GOOGLE_MAPS_SERVER_API_KEY || "").trim();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "user-agent": "Mozilla/5.0 nearby-good-eats enrichment" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`parse failed ${url}: ${error.message}`));
        }
      });
    }).on("error", reject);
  });
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()（）·'".,，\-_\s]/g, "")
    .toLowerCase();
}

function isWeakRow(row) {
  const city = String(row.city || "").trim();
  const district = String(row.district || "").trim();
  const address = String(row.address || "").trim();
  const cuisine = String(row.cuisine || "").trim();
  return !district || district === "???" || district.includes("待確認")
    || !address || address.includes("待確認") || address === city
    || !cuisine || cuisine.includes("待確認");
}

function extractDistrict(address) {
  const text = String(address || "").trim();
  const match = text.match(/([^0-9,，]{1,10}(?:區|鄉|鎮|市))/);
  return match ? match[1] : "";
}

const TYPE_LABELS = {
  chinese_restaurant: "中式料理",
  cantonese_restaurant: "粵菜",
  taiwanese_restaurant: "台灣料理",
  seafood_restaurant: "海鮮",
  hot_pot_restaurant: "火鍋",
  japanese_restaurant: "日本料理",
  sushi_restaurant: "壽司",
  ramen_restaurant: "拉麵",
  yakiniku_restaurant: "燒肉",
  izakaya_restaurant: "居酒屋",
  steak_house: "牛排",
  italian_restaurant: "義式料理",
  french_restaurant: "法式料理",
  modern_french_restaurant: "現代法式",
  restaurant: "餐廳",
  cafe: "咖啡廳",
  dessert_restaurant: "甜點",
  bakery: "烘焙",
  brunch_restaurant: "早午餐",
  breakfast_restaurant: "早餐",
  noodle_shop: "麵食",
  family_restaurant: "家常料理",
  barbecue_restaurant: "燒烤",
  chicken_restaurant: "雞料理",
};

function cuisineFromTypes(types) {
  for (const type of types || []) {
    if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  }
  return "";
}

function cityMatches(address, city) {
  return String(address || "").includes(String(city || ""));
}

function scoreCandidate(row, candidate) {
  const rowName = normalizeName(row.name);
  const candidateName = normalizeName(candidate.name);
  let score = 0;
  if (candidateName === rowName) score += 100;
  if (candidateName.includes(rowName) || rowName.includes(candidateName)) score += 45;
  for (const alias of row.aliases || []) {
    const aliasName = normalizeName(alias);
    if (!aliasName) continue;
    if (candidateName === aliasName) score += 90;
    if (candidateName.includes(aliasName) || aliasName.includes(candidateName)) score += 30;
  }
  if (cityMatches(candidate.formatted_address, row.city)) score += 20;
  if (candidate.business_status === "OPERATIONAL") score += 5;
  return score;
}

async function searchPlace(apiKey, query) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "zh-TW");
  url.searchParams.set("region", "tw");
  url.searchParams.set("key", apiKey);
  return fetchJson(url.toString());
}

async function resolveBestPlace(apiKey, row) {
  const queries = [
    `${row.name} ${row.city}`,
    ...(row.aliases || []).slice(0, 2).map((alias) => `${alias} ${row.city}`),
  ];
  let best = null;
  for (const query of queries) {
    const result = await searchPlace(apiKey, query);
    for (const candidate of result.results || []) {
      const score = scoreCandidate(row, candidate);
      if (!best || score > best.score) best = { score, candidate, query };
    }
    if (best && best.score >= 120) break;
  }
  return best;
}

async function main() {
  const apiKey = readGoogleKey();
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY is required for batch Google enrichment; do not use the public browser key.");
  }
  const data = readJson(awardsPath);
  const report = {
    generatedAt: new Date().toISOString(),
    targetGuides: [...TARGET_GUIDES],
    maxRows: MAX_ROWS || null,
    minScore: MIN_SCORE,
    scanned: 0,
    updated: 0,
    skipped: 0,
    unresolved: [],
    updatedRows: [],
  };

  for (const row of data.restaurants || []) {
    if (TARGET_GUIDES.size && !(row.awards || []).some((award) => TARGET_GUIDES.has(award.guide))) continue;
    if (!isWeakRow(row)) continue;
    if (MAX_ROWS > 0 && report.scanned >= MAX_ROWS) break;
    report.scanned += 1;
    const best = await resolveBestPlace(apiKey, row);
    if (!best || best.score < MIN_SCORE) {
      report.skipped += 1;
      report.unresolved.push({ name: row.name, city: row.city, score: best?.score || 0 });
      continue;
    }
    const place = best.candidate;
    const formattedAddress = String(place.formatted_address || "").trim();
    const district = extractDistrict(formattedAddress);
    const cuisine = cuisineFromTypes(place.types || []);
    if (formattedAddress && (String(row.address || "").includes("待確認") || String(row.address || "").trim() === row.city || !String(row.address || "").trim())) {
      row.address = formattedAddress;
    }
    if (district && (String(row.district || "").includes("待確認") || String(row.district || "").trim() === row.city.replace(/[縣市]$/, "") || String(row.district || "").trim() === "???")) {
      row.district = district;
    }
    if (cuisine && (String(row.cuisine || "").includes("待確認") || !String(row.cuisine || "").trim())) {
      row.cuisine = cuisine;
    }
    const note = `地址/行政區/類型由 Google Places 補齊，place_id=${place.place_id}，擷取日 2026-07-03`;
    row.notes = row.notes ? `${row.notes}；${note}` : note;
    report.updated += 1;
    report.updatedRows.push({
      name: row.name,
      city: row.city,
      query: best.query,
      score: best.score,
      address: row.address,
      district: row.district,
      cuisine: row.cuisine,
      placeId: place.place_id,
    });
  }

  data.updated = "2026-07-03";
  writeJson(awardsPath, data);
  writeJson(reportPath, report);
  console.log(JSON.stringify({
    scanned: report.scanned,
    updated: report.updated,
    skipped: report.skipped,
    unresolved: report.unresolved.slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
