const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const candidatesPath = path.join(repoRoot, "assets", "michelin-taipei-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "michelin-taipei-2025-import-report.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.michelin-2025-draft.json");

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeAddress(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/臺/g, "台")
    .replace(/[，,\s]/g, "")
    .toLowerCase();
}

function namesOf(row) {
  return [row.name, ...(row.aliases || [])].filter(Boolean);
}

function awardKey(award) {
  return [
    award.guide,
    award.level || "",
    award.year || "",
    award.plates || "",
    Array.isArray(award.dishPlates) ? award.dishPlates.join(",") : "",
  ].join("|");
}

function mergeAwards(existingAwards, incomingAwards) {
  const out = [...(existingAwards || [])];
  const keys = new Set(out.map(awardKey));
  for (const award of incomingAwards || []) {
    if (award.guide === "michelin_selected") continue;
    const key = awardKey(award);
    if (!keys.has(key)) {
      out.push(award);
      keys.add(key);
    }
  }
  return out;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function classifyCandidate(candidate, existing) {
  const city = candidate.city || "台北市";
  const candidateNames = namesOf(candidate).map(normalizeName).filter(Boolean);
  const candidatePhone = normalizePhone(candidate.phone || candidate.matchHints?.phone);
  const candidateAddress = normalizeAddress(candidate.address);

  const candidates = [];
  for (let index = 0; index < existing.length; index += 1) {
    const row = existing[index];
    if ((row.city || city) !== city) continue;
    const rowNames = namesOf(row).map(normalizeName).filter(Boolean);
    const rowAddress = normalizeAddress(row.address);
    const rowPhone = normalizePhone(row.phone);

    const exactName = candidateNames.some((name) => rowNames.includes(name));
    const fuzzyName = candidateNames.some((name) =>
      rowNames.some((other) => name.length >= 3 && other.length >= 3 && (name.includes(other) || other.includes(name)))
    );
    const addressHit = candidateAddress && rowAddress && (
      candidateAddress.includes(rowAddress.slice(0, 10)) ||
      rowAddress.includes(candidateAddress.slice(0, 10))
    );
    const phoneHit = candidatePhone && rowPhone && candidatePhone.endsWith(rowPhone.slice(-8));

    if (exactName && (addressHit || phoneHit)) {
      candidates.push({ status: "matchedHigh", index, row, reasons: ["exactName", addressHit ? "address" : "phone"] });
    } else if (exactName) {
      candidates.push({ status: "matchedMedium", index, row, reasons: ["exactName"] });
    } else if (fuzzyName && (addressHit || phoneHit)) {
      candidates.push({ status: "matchedMedium", index, row, reasons: ["fuzzyName", addressHit ? "address" : "phone"] });
    } else if (fuzzyName) {
      candidates.push({ status: "needsReview", index, row, reasons: ["fuzzyName"] });
    }
  }

  if (!candidates.length) return { status: "newCandidate" };
  const high = candidates.find((x) => x.status === "matchedHigh");
  if (high) return high;
  const medium = candidates.find((x) => x.status === "matchedMedium");
  if (medium) return medium;
  return candidates[0];
}

function main() {
  const awards = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
  const candidates = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
  const draft = JSON.parse(JSON.stringify(awards));

  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      source: candidatesPath,
      target: awardsPath,
      outputDraft: draftPath,
      outputReport: reportPath,
      autoMerge: "Only matchedHigh; michelin_selected is not merged into live awards.",
    },
    summary: {
      total: candidates.restaurants.length,
      matchedHigh: 0,
      matchedMedium: 0,
      needsReview: 0,
      newCandidate: 0,
      conflicts: 0,
      autoMerged: 0,
    },
    matchedHigh: [],
    matchedMedium: [],
    needsReview: [],
    newCandidate: [],
    conflicts: [],
  };

  for (const candidate of candidates.restaurants) {
    const result = classifyCandidate(candidate, draft.restaurants || []);
    const entry = {
      name: candidate.name,
      aliases: candidate.aliases || [],
      city: candidate.city,
      area: candidate.area,
      address: candidate.address,
      phone: candidate.phone,
      cuisine: candidate.cuisine,
      awards: candidate.awards,
      match: result.row ? {
        name: result.row.name,
        aliases: result.row.aliases || [],
        address: result.row.address || "",
        reasons: result.reasons || [],
      } : null,
    };

    if (result.status === "matchedHigh") {
      const target = draft.restaurants[result.index];
      target.aliases = unique([...(target.aliases || []), candidate.name, ...(candidate.aliases || [])]);
      if ((!target.address || target.address.length < 8) && candidate.address) target.address = candidate.address;
      if (!target.phone && candidate.phone) target.phone = candidate.phone;
      if (!target.cuisine && candidate.cuisine) target.cuisine = candidate.cuisine;
      target.source = target.source || candidate.source;
      target.awards = mergeAwards(target.awards, candidate.awards);
      report.summary.autoMerged += 1;
      report.matchedHigh.push(entry);
    } else if (result.status === "matchedMedium") {
      report.matchedMedium.push(entry);
    } else if (result.status === "needsReview") {
      report.needsReview.push(entry);
    } else {
      report.newCandidate.push(entry);
    }
    report.summary[result.status] += 1;
  }

  draft.updated = new Date().toISOString().slice(0, 10);
  draft._sourceNotes = [
    ...(Array.isArray(draft._sourceNotes) ? draft._sourceNotes : []),
    "Draft only: Michelin Taipei 2025 candidate auto-merge output. Review report before replacing live awards-taiwan.json.",
  ];

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath, draftPath, summary: report.summary }, null, 2));
}

main();
