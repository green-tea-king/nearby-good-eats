const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch19-report.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendNote(row, note) {
  const current = String(row.notes || "").trim();
  if (current.includes(note)) return;
  row.notes = current ? `${current} | ${note}` : note;
}

function inferDistrictFromReverseAddress(address) {
  const text = String(address || "").trim();
  if (!text || text === "台北市" || text === "臺北市" || text === "台中市" || text === "臺中市" || text === "台南市" || text === "臺南市" || text === "台東縣" || text === "臺東縣") {
    return "";
  }
  const normalized = text.replace(/，/g, ",");
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (/[區鎮鄉市]$/.test(part) && !/[路街段巷弄號樓F]$/.test(part)) {
      return part;
    }
  }
  const direct = normalized.match(/([^\s,，]+[區鎮鄉市])/g);
  if (direct && direct.length) {
    const found = direct.find((part) => !/[路街段巷弄號樓F]$/.test(part));
    if (found) return found;
  }
  return "";
}

function isCityOnlyDistrict(row) {
  const city = String(row.city || "").trim();
  const district = String(row.district || "").trim();
  const variants = new Set([
    city,
    city.replace(/^臺/, "台"),
    city.replace(/^台/, "臺"),
    city.slice(0, -1),
  ]);
  return variants.has(district);
}

function main() {
  const data = readJson(awardsPath);
  const updatedRows = [];

  for (const row of data.restaurants || []) {
    if (!isCityOnlyDistrict(row)) continue;

    const inferred = inferDistrictFromReverseAddress(row.address);
    if (!inferred) continue;

    const before = {
      district: row.district || "",
      address: row.address || "",
      cuisine: row.cuisine || "",
    };

    row.district = inferred;
    appendNote(row, "Core awards batch19 inferred district from existing address 2026-07-06");

    updatedRows.push({
      name: row.name,
      city: row.city,
      before,
      after: {
        district: row.district || "",
        address: row.address || "",
        cuisine: row.cuisine || "",
      },
    });
  }

  data.updated = "2026-07-06";
  writeJson(awardsPath, data);
  writeJson(reportPath, {
    generatedAt: new Date().toISOString(),
    updatedRows,
    missingRows: [],
  });

  console.log(JSON.stringify({ updatedRows: updatedRows.length, missingRows: 0 }, null, 2));
}

main();
