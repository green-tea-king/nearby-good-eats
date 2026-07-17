const assert = require("node:assert/strict");
const { enrichAwardsFromDirectory } = require("./lib/core-awards-enrichment.js");

const awards = { restaurants:[
  { name:"測試店", city:"臺中市", district:"行政區待確認", address:"地址待確認", cuisine:"菜系待確認", awards:[] },
  { name:"測試店（分店）", city:"臺中市", district:"行政區待確認", address:"地址待確認", cuisine:"菜系待確認", awards:[] },
  { name:"地址可解析店", city:"宜蘭縣", district:"行政區待確認", address:"260宜蘭市新民路31號", cuisine:"台灣菜", awards:[] },
  { name:"重名店", city:"台北市", district:"行政區待確認", address:"地址待確認", cuisine:"菜系待確認", awards:[] },
] };
const directory = [
  { name:"測試店", city:"台中市", address:"西區公益路1號", cuisine:"台灣菜", sourceUrl:"https://example.test/source", website:"https://example.test/restaurant/1" },
  { name:"重名店", city:"臺北市", address:"中正區一號", sourceUrl:"https://example.test/a" },
  { name:"重名店", city:"臺北市", address:"大安區二號", sourceUrl:"https://example.test/b" },
];

const result = enrichAwardsFromDirectory(awards, directory, { fetchedAt:"2026-07-14" });
assert.equal(result.report.updatedRows, 2);
assert.equal(result.report.ambiguousRows.length, 1);
assert.equal(result.data.restaurants[0].district, "西區");
assert.equal(result.data.restaurants[0].address, "臺中市西區公益路1號");
assert.equal(result.data.restaurants[0].cuisine, "台灣菜");
assert.equal(result.data.restaurants[1].address, "地址待確認", "branch suffix must not be guessed");
assert.equal(result.data.restaurants[2].district, "宜蘭市");
assert.equal(awards.restaurants[0].address, "地址待確認", "input must not be mutated");

console.log("core awards enrichment tests passed");
