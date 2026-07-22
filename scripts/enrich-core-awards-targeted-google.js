const fs = require("fs");
const path = require("path");
const https = require("https");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-targeted-google-report.json");

const TARGET_GUIDES = new Set(["michelin", "bib", "500bowl"]);
const PENDING = "待確認";

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
    https
      .get(
        url,
        { headers: { "user-agent": "Mozilla/5.0 nearby-good-eats targeted enrichment" } },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(new Error(`parse failed: ${error.message}`));
            }
          });
        }
      )
      .on("error", reject);
  });
}

function cityStem(city) {
  return String(city || "").trim().replace(/[縣市]$/, "");
}

function normalizedName(name) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()（）]/g, " ")
    .replace(/[\s'"`".,，、\-]/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]/gu, "");
}

function buildNameVariants(name) {
  const raw = String(name || "").trim();
  const variants = new Set([raw]);
  variants.add(raw.replace(/\s*\([^)]*\)\s*/g, "").trim());
  variants.add(raw.replace(/\s*（[^）]*）\s*/g, "").trim());
  variants.add(raw.replace(/\s+/g, " ").trim());
  return [...variants].filter(Boolean);
}

function isWeakDistrict(row) {
  const district = String(row.district || "").trim();
  return !district || district.includes(PENDING) || district === "???" || district === cityStem(row.city);
}

function isWeakAddress(row) {
  const address = String(row.address || "").trim();
  const city = String(row.city || "").trim();
  return !address || address.includes(PENDING) || address === city || address === cityStem(city);
}

function isWeakCuisine(row) {
  const cuisine = String(row.cuisine || "").trim();
  return !cuisine || cuisine.includes(PENDING);
}

function rowNeedsEnrichment(row) {
  return isWeakDistrict(row) || isWeakAddress(row) || isWeakCuisine(row);
}

function extractDistrict(address) {
  const text = String(address || "").trim();
  const match = text.match(/([^\s,，]{1,8}(?:區|鄉|鎮|市))/);
  return match ? match[1] : "";
}

const TYPE_TO_CUISINE = {
  japanese_restaurant: "日本菜",
  sushi_restaurant: "壽司",
  ramen_restaurant: "拉麵",
  chinese_restaurant: "中菜",
  cantonese_restaurant: "粵菜",
  taiwanese_restaurant: "臺灣菜",
  noodle_shop: "麵食",
  hot_pot_restaurant: "火鍋",
  seafood_restaurant: "海鮮",
  vegetarian_restaurant: "素食",
  thai_restaurant: "泰國菜",
  korean_restaurant: "韓國菜",
  french_restaurant: "法國菜",
  italian_restaurant: "義大利菜",
  steak_house: "牛排",
  restaurant: "餐廳",
};

function cuisineFromTypes(types) {
  for (const type of types || []) {
    if (TYPE_TO_CUISINE[type]) return TYPE_TO_CUISINE[type];
  }
  return "";
}

function scoreCandidate(row, candidate, queryVariant) {
  const candidateName = normalizedName(candidate.name);
  const candidateAddress = String(candidate.formatted_address || "");
  let score = 0;

  for (const variant of buildNameVariants(row.name)) {
    const sourceName = normalizedName(variant);
    if (!sourceName || !candidateName) continue;
    if (candidateName === sourceName) score = Math.max(score, 100);
    else if (candidateName.includes(sourceName) || sourceName.includes(candidateName)) score = Math.max(score, 82);
  }

  const queryName = normalizedName(queryVariant);
  if (queryName && candidateName === queryName) score = Math.max(score, 96);

  if (candidateAddress.includes(String(row.city || "").trim())) score += 16;
  if (candidate.business_status === "OPERATIONAL") score += 4;
  if ((candidate.types || []).includes("restaurant")) score += 2;
  return score;
}

async function textSearch(apiKey, query) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "zh-TW");
  url.searchParams.set("region", "tw");
  url.searchParams.set("key", apiKey);
  return fetchJson(url.toString());
}

async function resolveBestCandidate(apiKey, row) {
  const queries = [];
  for (const variant of buildNameVariants(row.name)) {
    queries.push(`${variant} ${row.city}`);
    queries.push(`${variant} ${row.city} 餐廳`);
  }

  let best = null;
  for (const query of [...new Set(queries)]) {
    const result = await textSearch(apiKey, query);
    for (const candidate of result.results || []) {
      const score = scoreCandidate(row, candidate, query);
      if (!best || score > best.score) best = { score, query, candidate };
    }
    if (best && best.score >= 112) break;
  }
  return best;
}

function appendNote(row, note) {
  const current = String(row.notes || "").trim();
  if (!current) {
    row.notes = note;
    return;
  }
  if (!current.includes(note)) row.notes = `${current} | ${note}`;
}

async function main() {
  const apiKey = readGoogleKey();
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY is required for batch Google enrichment; do not use the public browser key.");
  }

  const data = readJson(awardsPath);
  const rows = (data.restaurants || []).filter((row) => {
    const guides = (row.awards || []).map((award) => award.guide);
    return guides.some((guide) => TARGET_GUIDES.has(guide)) && rowNeedsEnrichment(row);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    scanned: 0,
    updated: 0,
    unresolved: [],
    updatedRows: [],
  };

  for (const row of rows) {
    report.scanned += 1;
    const best = await resolveBestCandidate(apiKey, row);
    if (!best || best.score < 88) {
      report.unresolved.push({ name: row.name, city: row.city, score: best ? best.score : 0 });
      continue;
    }

    const place = best.candidate;
    const formattedAddress = String(place.formatted_address || "").trim();
    const district = extractDistrict(formattedAddress);
    const cuisine = cuisineFromTypes(place.types || []);

    if (formattedAddress && isWeakAddress(row)) row.address = formattedAddress;
    if (district && isWeakDistrict(row)) row.district = district;
    if (cuisine && isWeakCuisine(row)) row.cuisine = cuisine;

    appendNote(row, `Google Places targeted enrichment ${new Date().toISOString().slice(0, 10)} place_id=${place.place_id}`);
    report.updated += 1;
    report.updatedRows.push({
      name: row.name,
      city: row.city,
      query: best.query,
      score: best.score,
      district: row.district,
      address: row.address,
      cuisine: row.cuisine,
      placeId: place.place_id,
    });
  }

  data.updated = new Date().toISOString().slice(0, 10);
  writeJson(awardsPath, data);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
