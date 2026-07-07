const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const awardsPath = path.join(root, "assets", "awards-taiwan.json");
const reportPath = path.join(root, "assets", "core-awards-enrichment-batch28-report.json");

const awardsDb = JSON.parse(fs.readFileSync(awardsPath, "utf8"));

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing} | ${note}`;
}

const restaurant = awardsDb.restaurants.find((row) =>
  String(row.name || "").includes("Robuchon Taipei")
);

if (!restaurant) {
  throw new Error("Required Robuchon Taipei row not found for batch28");
}

restaurant.city = "臺北市";
restaurant.district = "信義區";
restaurant.address = "臺北市信義區松仁路28號5樓";
restaurant.cuisine = restaurant.cuisine || "French";

restaurant.notes = appendNote(
  restaurant.notes,
  "Core awards batch28 filled address from Bellavita public location page and cuisine/location context from L'Atelier de Joel Robuchon public listing 2026-07-07 https://en.wikipedia.org/wiki/Bellavita ; https://en.wikipedia.org/wiki/L%27Atelier_de_Jo%C3%ABl_Robuchon"
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
      address: restaurant.address
    },
    null,
    2
  )
);
