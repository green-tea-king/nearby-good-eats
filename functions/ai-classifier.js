const MAX_ITEMS = 8;
const MAX_TEXT = 600;
const TAGS = {
  occasion:new Set(["聚餐", "獨享"]),
  service:new Set(["單點", "吃到飽"]),
  meal:new Set(["早餐", "早茶", "午餐", "午茶", "晚餐", "消夜"]),
  diet:new Set(["葷食", "素食"]),
  cuisine:new Set(["中式", "西式", "台灣菜", "日本菜", "韓式", "火鍋", "麵食", "燒烤", "小吃", "海鮮", "素食", "甜點"]),
  style:new Set(["傳統", "現代"]),
};

function clipped(value, limit = MAX_TEXT) {
  return String(value || "").trim().slice(0, limit);
}

function safeInput(payload = {}) {
  return {
    filters:(payload.filters || []).slice(0, 8).map(filter => ({
      key:clipped(filter.key, 30),
      value:clipped(filter.value, 60),
    })),
    items:(payload.items || []).slice(0, MAX_ITEMS).map(item => ({
      id:clipped(item.id, 160),
      name:clipped(item.name, 160),
      type:clipped(item.type, 100),
      address:clipped(item.address, 240),
      reviewSummary:clipped(item.reviewSummary),
      editorialSummary:clipped(item.editorialSummary),
      generativeSummary:clipped(item.generativeSummary),
      googleFlags:item.googleFlags && typeof item.googleFlags === "object" ? item.googleFlags : {},
    })).filter(item => item.id && item.name),
  };
}

function buildVertexRequest(payload = {}) {
  const input = safeInput(payload);
  const instructions = [
    "你是台灣餐廳資料分類器，只能依 INPUT_JSON 內的店名、Google 類型、地址、Google flags、評論摘要與 Google 摘要判斷。",
    "不得補寫網路資訊，不得猜測。證據不足時該分類回傳空陣列，信心分數不得高於 0.55。",
    "每個輸入 id 都回傳一筆。tags 只能使用下列值：",
    "occasion: 聚餐,獨享；service: 單點,吃到飽；meal: 早餐,早茶,午餐,午茶,晚餐,消夜；",
    "diet: 葷食,素食；cuisine: 中式,西式,台灣菜,日本菜,韓式,火鍋,麵食,燒烤,小吃,海鮮,素食,甜點；style: 傳統,現代。",
    "sources 依分類鍵回傳證據陣列，每筆含 field、label、evidence；reason 用繁體中文簡短說明，必須指出依據。",
    "只輸出 JSON：{\"items\":[{\"id\":\"...\",\"tags\":{},\"confidence\":{},\"reason\":\"...\",\"sources\":{}}]}。",
    `INPUT_JSON:\n${JSON.stringify(input)}`,
  ].join("\n");
  return {
    contents:[{ role:"user", parts:[{ text:instructions }] }],
    generationConfig:{
      temperature:0,
      maxOutputTokens:2048,
      responseMimeType:"application/json",
    },
  };
}

function normalizeSources(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const key of Object.keys(TAGS)) {
    if (!Array.isArray(value[key])) continue;
    out[key] = value[key].slice(0, 4).map(source => ({
      field:clipped(source?.field, 80),
      label:clipped(source?.label, 80),
      evidence:clipped(source?.evidence, 180),
    })).filter(source => source.field && source.label && source.evidence);
  }
  return out;
}

function parseVertexResponse(response, allowedIds = new Set()) {
  const text = response?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
  if (!text) throw new Error("Vertex AI returned no text");
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  } catch (_) {
    throw new Error("Vertex AI returned invalid JSON");
  }
  return (parsed.items || []).filter(item => allowedIds.has(String(item?.id || ""))).map(item => {
    const tags = {};
    const confidence = {};
    for (const [key, allowed] of Object.entries(TAGS)) {
      const values = Array.isArray(item.tags?.[key]) ? item.tags[key] : [];
      tags[key] = [...new Set(values.map(String).filter(value => allowed.has(value)))];
      if (Number.isFinite(Number(item.confidence?.[key]))) {
        confidence[key] = Math.max(0, Math.min(1, Number(item.confidence[key])));
      }
    }
    return {
      id:String(item.id),
      tags,
      confidence,
      reason:clipped(item.reason, 360),
      sources:normalizeSources(item.sources),
    };
  });
}

module.exports = { MAX_ITEMS, buildVertexRequest, parseVertexResponse };
