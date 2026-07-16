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
    "michelin-selected-taiwan",
    "bib-gourmand-taiwan",
    "500plate",
    "500bowl",
    "500sweet",
  ];
  for (const id of requiredIds) {
    if (!sources.has(id)) errors.push(`missing coverage source: ${id}`);
  }
  if (coverage.policy?.runtimeExternalLookup !== false) errors.push("coverage policy must keep runtimeExternalLookup=false");
  if (coverage.policy?.noFakeData !== true) errors.push("coverage policy must require noFakeData=true");
  if (coverage.summary?.awardsRestaurants !== (awards.restaurants || []).length) errors.push("coverage awardsRestaurants mismatch");
  const expectedSources = [
    ["michelin-guide-taiwan", "michelin"],
    ["michelin-selected-taiwan", "michelin_selected"],
    ["bib-gourmand-taiwan", "bib"],
    ["500plate", "500plate"],
    ["500bowl", "500bowl"],
    ["500sweet", "500sweet"],
  ];
  for (const [sourceId, guide] of expectedSources) {
    const source = sources.get(sourceId) || {};
    if (source.awardCount !== (guides[guide] || 0)) errors.push(`${sourceId} awardCount mismatch`);
    if (source.status !== "integrated_data") errors.push(`${sourceId} must be integrated_data`);
    if (source.runtimeLookup !== false) errors.push(`${sourceId} must disable runtimeLookup`);
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
