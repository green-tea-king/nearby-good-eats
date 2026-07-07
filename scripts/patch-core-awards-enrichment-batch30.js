const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const awardsPath = path.join(root, "assets", "awards-taiwan.json");
const reportPath = path.join(root, "assets", "core-awards-enrichment-batch30-report.json");

const awardsDb = JSON.parse(fs.readFileSync(awardsPath, "utf8"));

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing} | ${note}`;
}

const restaurant = awardsDb.restaurants.find((row) => row.name === "Solo Pasta");

if (!restaurant) {
  throw new Error("Required Solo Pasta row not found for batch30");
}

restaurant.cuisine = "義式料理 / 義大利麵";
restaurant.notes = appendNote(
  restaurant.notes,
  "Core awards batch30 filled cuisine from public article metadata 2026-07-07 https://icecreamcat.tw/solo-pasta/"
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
      notes: restaurant.notes,
    },
  ],
};

fs.writeFileSync(awardsPath, `${JSON.stringify(awardsDb, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      updated: restaurant.name,
      cuisine: restaurant.cuisine,
    },
    null,
    2
  )
);
