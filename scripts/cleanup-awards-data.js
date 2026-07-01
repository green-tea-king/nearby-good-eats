const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&+]/g, "")
    .toLowerCase();
}

function main() {
  const data = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
  let selfAliases = 0;
  let duplicateAliases = 0;

  for (const row of data.restaurants || []) {
    const nameKey = normalizeName(row.name);
    const seen = new Set();
    const aliases = [];
    for (const alias of row.aliases || []) {
      const key = normalizeName(alias);
      if (!key) continue;
      if (key === nameKey) {
        selfAliases += 1;
        continue;
      }
      if (seen.has(key)) {
        duplicateAliases += 1;
        continue;
      }
      seen.add(key);
      aliases.push(alias);
    }
    row.aliases = aliases;
  }

  fs.writeFileSync(awardsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ selfAliases, duplicateAliases }, null, 2));
}

main();
