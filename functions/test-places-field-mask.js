"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const deprecated = [
  "hasDineIn", "hasTakeout", "hasDelivery", "hasCurbsidePickup",
  "isReservable", "hasOutdoorSeating", "hasLiveMusic",
  "isGoodForChildren", "isGoodForGroups", "hasMenuForChildren", "hasRestroom",
];

deprecated.forEach(field => {
  assert.equal(source.includes(`\"places.${field}\"`), false, `search field mask still uses ${field}`);
  assert.equal(source.includes(`\"${field}\",`), false, `detail field mask still uses ${field}`);
});

console.log("Places field mask tests passed");
