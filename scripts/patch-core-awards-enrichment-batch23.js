const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch23-report.json");

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
  if (!row) return;
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

updateRestaurant("兄弟飯店 蘭花廳", {
  district: "松山區",
  address: "台北市松山區南京東路三段255號",
  cuisine: "台菜 / 海鮮",
  notes: appendNote(
    "",
    "Core awards batch23 filled hotel restaurant address and cuisine from Brother Hotel official dining page 2026-07-07 https://www.brotherhotel.com.tw/"
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
