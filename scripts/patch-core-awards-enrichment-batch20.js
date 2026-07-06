const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch20-report.json");

const awards = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
const updates = [];

function appendNote(existing, note) {
  return existing ? `${existing} | ${note}` : note;
}

function updateRestaurant(name, mutator) {
  const row = awards.restaurants.find((item) => item.name === name);
  if (!row) {
    return;
  }
  const before = {
    aliases: Array.isArray(row.aliases) ? [...row.aliases] : [],
    district: row.district,
    address: row.address,
    cuisine: row.cuisine,
    notes: row.notes || "",
  };
  mutator(row);
  updates.push({
    name,
    before,
    after: {
      aliases: Array.isArray(row.aliases) ? [...row.aliases] : [],
      district: row.district,
      address: row.address,
      cuisine: row.cuisine,
      notes: row.notes || "",
    },
  });
}

updateRestaurant("Adachi 足立壽司", (row) => {
  row.aliases = Array.from(new Set([...(row.aliases || []), "Adachi"]));
  row.district = "信義區";
  row.address = "台北市信義區莊敬路239巷12號";
  row.cuisine = "壽司 / 無菜單料理";
  row.notes = appendNote(
    row.notes || "",
    "Core awards batch20 enriched from 50 Best Discovery public page 2026-07-06 https://www.theworlds50best.com/discovery/Establishments/Taiwan/Taipei/Adachi.html"
  );
});

updateRestaurant("秦味館 Qin Wei Guan", (row) => {
  if (row.district === "行政區待確認") {
    row.district = "大安區";
  }
  if (row.address === "地址待確認") {
    row.address = "台北市大安區";
  }
  row.notes = appendNote(
    row.notes || "",
    "Core awards batch20 aligned alias row with sibling restaurant entry 秦味館 2026-07-06"
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
