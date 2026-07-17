const assert = require("node:assert/strict");
const {
  buildVertexRequest,
  parseVertexResponse,
} = require("./ai-classifier.js");

const payload = {
  filters: [{ key:"service", value:"吃到飽", tier:"search" }],
  items: Array.from({ length:10 }, (_, index) => ({
    id:`p${index}`,
    name:index === 0 ? "測試自助餐" : `餐廳 ${index}`,
    reviewSummary:"吃到飽 buffet ".repeat(100),
    googleFlags:{ goodGroups:true },
  })),
};

const request = buildVertexRequest(payload);
const prompt = request.contents[0].parts[0].text;
assert.equal((JSON.parse(prompt.match(/INPUT_JSON:\n([\s\S]+)$/)[1])).items.length, 8);
assert.equal(request.generationConfig.responseMimeType, "application/json");

const response = {
  candidates:[{ content:{ parts:[{ text:JSON.stringify({ items:[
    {
      id:"p0",
      tags:{ service:["吃到飽", "不存在標籤"], occasion:["聚餐"] },
      confidence:{ service:1.5, occasion:0.8 },
      reason:"評論摘要與店名明確提及自助餐。",
      sources:{ service:[{ field:"reviewSummary", label:"評論摘要", evidence:"吃到飽 buffet" }] },
    },
    { id:"hallucinated", tags:{ service:["吃到飽"] }, confidence:{ service:0.9 }, reason:"", sources:{} },
  ]}) }] } }],
};

const parsed = parseVertexResponse(response, new Set(["p0", "p1"]));
assert.equal(parsed.length, 1);
assert.deepEqual(parsed[0].tags.service, ["吃到飽"]);
assert.equal(parsed[0].confidence.service, 1);
assert.equal(parsed[0].sources.service[0].label, "評論摘要");

console.log("AI classifier tests passed");
