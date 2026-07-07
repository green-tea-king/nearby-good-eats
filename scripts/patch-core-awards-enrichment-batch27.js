const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const awardsPath = path.join(root, "assets", "awards-taiwan.json");
const candidatesPath = path.join(root, "assets", "michelin-taipei-2025-candidates.json");
const reportPath = path.join(root, "assets", "core-awards-enrichment-batch27-report.json");

const awardsDb = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
const candidatesDb = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing} | ${note}`;
}

const restaurant = awardsDb.restaurants.find((row) => String(row.name || "").includes("85TD"));
const candidate = (candidatesDb.restaurants || []).find((row) => String(row.name || "").includes("85TD"));

if (!restaurant || !candidate) {
  throw new Error("Required 85TD row not found for batch27");
}

restaurant.cuisine = candidate.cuisine || restaurant.cuisine || "粵菜";

const selectedAward = {
  guide: "michelin_selected",
  level: "入選餐廳",
  year: 2025,
  url: candidate.source,
  sourceName: "MICHELIN Guide Taiwan 2025 Full List",
  sourceUrl: candidate.source,
  extractedDate: "2026-07-07",
  awardName: "米其林入選",
  notes: "Core awards batch27 merged Michelin Taipei 2025 candidate cuisine and selected award 2026-07-07",
  award: "米其林入選",
  extractedAt: "2026-07-07"
};

if (
  !restaurant.awards.some(
    (award) => award.guide === "michelin_selected" && String(award.year) === "2025"
  )
) {
  restaurant.awards.push(selectedAward);
}

restaurant.notes = appendNote(
  restaurant.notes,
  "Core awards batch27 merged Michelin Taipei 2025 candidate cuisine 粵菜 and Michelin Selected 2025 2026-07-07 https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/taiwan-full-list"
);

const report = {
  generatedAt: new Date().toISOString(),
  rows: [
    {
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      awards: restaurant.awards.filter(
        (award) => award.guide === "500sweet" || award.guide === "michelin_selected"
      ),
      notes: restaurant.notes
    }
  ]
};

fs.writeFileSync(awardsPath, `${JSON.stringify(awardsDb, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      updated: restaurant.name,
      cuisine: restaurant.cuisine,
      awardCount: restaurant.awards.length
    },
    null,
    2
  )
);
