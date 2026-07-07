const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const awardsPath = path.join(root, "assets", "awards-taiwan.json");
const strictGapPath = path.join(root, "assets", "core-awards-strict-gap-report.json");
const outPath = path.join(root, "assets", "core-awards-manual-search-report.json");

const awardsData = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
const strictGap = JSON.parse(fs.readFileSync(strictGapPath, "utf8"));

const pendingTokens = ["待確認", "行政區待確認", "地址待確認", "菜系待確認"];
const lowPrecisionValues = new Set([
  "台中",
  "台中市",
  "臺中市",
  "台南",
  "台南市",
  "臺南市",
  "台東",
  "台東縣",
  "臺東縣",
  "台北市",
  "臺北市",
  "台北市大安區"
]);

function isPending(value = "") {
  const text = String(value || "").trim();
  if (!text) return true;
  if (pendingTokens.some((token) => text.includes(token))) return true;
  return lowPrecisionValues.has(text);
}

function guidePriority(entry) {
  if (entry.awards.some((award) => award.guide === "500plate")) return 0;
  if (entry.awards.some((award) => award.guide === "500bowl")) return 1;
  if (entry.awards.some((award) => award.guide === "500sweet")) return 2;
  return 9;
}

function normalizeQueryCity(city = "") {
  return String(city).replaceAll("臺", "台");
}

function buildEntry(row) {
  const canonical = awardsData.restaurants.find((restaurant) => restaurant.name === row.name) || row;
  return {
    name: canonical.name || row.name,
    city: canonical.city || row.city || "",
    district: canonical.district || row.district || "",
    address: canonical.address || row.address || "",
    cuisine: canonical.cuisine || row.cuisine || "",
    awards: (canonical.awards || row.awards || []).map((award) => ({
      guide: award.guide,
      year: award.year,
      level: award.level,
      awardName: award.awardName,
      sourceUrl: award.sourceUrl || award.url || ""
    })),
    queryHints: [
      `${canonical.name || row.name} ${normalizeQueryCity(canonical.city || row.city || "")} 官方`,
      `${canonical.name || row.name} ${normalizeQueryCity(canonical.city || row.city || "")} 菜系`,
      `${canonical.name || row.name} ${normalizeQueryCity(canonical.city || row.city || "")} 地址`,
      `${canonical.name || row.name} ${normalizeQueryCity(canonical.city || row.city || "")} site:facebook.com`,
      `${canonical.name || row.name} ${normalizeQueryCity(canonical.city || row.city || "")} site:ifoodie.tw`
    ],
    notes: canonical.notes || row.notes || ""
  };
}

const entries = strictGap.rows.map(buildEntry);

const cuisineOnly = entries
  .filter((entry) => !isPending(entry.district) && !isPending(entry.address) && isPending(entry.cuisine))
  .sort((a, b) => {
    const priorityDiff = guidePriority(a) - guidePriority(b);
    if (priorityDiff) return priorityDiff;
    if (b.awards.length !== a.awards.length) return b.awards.length - a.awards.length;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

const locationAndCuisine = entries
  .filter((entry) => (isPending(entry.district) || isPending(entry.address)) && isPending(entry.cuisine))
  .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

const locationOnly = entries
  .filter((entry) => (isPending(entry.district) || isPending(entry.address)) && !isPending(entry.cuisine))
  .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

const report = {
  generatedAt: new Date().toISOString(),
  purpose: "Prioritized manual or semi-automated public-web enrichment queue for remaining core awards gaps.",
  totalStrictRows: strictGap.summary?.rows || strictGap.rows.length,
  summary: {
    cuisineOnly: cuisineOnly.length,
    locationAndCuisine: locationAndCuisine.length,
    locationOnly: locationOnly.length
  },
  priorityCuisineOnly: cuisineOnly.slice(0, 120),
  samples: {
    locationAndCuisine: locationAndCuisine.slice(0, 80),
    locationOnly: locationOnly.slice(0, 80)
  }
};

fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outPath,
      summary: report.summary,
      topCuisineOnly: report.priorityCuisineOnly.slice(0, 12).map((entry) => ({
        name: entry.name,
        city: entry.city,
        district: entry.district,
        address: entry.address,
        awards: entry.awards
      }))
    },
    null,
    2
  )
);
