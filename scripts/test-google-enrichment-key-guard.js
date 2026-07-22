const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const scripts = [
  "scripts/enrich-core-awards-with-google-places.js",
  "scripts/enrich-core-awards-targeted-google.js",
];

for (const relativePath of scripts) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.doesNotMatch(
    source,
    /assets["'],\s*["']app-settings\.js|settingsPath|googleMapsApiKey/,
    `${relativePath} must not read the public browser Google Maps key from assets/app-settings.js`,
  );
  assert.match(
    source,
    /GOOGLE_MAPS_SERVER_API_KEY/,
    `${relativePath} must require GOOGLE_MAPS_SERVER_API_KEY for batch Google enrichment`,
  );
}

console.log("google enrichment key guard tests passed");
