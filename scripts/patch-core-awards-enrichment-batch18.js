const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const reportPath = path.join(repoRoot, "assets", "core-awards-enrichment-batch18-report.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeDistrictByCity(district, city) {
  const d = String(district || "").trim();
  const c = String(city || "").trim();
  if (!d) return d;
  if (c) {
    const cityVariants = Array.from(
      new Set([c, c.replace(/^臺/, "台"), c.replace(/^台/, "臺")].filter(Boolean))
    );
    for (const variant of cityVariants) {
      if (!d.startsWith(variant)) continue;
      const stripped = d.slice(variant.length).trim();
      if (/[區鎮鄉市]$/.test(stripped)) return stripped;
    }
  }
  if (/^[台臺][北中南東]市.+區$/.test(d)) {
    const match = d.match(/([^\d\s]+區)$/);
    if (match) return match[1];
  }
  if (/^[^ ]+[縣市].+[鎮鄉市區]$/.test(d)) {
    const match = d.match(/([^\d\s]+[鎮鄉市區])$/);
    if (match) return match[1];
  }
  return d;
}

function inferDistrictFromAddress(address, city) {
  const a = String(address || "").trim();
  const c = String(city || "").trim();
  if (!a || !c || !a.startsWith(c)) return "";
  const rest = a.slice(c.length);
  const match = rest.match(/^([^路街段巷弄號樓F, ]+[區鎮鄉市])/);
  return match ? match[1] : "";
}

function appendNote(row, note) {
  const current = String(row.notes || "").trim();
  if (current.includes(note)) return;
  row.notes = current ? `${current} | ${note}` : note;
}

function main() {
  const data = readJson(awardsPath);
  const updatedRows = [];

  for (const row of data.restaurants || []) {
    const before = {
      district: row.district || "",
      address: row.address || "",
      cuisine: row.cuisine || "",
    };

    let changed = false;

    const normalizedDistrict = normalizeDistrictByCity(row.district, row.city);
    if (normalizedDistrict && normalizedDistrict !== row.district) {
      row.district = normalizedDistrict;
      changed = true;
    }

    if (row.district === "行政區待確認") {
      const inferred = inferDistrictFromAddress(row.address, row.city);
      if (inferred) {
        row.district = inferred;
        changed = true;
      }
    }

    if (row.name === "COAST" && row.city === "臺北市" && row.district === "行政區待確認") {
      row.district = "中山區";
      changed = true;
    }

    if (changed) {
      appendNote(row, "Core awards batch18 normalized district format 2026-07-06");
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
