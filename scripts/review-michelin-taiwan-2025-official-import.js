const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const candidatesPath = path.join(repoRoot, "assets", "michelin-taiwan-2025-official-candidates.json");
const reportPath = path.join(repoRoot, "assets", "michelin-taiwan-2025-official-import-report.json");
const draftPath = path.join(repoRoot, "assets", "awards-taiwan.michelin-taiwan-2025-official-draft.json");

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/臺/g, "台")
    .replace(/[’‘`´]/g, "'")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×\s]/g, "")
    .toLowerCase();
}

function namesOf(row) {
  return [row.name, ...(row.aliases || [])].filter(Boolean);
}

function awardKey(award) {
  return [award.guide, award.level || "", award.year || "", award.plates || ""].join("|");
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

function cleanAliases(name, aliases) {
  const nameKey = normalizeName(name);
  return unique(aliases).filter((alias) => {
    const aliasKey = normalizeName(alias);
    return aliasKey && aliasKey !== nameKey;
  });
}

function classify(candidate, existing) {
  const city = candidate.city || "";
  const candidateNames = namesOf(candidate).map(normalizeName).filter(Boolean);
  const hits = [];
  for (let index = 0; index < existing.length; index += 1) {
    const row = existing[index];
    if ((row.city || "") !== city) continue;
    const rowNames = namesOf(row).map(normalizeName).filter(Boolean);
    const exact = candidateNames.some((name) => rowNames.includes(name));
    const fuzzy = candidateNames.some((name) =>
      rowNames.some((other) => name.length >= 3 && other.length >= 3 && (name.includes(other) || other.includes(name)))
    );
    if (exact) hits.push({ status: "matchedHigh", index, row, reasons: ["city", "exactName"] });
    else if (fuzzy) hits.push({ status: "matchedMedium", index, row, reasons: ["city", "fuzzyName"] });
  }
  hits.sort((a, b) => {
    const aMichelin = (a.row.awards || []).some((award) => award.guide === "michelin") ? 1 : 0;
    const bMichelin = (b.row.awards || []).some((award) => award.guide === "michelin") ? 1 : 0;
    if (a.status !== b.status) return a.status === "matchedHigh" ? -1 : 1;
    return bMichelin - aMichelin;
  });
  return hits[0] || { status: "newCandidate" };
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
      autoMerge: "matchedHigh only; michelin_selected is kept in report but not merged into live awards.",
    },
    summary: {
      total: candidates.restaurants.length,
      matchedHigh: 0,
      matchedMedium: 0,
      newCandidate: 0,
      autoMerged: 0,
      autoAdded: 0,
      skippedSelectedOnly: 0,
    },
    matchedHigh: [],
    matchedMedium: [],
    newCandidate: [],
  };

  for (const candidate of candidates.restaurants) {
    const onlySelected = (candidate.awards || []).every((award) => award.guide === "michelin_selected");
    const result = classify(candidate, draft.restaurants || []);
    const entry = {
      name: candidate.name,
      city: candidate.city,
      aliases: cleanAliases(candidate.name, candidate.aliases),
      awards: candidate.awards,
      match: result.row ? { name: result.row.name, city: result.row.city, reasons: result.reasons || [] } : null,
    };

    if (onlySelected) report.summary.skippedSelectedOnly += 1;

    if (result.status === "matchedHigh") {
      const target = draft.restaurants[result.index];
      target.aliases = cleanAliases(target.name, [
        ...(target.aliases || []),
        candidate.name,
        ...(candidate.aliases || []),
      ]);
      target.source = target.source || candidate.source;
      target.awards = mergeAwards(target.awards, candidate.awards);
      if (!onlySelected) report.summary.autoMerged += 1;
      report.matchedHigh.push(entry);
    } else if (result.status === "matchedMedium") {
      report.matchedMedium.push(entry);
    } else {
      if (!onlySelected) {
        draft.restaurants.push({
          name: candidate.name,
          aliases: cleanAliases(candidate.name, candidate.aliases),
          city: candidate.city,
          address: candidate.address || "",
          source: candidate.source,
          awards: mergeAwards([], candidate.awards),
        });
        report.summary.autoAdded += 1;
      }
      report.newCandidate.push(entry);
    }
    report.summary[result.status] += 1;
  }

  draft.updated = new Date().toISOString().slice(0, 10);
  draft._sourceNotes = [
    ...(Array.isArray(draft._sourceNotes) ? draft._sourceNotes : []),
    "Draft only: official Michelin Taiwan 2025 candidate import. Review before replacing live awards-taiwan.json.",
  ];

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath, draftPath, summary: report.summary }, null, 2));
}

main();
