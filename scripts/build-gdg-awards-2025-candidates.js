const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const outPath = path.join(repoRoot, "assets", "gdg-awards-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "gdg-awards-2025-import-report.json");
const sourceUrl = "https://greenmedia.today/article_detail.php?cid=7&mid=1407";

const SKIP_PREFIXES = ["企業組", "廠商組"];
const SKIP_NAME_PATTERNS = [
  /股份有限公司/,
  /有限公司$/,
  /企業有限公司$/,
  /食品廠/,
  /國際企業/,
  /科技股份/,
  /證券股份/,
  /營養室$/,
  /餐飲集團$/,
  /蕃薯藤集團$/,
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/臺/g, "台")
    .replace(/[’‘`´]/g, "'")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×\s]/g, "")
    .replace(/餐廳$/, "")
    .toLowerCase();
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");
}

function stripChefPrefix(name) {
  const match = String(name || "").match(/^[^（(]+[（(]([^）)]+)[）)]$/);
  return match ? match[1].trim() : String(name || "").trim();
}

function cleanName(name) {
  return stripChefPrefix(name)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-•\s]+/, "")
    .replace(/[。；;]$/g, "")
    .trim();
}

function sourceKey(category, name) {
  return `${category}|${normalizeName(name)}`;
}

function buildExistingIndex(awards) {
  const byName = new Map();
  for (const row of awards.restaurants || []) {
    const names = [row.name, ...(row.aliases || [])];
    for (const name of names) {
      const key = normalizeName(name);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(row);
    }
  }
  return byName;
}

function findExisting(row, byName) {
  const key = normalizeName(row.name);
  const matches = (byName.get(key) || []).filter((match, index, arr) =>
    arr.findIndex((x) => normalizeName(x.name) === normalizeName(match.name) && x.city === match.city) === index
  );
  if (matches.length !== 1) return null;
  return matches[0];
}

function splitNames(value) {
  return String(value || "")
    .split(/[、，]/)
    .map(cleanName)
    .filter(Boolean);
}

function parseRows(text) {
  const start = text.indexOf("「綠色餐飲指南」2025年度評鑑入圍名單");
  const end = text.indexOf("2025第四屆綠色餐飲年會暨頒獎典禮", start);
  if (start < 0 || end < 0) throw new Error("GDG nominee block not found");
  const lines = text.slice(start, end).split("\n").map((line) => line.trim()).filter(Boolean);
  const rows = [];
  let category = "";
  let categoryEn = "";
  let dimension = "";

  for (const line of lines) {
    const dim = line.match(/^◎(.+?)◎/);
    if (dim) {
      dimension = dim[1].trim();
      continue;
    }
    const cat = line.match(/[◗►]\s*(.+?)\s*[◖◄]/);
    if (cat) {
      const raw = cat[1].trim();
      const parts = raw.split(/\s{2,}| (?=[A-Z][A-Za-z])/);
      category = parts[0].trim();
      categoryEn = raw.replace(category, "").trim();
      continue;
    }
    const colon = line.match(/^([^：:]{1,12})[：:](.+)$/);
    const region = colon ? colon[1].trim() : "";
    const listText = colon ? colon[2] : line;
    if (SKIP_PREFIXES.includes(region)) continue;
    if (!category || /[-─*]/.test(listText)) continue;
    for (const name of splitNames(listText)) {
      if (!name || SKIP_NAME_PATTERNS.some((pattern) => pattern.test(name))) continue;
      rows.push({
        name,
        region,
        dimension,
        category,
        categoryEn,
      });
    }
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = sourceKey(row.category, row.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const generatedAt = new Date().toISOString();
  const html = await fetch(sourceUrl).then((res) => {
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    return res.text();
  });
  const awards = readJson(awardsPath);
  const byName = buildExistingIndex(awards);
  const sourceRows = parseRows(htmlToText(html));
  const restaurants = [];
  const needsCityReview = [];

  for (const sourceRow of sourceRows) {
    const existing = findExisting(sourceRow, byName);
    const award = {
      guide: "gdgawards",
      year: 2025,
      level: sourceRow.category,
      category: sourceRow.category,
      dimension: sourceRow.dimension,
      region: sourceRow.region,
      url: sourceUrl,
    };
    if (existing) {
      restaurants.push({
        name: existing.name,
        city: existing.city,
        aliases: [...new Set([sourceRow.name, ...(existing.aliases || [])])].filter((alias) => normalizeName(alias) !== normalizeName(existing.name)),
        awards: [award],
        importConfidence: "high",
        matchedBy: "unique_existing_awards_name",
      });
    } else {
      needsCityReview.push({
        name: sourceRow.name,
        region: sourceRow.region,
        dimension: sourceRow.dimension,
        category: sourceRow.category,
        categoryEn: sourceRow.categoryEn,
        reason: "city_not_in_source_and_no_unique_existing_match",
      });
    }
  }

  const payload = {
    version: "gdg-awards-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "public_article_batch_unique_existing_match_only",
      noRegionToCityGuess: true,
      notes: [
        "來源為 Green Media / 綠色餐飲指南公開文章的 2025 年度評鑑入圍名單。",
        "原文多數只列北區、中區、南區、東區或未列地點；不以區域推測縣市。",
        "只有能從既有內建評鑑資料唯一比對到城市的店家自動匯入，其餘保留待人工補城市。",
      ],
    },
    restaurants,
    needsCityReview,
  };
  const categoryCounts = {};
  for (const row of restaurants) categoryCounts[row.awards[0].category] = (categoryCounts[row.awards[0].category] || 0) + 1;
  const report = {
    generatedAt,
    sourceUrl,
    sourceRows: sourceRows.length,
    candidates: restaurants.length,
    needsCityReview: needsCityReview.length,
    categoryCounts,
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
    sourceRows: 0,
    candidates: 0,
    needsCityReview: 0,
    errors: [error.message],
  };
  writeJson(reportPath, report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
