const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch26-report.json");

const awards = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
const updates = [];

function normalizeNotes(notes) {
  if (!notes) return "";
  return Array.from(
    new Set(
      notes
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ).join(" | ");
}

function appendNote(existing, note) {
  return normalizeNotes(existing ? `${existing} | ${note}` : note);
}

function updateRestaurant(name, patch) {
  const row = awards.restaurants.find((item) => item.name === name);
  if (!row) {
    updates.push({ name, error: "not_found" });
    return;
  }

  const before = {
    district: row.district,
    address: row.address,
    cuisine: row.cuisine,
    notes: row.notes || "",
  };

  Object.assign(row, patch);
  row.notes = normalizeNotes(row.notes || "");

  updates.push({
    name,
    before,
    after: {
      district: row.district,
      address: row.address,
      cuisine: row.cuisine,
      notes: row.notes || "",
    },
  });
}

updateRestaurant("\u6c81\u5712\u6625", {
  district: "\u4e2d\u5340",
  address: "\u53f0\u4e2d\u5e02\u4e2d\u5340\u53f0\u7063\u5927\u9053\u4e00\u6bb5129\u865f",
  cuisine: "\u6c5f\u6d59\u83dc / \u4e0a\u6d77\u83dc",
  notes: appendNote(
    "",
    "Core awards batch26 filled district, address, and cuisine from public article metadata 2026-07-07 https://www.tony60533.com/qinyuanchun/"
  ),
});

fs.writeFileSync(awardsPath, JSON.stringify(awards, null, 2) + "\n", "utf8");
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      updated: updates.length,
      updates,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(JSON.stringify({ updated: updates.length, reportPath }, null, 2));
