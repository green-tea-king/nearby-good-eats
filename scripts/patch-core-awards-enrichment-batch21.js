const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch21-report.json");

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

function updateRestaurant(name, mutator) {
  const row = awards.restaurants.find((item) => item.name === name);
  if (!row) return;
  const before = {
    district: row.district,
    address: row.address,
    cuisine: row.cuisine,
    notes: row.notes || "",
  };
  mutator(row);
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

for (const row of awards.restaurants) {
  row.notes = normalizeNotes(row.notes || "");
}

updateRestaurant("國賓中餐廳", (row) => {
  row.address = "台北市中山區遼寧街177號2樓";
  row.cuisine = "粵菜 / 川菜";
  row.notes = appendNote(
    row.notes || "",
    "Core awards batch21 updated current dining address and cuisine from Ambassador Taipei dining page 2026-07-06 https://www.ambassador-hotels.com/tc/taipei/dining"
  );
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
