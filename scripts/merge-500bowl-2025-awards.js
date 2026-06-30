const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.500bowl-2025-draft.json");
const candidatesPath = path.join(repoRoot, "assets", "500bowl-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "500bowl-2025-merge-report.json");

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
  return `${row.city || cityFromAddress(row.address) || ""}|${normalizeName(row.name)}`;
}

function awardKey(award) {
  return [award.guide, award.year || "", award.level || "", award.plates || "", award.bowls || "", award.sweets || ""].join("|");
}

function merge() {
  const awards = readJson(awardsPath);
  const candidates = readJson(candidatesPath);
  const rows = Array.isArray(awards.restaurants) ? awards.restaurants : [];
  const byKey = new Map(rows.map((row) => [identity(row), row]));
  const report = {
    generatedAt: new Date().toISOString(),
    source: candidates.sourceUrl,
    candidates: candidates.restaurants.length,
    addedRestaurants: 0,
    updatedExistingRestaurants: 0,
    skippedNeedsReview: 0,
    skippedDuplicateAward: 0,
  };

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
        address: "",
        awards: [],
        city: candidate.city,
        aliases: candidate.aliases || [],
      };
      rows.push(target);
      byKey.set(key, target);
      report.addedRestaurants += 1;
    } else {
      const aliases = new Set([...(target.aliases || []), ...(candidate.aliases || [])].filter(Boolean));
      target.aliases = [...aliases];
    }

    const existing = new Set((target.awards || []).map(awardKey));
    for (const award of candidate.awards || []) {
      if (existing.has(awardKey(award))) {
        report.skippedDuplicateAward += 1;
        continue;
      }
      target.awards = target.awards || [];
      target.awards.push(award);
      if (existed) report.updatedExistingRestaurants += 1;
    }
  }

  awards.restaurants = rows.sort((a, b) => `${a.city || ""}${a.name}`.localeCompare(`${b.city || ""}${b.name}`, "zh-Hant"));
  awards.updated = "2026-07-01";
  awards._README = awards._README.replace("500碗/500甜保留格式，尚未匯入未驗證資料", "500碗已匯入 2025 官方文字名單高信心資料；500甜保留格式，尚未匯入未驗證資料");
  awards._coverage.note = `${awards._coverage.note} 2025 500碗已匯入官方文字名單高信心資料，跨縣市列保留在 merge report 待人工覆核。`;
  if (!awards._sources.includes(candidates.sourceUrl)) awards._sources.push(candidates.sourceUrl);

  writeJson(draftPath, awards);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

merge();
