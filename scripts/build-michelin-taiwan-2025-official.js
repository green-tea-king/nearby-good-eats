const fs = require("fs");
const path = require("path");
const https = require("https");

const repoRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(repoRoot, "assets");
const awardsPath = path.join(assetsDir, "awards-taiwan.json");
const outPath = path.join(assetsDir, "michelin-taiwan-2025-official-candidates.json");
const reportPath = path.join(assetsDir, "michelin-taiwan-2025-official-report.json");

const SOURCES = {
  fullList: "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/taiwan-full-list",
  bib: "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/michelin-guide-taiwan-2025-bib-gourmand-selection",
};

const CITY_MAP = {
  "臺北": "台北市",
  "台北": "台北市",
  "臺中": "台中市",
  "台中": "台中市",
  "臺南": "台南市",
  "台南": "台南市",
  "高雄": "高雄市",
  "新北市": "新北市",
  "新竹縣": "新竹縣",
  "新竹市": "新竹市",
};

const OFFICIAL_ALIASES = {
  "態芮": ["Taïrroir", "Tairroir", "態芮 Taïrroir", "Taïrroir 態芮"],
  "A": ["Restaurant A", "A Restaurant"],
  "盈科": ["EIKA", "Eika", "盈科 EIKA", "EIKA 盈科"],
  "心宴": ["aMaze", "心宴 aMaze"],
  "侯布雄": ["L'Atelier de Joël Robuchon", "侯布雄 L'ATELIER de Joël Robuchon"],
  "渥達尼斯磨坊": ["Molino de Urdániz", "Molino de Urdaniz", "渥達尼斯磨坊 Molino de Urdániz"],
  "富錦樹台菜香檳 (松山)": ["富錦樹台菜香檳", "Fujin Tree Taiwanese Cuisine & Champagne (Songshan)"],
  "壽司芳": ["Sushiyoshi", "Sushi Yoshi", "壽司芳 Sushiyoshi"],
  "小小樹食 （大安路）": ["小小樹食", "Little Tree Food (Da'an Road)"],
  "陽明春天（士林）": ["陽明春天", "Yangming Spring (Shilin)"],
  "鹽之華": ["Fleur de Sel"],
  "俺達的肉屋": ["Oretachi No Nikuya"],
  "澀": ["Sur-"],
  "元紀": ["YUENJI"],
  "雋": ["GEN", "雋 中餐廳 GEN by Matt Chen"],
  "承": ["Sho"],
  "方蒔": ["the FRONT HOUSE"],
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "user-agent": "Mozilla/5.0 nearby-good-eats batch data builder",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.5",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(new URL(res.headers.location, url).toString()).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ");
}

function stripTags(value) {
  return htmlDecode(String(value || "").replace(/<[^>]+>/g, " "));
}

