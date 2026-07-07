const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const awardsPath = path.join(root, "assets", "awards-taiwan.json");
const reportPath = path.join(root, "assets", "core-awards-enrichment-batch29-report.json");

const awardsDb = JSON.parse(fs.readFileSync(awardsPath, "utf8"));

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing} | ${note}`;
}

const restaurant = awardsDb.restaurants.find((row) =>
  String(row.name || "").includes("LA BOUTIQUE de Jo")
);

if (!restaurant) {
  throw new Error("Required LA BOUTIQUE de Joel Robuchon row not found for batch29");
}

restaurant.city = "臺北市";
restaurant.district = "信義區";
restaurant.address = "臺北市信義區松仁路28號";
restaurant.cuisine = "法式甜點";

restaurant.notes = appendNote(
  restaurant.notes,
  "Core awards batch29 filled Bellavita building address and cuisine from public naming context 2026-07-07 https://en.wikipedia.org/wiki/Bellavita ; inferred as Bellavita Taipei branch from brand co-location context, floor not asserted"
);

const report = {
  generatedAt: new Date().toISOString(),
  rows: [
    {
      name: restaurant.name,
      city: restaurant.city,
      district: restaurant.district,
      address: restaurant.address,
      cuisine: restaurant.cuisine,
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
      city: restaurant.city,
      district: restaurant.district,
      address: restaurant.address,
      cuisine: restaurant.cuisine
    },
    null,
    2
  )
);
