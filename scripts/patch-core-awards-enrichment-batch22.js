const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch22-report.json");

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

updateRestaurant("台北喜來登大飯店 SUKHOTHAI 泰式餐廳", {
  district: "中正區",
  address: "台北市中正區忠孝東路一段12號",
  cuisine: "泰式料理",
  notes: appendNote(
    "",
    "Core awards batch22 filled hotel restaurant address and cuisine from Sheraton Grand Taipei public page / Wikipedia summary 2026-07-06 https://en.wikipedia.org/wiki/Sheraton_Grand_Taipei_Hotel"
  ),
});

updateRestaurant("台北美福大飯店 潮粵坊港潮餐廳", {
  district: "中山區",
  address: "台北市中山區樂群二路55號",
  cuisine: "粵菜 / 潮州菜 / 點心",
  notes: appendNote(
    "",
    "Core awards batch22 filled hotel restaurant address and cuisine from Grand Mayfull public page / Wikipedia summary 2026-07-06 https://en.wikipedia.org/wiki/Grand_Mayfull_Hotel_Taipei"
  ),
});

updateRestaurant("台北晶華酒店 上庭酒廊", {
  district: "中山區",
  address: "台北市中山區中山北路二段39巷3號2樓",
  cuisine: "酒廊 / 調酒 / 輕食",
  notes: appendNote(
    "",
    "Core awards batch22 filled hotel lounge address and offering type from Regent Taipei public page / Wikipedia summary 2026-07-06 https://zh.wikipedia.org/wiki/%E5%8F%B0%E5%8C%97%E6%99%B6%E8%8F%AF%E9%85%92%E5%BA%97"
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
