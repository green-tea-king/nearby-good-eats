const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch25-report.json");

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

function updateRestaurantByPrefix(prefix, patch) {
  const row = awards.restaurants.find((item) => typeof item.name === "string" && item.name.startsWith(prefix));
  if (!row) {
    updates.push({ prefix, error: "not_found" });
    return;
  }

  const before = {
    name: row.name,
    district: row.district,
    address: row.address,
    cuisine: row.cuisine,
    notes: row.notes || "",
  };

  Object.assign(row, patch);
  row.notes = normalizeNotes(row.notes || "");

  updates.push({
    prefix,
    before,
    after: {
      name: row.name,
      district: row.district,
      address: row.address,
      cuisine: row.cuisine,
      notes: row.notes || "",
    },
  });
}

updateRestaurantByPrefix("Mark's Teppanyaki", {
  district: "\u4e2d\u5c71\u5340",
  address: "\u53f0\u5317\u5e02\u4e2d\u5c71\u5340\u6a02\u7fa4\u4e8c\u8def199\u865f",
  cuisine: "\u9435\u677f\u71d2 / \u65e5\u4e2d\u897f\u878d\u5408\u6599\u7406",
  notes: appendNote(
    "",
    "Core awards batch25 filled hotel restaurant address and cuisine from Taipei Marriott public pages / Wikipedia summary 2026-07-07 https://en.wikipedia.org/wiki/Marriott_Taipei ; https://zh.wikipedia.org/wiki/%E8%90%AC%E8%B1%AA%E9%85%92%E5%BA%97"
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
