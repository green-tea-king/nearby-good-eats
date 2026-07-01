const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const coveragePath = path.join(repoRoot, "assets", "external-source-coverage.json");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function countGuides(awards) {
  const guides = {};
  for (const row of awards.restaurants || []) {
    for (const award of row.awards || []) guides[award.guide] = (guides[award.guide] || 0) + 1;
  }
  return guides;
}

function main() {
  const coverage = readJson(coveragePath);
  const awards = readJson(awardsPath);
  const guides = countGuides(awards);
  const errors = [];
  const sources = new Map((coverage.sources || []).map((source) => [source.id, source]));
  const requiredIds = [
    "michelin-guide-taiwan",
    "500plate",
    "500bowl",
    "500sweet",
    "50best",
    "50bestdiscovery",
    "oad",
    "thebestchef",
    "designawards",
    "fmg",
    "greenveggie",
    "gdgawards",
    "michelinspecial",
    "tcfpraise",
    "tatlerbest",
    "worldculinary",
    "google-maps-reviews",
    "ifoodie",
    "openrice-tw",
    "tripadvisor-tw",
  ];
  for (const id of requiredIds) {
    if (!sources.has(id)) errors.push(`missing coverage source: ${id}`);
  }
  if (coverage.policy?.runtimeExternalLookup !== false) errors.push("coverage policy must keep runtimeExternalLookup=false");
  if (coverage.policy?.noFakeData !== true) errors.push("coverage policy must require noFakeData=true");
  if (coverage.summary?.awardsRestaurants !== (awards.restaurants || []).length) errors.push("coverage awardsRestaurants mismatch");
  const michelin = sources.get("michelin-guide-taiwan") || {};
  if (michelin.counts?.stars !== (guides.michelin || 0)) errors.push("michelin star count mismatch");
  if (michelin.counts?.selected !== (guides.michelin_selected || 0)) errors.push("michelin selected count mismatch");
  if (michelin.counts?.bib !== (guides.bib || 0)) errors.push("bib count mismatch");
  if (michelin.counts?.greenstar !== (guides.greenstar || 0)) errors.push("greenstar count mismatch");
  for (const guide of ["500plate", "500bowl", "500sweet", "50best", "50bestdiscovery", "oad", "thebestchef", "designawards", "fmg", "greenveggie", "gdgawards", "michelinspecial", "tatlerbest", "worldculinary"]) {
    const source = sources.get(guide) || {};
    if (source.count !== (guides[guide] || 0)) errors.push(`${guide} count mismatch`);
    if (source.status !== "integrated_data") errors.push(`${guide} must be integrated_data`);
    if (source.runtimeLookup !== false) errors.push(`${guide} must disable runtimeLookup`);
  }
  const tcf = sources.get("tcfpraise") || {};
  if (tcf.runtimeLookup !== false) errors.push("tcfpraise must disable runtimeLookup");
  if (!["integrated_data", "candidate_needs_city_review"].includes(tcf.status)) errors.push(`tcfpraise invalid status ${tcf.status}`);
  if (tcf.status === "candidate_needs_city_review" && Number(tcf.needsCityReview || 0) <= 0) errors.push("tcfpraise needsCityReview status requires rows");
  const google = sources.get("google-maps-reviews") || {};
  if (google.status !== "runtime_primary_with_noise_guard") errors.push("google reviews status mismatch");
  for (const key of ["bayesianScore", "reviewCountBonus", "reviewNoiseHints", "promoTextPenalty", "noFullReviewStorage"]) {
    if (google.safeguards?.[key] !== true) errors.push(`google safeguard missing: ${key}`);
  }
  for (const id of ["ifoodie", "openrice-tw", "tripadvisor-tw"]) {
    const source = sources.get(id) || {};
    if (source.runtimeLookup !== false) errors.push(`${id} must disable runtimeLookup`);
    if (!source.sourceCatalogPresent) errors.push(`${id} missing sourceCatalogPresent`);
    if (!["batch_pipeline_ready_no_data", "manual_data_available"].includes(source.status)) errors.push(`${id} invalid status ${source.status}`);
    if (source.status === "manual_data_available") {
      if (Number(source.currentManualRows || 0) <= 0) errors.push(`${id} manual data status requires currentManualRows > 0`);
      if (Number(source.currentManualSignals || 0) <= 0) errors.push(`${id} manual data status requires currentManualSignals > 0`);
    }
  }
  const report = {
    ok: errors.length === 0,
    sources: sources.size,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
}

main();
