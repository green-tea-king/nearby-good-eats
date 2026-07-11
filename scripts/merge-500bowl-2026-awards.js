const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const candidatesPath = path.join(repoRoot, "assets", "500bowl-2026-candidates.json");
const reportPath = path.join(repoRoot, "assets", "500bowl-2026-merge-report.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/臺/g, "台")
    .replace(/[’‘`´]/g, "'")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×\s]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function cityFromAddress(address) {
  const match = String(address || "").match(/([台臺][北中南東]市|新北市|桃園市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)/);
  return match ? match[1].replace(/臺/g, "台") : "";
}

function identity(row) {
  return `${String(row.city || cityFromAddress(row.address) || "").replace(/臺/g, "台")}|${normalizeName(row.name)}`;
}

function awardKey(award) {
  return [award.guide, award.year || "", award.level || "", award.plates || "", award.bowls || "", award.sweets || ""].join("|");
}

function mergeSource(existing, sourceUrl) {
  const sources = new Set(String(existing || "").split(/\s*,\s*/).filter(Boolean));
  if (sourceUrl) sources.add(sourceUrl);
  return [...sources].join(", ");
}

function isPending(value) {
  return !String(value || "").trim() || /待確認|待補/.test(String(value || ""));
}

function enrichTarget(target, candidate) {
  if (candidate.city && isPending(target.city)) target.city = candidate.city;
  if (candidate.district && isPending(target.district)) target.district = candidate.district;
  if (candidate.address && isPending(target.address)) target.address = candidate.address;
  if (candidate.cuisine && isPending(target.cuisine)) target.cuisine = candidate.cuisine;
  target.source = mergeSource(target.source, candidate.source?.url || "");
  target.source = mergeSource(target.source, candidate.source?.officialArticleUrl || "");
  target.source = mergeSource(target.source, candidate.source?.kmlUrl || "");
}

function mergeAwardFields(existingAward, incomingAward) {
  for (const key of ["url", "sourceName", "sourceUrl", "extractedDate", "awardName", "notes", "award", "extractedAt"]) {
    if (incomingAward[key]) existingAward[key] = incomingAward[key];
  }
}

function fixMichelinSelected85td(rows, report) {
  const target = rows.find((row) => normalizeName(row.name) === normalizeName("捌伍添第 85TD"));
  if (!target) return;
  const award = (target.awards || []).find((item) => item.guide === "michelin_selected" && Number(item.year) === 2025);
  if (!award) return;
  Object.assign(award, {
    year: 2026,
    url: "https://guide.michelin.com/tw/zh_TW/taipei-region/taipei/restaurant/85td",
    sourceName: "MICHELIN Guide Taiwan 2026 restaurant page",
    sourceUrl: "https://guide.michelin.com/tw/zh_TW/taipei-region/taipei/restaurant/85td",
    extractedDate: "2026-07-11",
    notes: "由 2025 入選候選比對修正；保留為 Michelin Selected，但年份與來源改以 Michelin 2026 餐廳頁確認。",
    extractedAt: "2026-07-11",
  });
  target.city = String(target.city || "").replace(/臺/g, "台");
  target.source = mergeSource(target.source, award.sourceUrl);
  report.correctedMichelinSelected85td = true;
}

function merge() {
  const awards = readJson(awardsPath);
  const candidates = readJson(candidatesPath);
  const candidateKeys = new Set((candidates.restaurants || [])
    .filter((candidate) => candidate.importConfidence === "high" && candidate.city)
    .map(identity));
  let rows = Array.isArray(awards.restaurants) ? awards.restaurants : [];
  const report = {
    generatedAt: new Date().toISOString(),
    source: candidates.sourceUrl,
    mapSource: candidates.mapUrl || "",
    candidates: candidates.restaurants.length,
    addedRestaurants: 0,
    updatedExistingRestaurants: 0,
    skippedNeedsReview: 0,
    skippedDuplicateAward: 0,
    removedUnconfirmed2026Awards: 0,
    removedEmptyRestaurants: 0,
    removedUnconfirmedRows: [],
    correctedMichelinSelected85td: false,
  };

  rows = rows.filter((row) => {
    const before = (row.awards || []).length;
    row.awards = (row.awards || []).filter((award) => {
      const shouldKeep = !(award.guide === "500bowl" && Number(award.year) === 2026 && !candidateKeys.has(identity(row)));
      if (!shouldKeep) {
        report.removedUnconfirmed2026Awards += 1;
        report.removedUnconfirmedRows.push({
          name: row.name,
          city: row.city || "",
          level: award.level || "",
          previousSource: award.sourceUrl || award.url || "",
        });
      }
      return shouldKeep;
    });
    if (before && row.awards.length === 0) {
      report.removedEmptyRestaurants += 1;
      return false;
    }
    return true;
  });

  const byKey = new Map(rows.map((row) => [identity(row), row]));

  for (const candidate of candidates.restaurants) {
    if (candidate.importConfidence !== "high" || !candidate.city) {
      report.skippedNeedsReview += 1;
      continue;
    }
    const key = identity(candidate);
    let target = byKey.get(key);
    const existed = Boolean(target);
    if (!target) {
      target = {
        name: candidate.name,
        aliases: candidate.aliases || [],
        city: candidate.city,
        district: "行政區待確認",
        address: "地址待確認",
        cuisine: "菜系待確認",
        source: candidates.sourceUrl,
        awards: [],
        notes: "500碗 2026 批次匯入；地址、行政區、菜系待人工或 Google 資料補強。",
      };
      rows.push(target);
      byKey.set(key, target);
      report.addedRestaurants += 1;
    } else {
      const aliases = new Set([...(target.aliases || []), ...(candidate.aliases || [])].filter(Boolean));
      target.aliases = [...aliases];
      target.source = mergeSource(target.source, candidates.sourceUrl);
    }
    enrichTarget(target, candidate);

    const existingAwards = target.awards || [];
    const existing = new Map(existingAwards.map((award) => [awardKey(award), award]));
    for (const award of candidate.awards || []) {
      const key = awardKey(award);
      if (existing.has(key)) {
        mergeAwardFields(existing.get(key), award);
        report.skippedDuplicateAward += 1;
        continue;
      }
      target.awards = target.awards || [];
      target.awards.push(award);
      if (existed) report.updatedExistingRestaurants += 1;
    }
  }

  fixMichelinSelected85td(rows, report);

  awards.restaurants = rows.sort((a, b) => `${a.city || ""}${a.name}`.localeCompare(`${b.city || ""}${b.name}`, "zh-Hant"));
  awards.updated = "2026-07-11";
  awards.version = "awards-taiwan-core-guides-v2";

  writeJson(awardsPath, awards);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

merge();