function cleanName(value) {
  return stripTags(value)
    .replace(/\((NEW|PROMOTED)\)/gi, "")
    .replace(/（NEW|PROMOTED）/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyRestaurantName(value) {
  const name = String(value || "").trim();
  if (!name) return false;
  if (/[<>=]/.test(name)) return false;
  if (/\b(class|src|alt|data-src|img-responsive|lazy)\b/i.test(name)) return false;
  if (/^©|^（©|^\(©/i.test(name)) return false;
  if (/MICHELIN|米其林指南|完整名單|延伸閱讀|訂閱|Instagram|Facebook|YouTube/i.test(name)) return false;
  if (["作者"].includes(name)) return false;
  return true;
}

function normalizeName(value) {
  return cleanName(value)
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/臺/g, "台")
    .replace(/[’‘`´]/g, "'")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×\s]/g, "")
    .toLowerCase();
}

function cityFromHeading(value) {
  const text = stripTags(value).replace(/\s+/g, "");
  for (const [key, city] of Object.entries(CITY_MAP)) {
    if (text.includes(key)) return city;
  }
  return "";
}

function articleBody(html) {
  const start = html.indexOf('<div class="collapse__block js-collapsible-content"');
  if (start < 0) return html;
  const endMarkers = [
    html.indexOf('<div class="article-footer', start + 1),
    html.indexOf('<section class="section', start + 1),
  ].filter((index) => index > start);
  const end = endMarkers.length ? Math.min(...endMarkers) : html.length;
  return html.slice(start, end);
}

function sectionBetween(body, startPattern, endPattern) {
  const start = body.search(startPattern);
  if (start < 0) return "";
  const rest = body.slice(start);
  const end = rest.slice(1).search(endPattern);
  return end >= 0 ? rest.slice(0, end + 1) : rest;
}

function parseCityNameBlocks(sectionHtml, awardFactory) {
  const rows = [];
  const parts = sectionHtml
    .replace(/<h3\b/gi, "\n@@H3@@<h3")
    .split("@@H3@@")
    .filter((part) => /<h3\b/i.test(part));
  for (const part of parts) {
    const headingMatch = part.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const city = cityFromHeading(headingMatch?.[1] || "");
    if (!city) continue;
    const content = part.replace(/^[\s\S]*?<\/h3>/i, "");
    const names = content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/a>/gi, "</a>\n")
      .replace(/<\/?(strong|b)[^>]*>/gi, "")
      .split(/\n+/)
      .map(cleanName)
      .filter(Boolean)
      .filter((name) => !/^延伸閱讀/.test(name))
      .filter((name) => !/^米其林/.test(name))
      .filter(isLikelyRestaurantName)
      .filter((name) => !/完整《臺灣米其林指南/.test(name))
      .filter((name) => !/歡迎訂閱/.test(name));
    for (const name of names) {
      if (name.length > 60) continue;
      rows.push({
        name,
        aliases: OFFICIAL_ALIASES[name] || [],
        city,
        source: SOURCES.fullList,
        sourceNote: "Parsed from MICHELIN Guide Taiwan 2025 full list article.",
        awards: [awardFactory()],
        reviewStatus: "official_name_needs_place_match",
        matchHints: { normalizedName: normalizeName(name) },
      });
    }
  }
  return rows;
}

function mergeSameRestaurantAwards(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.city}|${normalizeName(row.name)}`;
    if (!map.has(key)) {
      map.set(key, { ...row, awards: [...row.awards] });
      continue;
    }
    const current = map.get(key);
    const keys = new Set(current.awards.map((a) => [a.guide, a.level || "", a.year].join("|")));
    for (const award of row.awards) {
      const awardKey = [award.guide, award.level || "", award.year].join("|");
      if (!keys.has(awardKey)) current.awards.push(award);
    }
  }
  return [...map.values()];
}

function parseOfficialFullList(html) {
  const body = articleBody(html);
  const rows = [];
  rows.push(...parseCityNameBlocks(
    sectionBetween(body, /3 家米其林三星餐廳/, /7 家二星餐廳/),
    () => ({ guide: "michelin", level: "三星", year: 2025, url: SOURCES.fullList }),
  ));
  rows.push(...parseCityNameBlocks(
    sectionBetween(body, /7 家二星餐廳/, /43 家一星餐廳/),
    () => ({ guide: "michelin", level: "二星", year: 2025, url: SOURCES.fullList }),
  ));
  rows.push(...parseCityNameBlocks(
    sectionBetween(body, /43 家一星餐廳/, /7 家米其林綠星餐廳/),
    () => ({ guide: "michelin", level: "一星", year: 2025, url: SOURCES.fullList }),
  ));
  rows.push(...parseCityNameBlocks(
    sectionBetween(body, /7 家米其林綠星餐廳/, /222 家入選餐廳/),
    () => ({ guide: "greenstar", year: 2025, url: SOURCES.fullList }),
  ));
  rows.push(...parseCityNameBlocks(
    sectionBetween(body, /222 家入選餐廳/, /歡迎訂閱|Michelin Guide Ceremony|<section/i),
    () => ({ guide: "michelin_selected", level: "入選餐廳", year: 2025, url: SOURCES.fullList }),
  ));
  return mergeSameRestaurantAwards(rows);
}

function importExistingBib(restaurants) {
  return (restaurants || [])
    .filter((row) => (row.awards || []).some((award) => award.guide === "bib" && Number(award.year) === 2025))
    .map((row) => ({
      name: row.name,
      aliases: row.aliases || [],
      city: row.city || "",
      address: row.address || "",
      source: row.source || SOURCES.bib,
      sourceNote: "Carried from existing awards-taiwan.json Bib Gourmand 2025 records; official article confirms 144 total.",
      awards: [{ guide: "bib", year: 2025, url: SOURCES.bib }],
      reviewStatus: "existing_bib_record",
      matchHints: { normalizedName: normalizeName(row.name) },
    }));
}

async function main() {
  const awards = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
  const html = await fetchText(SOURCES.fullList);
  const snapshotPath = path.join(assetsDir, "michelin-taiwan-full-list-2025.official.snapshot.html");
  fs.writeFileSync(snapshotPath, html, "utf8");

  const officialRows = parseOfficialFullList(html);
  const bibRows = importExistingBib(awards.restaurants);
  const rows = mergeSameRestaurantAwards([...officialRows, ...bibRows]);

  const summary = {
    total: rows.length,
    officialParsed: officialRows.length,
    existingBibImported: bibRows.length,
    byGuide: rows.reduce((acc, row) => {
      for (const award of row.awards || []) acc[award.guide] = (acc[award.guide] || 0) + 1;
      return acc;
    }, {}),
    byCity: rows.reduce((acc, row) => {
      acc[row.city || ""] = (acc[row.city || ""] || 0) + 1;
      return acc;
    }, {}),
    expected: {
      michelinStars: 53,
      bib: 144,
      selected: 222,
      greenstar: 7,
    },
  };

  const output = {
    version: "michelin-taiwan-2025-official-candidates",
    generatedAt: new Date().toISOString(),
    sources: SOURCES,
    policy: {
      primarySource: "MICHELIN Guide Taiwan 2025 full list article",
      bibSource: "Existing curated awards-taiwan.json Bib records; official Bib article confirms total count.",
      noRuntimeLookup: true,
      importMode: "candidate-first; review before replacing live awards-taiwan.json",
      note: "2026 full list is not used before official publication.",
    },
    summary,
    restaurants: rows,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: output.generatedAt, summary }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outPath, reportPath, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
