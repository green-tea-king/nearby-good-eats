const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "50best-discovery-taiwan-candidates.json");
const reportPath = path.join(repoRoot, "assets", "50best-discovery-taiwan-import-report.json");
const sitemapUrl = "https://www.theworlds50best.com/discovery/sitemap/taiwan/taipei";
const baseUrl = "https://www.theworlds50best.com";

const KNOWN_RESTAURANT_SLUGS = [
  "Adachi",
  "Coast",
  "Din-Tai-Fung",
  "Impromptu-by-Paul-Lee",
  "Le-Palais",
  "Logy",
  "Mume",
  "Restaurant-A",
  "Silks-House",
  "Sushi-Amamoto",
  "Ta%C3%AFrroir",
  "Ya-Ge",
  "Zea",
];

const NAME_FIXES = new Map([
  ["Taïrroir", { name: "Tairroir", aliases: ["態芮", "Taïrroir"] }],
  ["Mume", { name: "MUME", aliases: ["Mume"] }],
  ["Logy", { name: "Logy", aliases: ["logy"] }],
  ["Le Palais", { name: "Le Palais", aliases: ["頤宮", "頤宮中餐廳"] }],
  ["Din Tai Fung", { name: "鼎泰豐", aliases: ["Din Tai Fung"] }],
  ["Ya Ge", { name: "雅閣", aliases: ["Ya Ge"] }],
  ["Restaurant A", { name: "Restaurant A", aliases: [] }],
  ["Silks House", { name: "Silks House", aliases: [] }],
  ["Impromptu by Paul Lee", { name: "Impromptu by Paul Lee", aliases: [] }],
  ["Sushi Amamoto", { name: "Sushi Amamoto", aliases: [] }],
  ["Adachi", { name: "Adachi", aliases: [] }],
  ["Coast", { name: "Coast", aliases: [] }],
  ["Zea", { name: "ZEA", aliases: ["Zea"] }],
]);

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
    .replace(/&iuml;/g, "ï");
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function firstMatch(html, re) {
  const match = html.match(re);
  return match ? stripTags(match[1]) : "";
}

function extractName(html) {
  return firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
}

function extractLocation(html) {
  const marker = html.match(/<h2[^>]*>\s*Location\s*<\/h2>([\s\S]*?)(?:<h2|EXPLORE|<footer|Register for a 50 Best account)/i);
  return marker ? stripTags(marker[1]) : "";
}

function extractSummary(html) {
  const body = html.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  return body ? stripTags(body[1]) : "";
}

function candidateUrl(slug) {
  return `${baseUrl}/discovery/Establishments/Taiwan/Taipei/${slug}.html`;
}

async function main() {
  const sourceCheckedAt = new Date().toISOString();
  const sitemapHtml = await fetchText(sitemapUrl);
  const foundSlugs = [...sitemapHtml.matchAll(/href="([^"]*\/discovery\/Establishments\/Taiwan\/Taipei\/([^"\/]+)\.html)"/gi)]
    .map((match) => decodeURIComponent(match[2]))
    .filter(Boolean);
  const slugs = [...new Set([...KNOWN_RESTAURANT_SLUGS, ...foundSlugs])];
  const restaurants = [];
  const errors = [];

  for (const slug of slugs) {
    const url = candidateUrl(slug);
    try {
      const html = await fetchText(url);
      if (!/<title>[^<]*Restaurant/i.test(html) && !/>Restaurant</i.test(html)) continue;
      const pageName = extractName(html);
      if (!pageName) continue;
      const fixed = NAME_FIXES.get(pageName) || { name: pageName, aliases: [] };
      const address = extractLocation(html);
      const summary = extractSummary(html);
      restaurants.push({
        name: fixed.name,
        city: "臺北市",
        address,
        aliases: fixed.aliases,
        sourceSummary: summary,
        awards: [{
          guide: "50bestdiscovery",
          year: 2026,
          level: "Discovery",
          url,
        }],
        importConfidence: "high",
      });
    } catch (error) {
      errors.push({ slug, url, error: error.message });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const row of restaurants) {
    const key = `${row.city}|${row.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const payload = {
    version: "50best-discovery-taiwan-candidates",
    generatedAt: sourceCheckedAt,
    sourceUrl: sitemapUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_page_batch",
      restaurantOnly: true,
      notes: [
        "50 Best Discovery 台灣 Taipei 官方頁面批次整理；只匯入餐廳頁，不匯入 Bar/Hotel。",
        "此來源是 guide/discovery 型推薦，權重低於 Asia's 50 Best 排名與 Google 評分評論主體。",
      ],
    },
    restaurants: deduped.sort((a, b) => a.name.localeCompare(b.name, "en")),
  };
  const report = {
    generatedAt: sourceCheckedAt,
    sourceUrl: sitemapUrl,
    knownSlugs: KNOWN_RESTAURANT_SLUGS.length,
    discoveredSlugs: foundSlugs.length,
    candidates: deduped.length,
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
