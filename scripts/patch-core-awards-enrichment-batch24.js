const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch24-report.json");

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

updateRestaurant("BELLINI Pasta Pasta", (row) => {
  row.cuisine = "義式料理 / 義大利麵 / 披薩";
  row.notes = appendNote(
    row.notes || "",
    "Core awards batch24 filled cuisine from BELLINI Pasta Pasta official site 2026-07-07 https://www.bellinipasta.com.tw/ ; Taipei branch address remains pending because official site lists multiple Taipei locations."
  );
});

updateRestaurant("帕泰家 Baan Phadthai", (row) => {
  row.cuisine = "泰式料理";
  row.notes = appendNote(
    row.notes || "",
    "Core awards batch24 filled cuisine from Baan Phadthai official site 2026-07-07 https://www.baanphadthai.com.tw/Store.html ; Taipei branch address remains pending because the public page confirms cuisine but does not expose a clear single branch address in static content."
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
