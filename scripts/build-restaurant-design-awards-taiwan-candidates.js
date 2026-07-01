const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "restaurant-design-awards-taiwan-candidates.json");
const reportPath = path.join(repoRoot, "assets", "restaurant-design-awards-taiwan-import-report.json");
const archiveBase = "https://restaurantandbardesignawards.com/awards-archive";

const YEARS = Array.from({ length: 17 }, (_, i) => 2025 - i);
const CITY_MAP = new Map([
  ["Taipei City", "臺北市"],
  ["Taichung City", "臺中市"],
  ["Kaohsiung City", "高雄市"],
]);
const NAME_FIXES = new Map([
  ["RAW", { name: "RAW", aliases: [] }],
  ["Sukiyaki Kitaro", { name: "Sukiyaki Kitaro", aliases: ["壽喜燒一丁"] }],
  ["Thomas Chien", { name: "Thomas Chien", aliases: ["Thomas Chien Restaurant", "Thomas Chien 法式餐廳"] }],
]);
const FALLBACKS = [
  {
    name: "RAW",
    city: "臺北市",
    aliases: [],
    awards: [{
      guide: "designawards",
      year: 2015,
      level: "Asia Restaurant",
      designer: "WEIJENBERG",
      url: `${archiveBase}/2015`,
    }],
    importConfidence: "high",
  },
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "nearby-good-eats batch source checker (non-runtime)",
        "Accept": "text/html,application/xhtml+xml",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchText(new URL(res.headers.location, url).toString()));
        return;
      }
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
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&rsquo;/g, "’")
    .replace(/&eacute;/g, "é");
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractTaiwanEntries(html) {
  const matches = [];
  const articles = html.match(/<article\b[\s\S]*?<\/article>/gi) || [];
  for (const article of articles) {
    if (!/Taiwan/.test(article)) continue;
    const name = stripTags((article.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || [])[1] || "");
    const location = stripTags((article.match(/<p>\(([^)]*Taiwan)\)<\/p>/i) || [])[1] || "");
    const designer = stripTags((article.match(/<p>\([^)]*Taiwan\)<\/p>\s*<p>([\s\S]*?)<\/p>/i) || [])[1] || "");
    const categories = [...article.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
    const cityName = location.split(",")[0]?.trim();
    const city = CITY_MAP.get(cityName) || "";
    if (!name || !city) continue;
    matches.push({
      venue: name,
      city,
      designer,
      category: categories[0] || "Restaurant & Bar Design Award",
    });
  }
  return matches;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = [];
  const errors = [];

  for (const year of YEARS) {
    const url = `${archiveBase}/${year}`;
    try {
      const html = await fetchText(url);
      for (const item of extractTaiwanEntries(html)) {
        const fixed = NAME_FIXES.get(item.venue) || { name: item.venue, aliases: [] };
        restaurants.push({
          name: fixed.name,
          city: item.city,
          aliases: fixed.aliases,
          awards: [{
            guide: "designawards",
            year,
            level: item.category,
            designer: item.designer,
            url,
          }],
          importConfidence: "high",
        });
      }
    } catch (error) {
      errors.push({ year, url, error: error.message });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const row of [...restaurants, ...FALLBACKS]) {
    const award = row.awards[0];
    const key = `${row.city}|${row.name}|${award.year}|${award.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const payload = {
    version: "restaurant-design-awards-taiwan-candidates",
    generatedAt,
    sourceUrl: archiveBase,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_archive_batch",
      designSignalOnly: true,
      notes: [
        "Restaurant & Bar Design Awards 官方 archive 批次整理 Taiwan 得獎項目。",
        "此來源是空間/設計獎，不是餐點風味評分；只做低權重認證徽章與小幅外部信號。",
      ],
    },
    restaurants: deduped.sort((a, b) => `${a.city}${a.name}`.localeCompare(`${b.city}${b.name}`, "zh-Hant")),
  };
  const report = {
    generatedAt,
    years: YEARS,
    candidates: deduped.length,
    names: deduped.map((row) => `${row.name} ${row.awards[0].year} ${row.awards[0].level}`),
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
