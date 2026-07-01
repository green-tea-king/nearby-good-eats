const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const csvPath = path.join(repoRoot, "assets", "platform-signals.import.csv");
const manualSignalsPath = path.join(repoRoot, "assets", "platform-signals.manual.json");

const REQUIRED_HEADERS = [
  "name",
  "city",
  "area",
  "aliases",
  "type",
  "sourceId",
  "label",
  "score",
  "confidence",
  "rating",
  "reviewCount",
  "rank",
  "evidence",
  "url",
  "updated",
  "reviewedBy",
];
const ALLOWED_SOURCE_IDS = new Set(["ifoodie", "openrice-tw", "tripadvisor-tw"]);
const ALLOWED_TYPES = new Set(["platformRating", "platformCertification", "mediaMention", "socialBuzz", "queueSignal"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (ch === "\"") {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((items) => items.some((value) => String(value || "").trim()));
}

function splitList(value) {
  return String(value || "")
    .split(/[|；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value) {
  if (value === "" || value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function validateHeaders(headers) {
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`CSV missing headers: ${missing.join(", ")}`);
}

function rowToSignal(row, index) {
  const errors = [];
  if (!row.name) errors.push(`row ${index} missing name`);
  if (!row.city) errors.push(`row ${index} missing city`);
  if (!ALLOWED_TYPES.has(row.type)) errors.push(`row ${index} invalid type: ${row.type}`);
  if (!ALLOWED_SOURCE_IDS.has(row.sourceId)) errors.push(`row ${index} invalid sourceId: ${row.sourceId}`);
  if (!ALLOWED_CONFIDENCE.has(row.confidence)) errors.push(`row ${index} invalid confidence: ${row.confidence}`);
  const score = toNumber(row.score);
  if (score == null || score < 0 || score > 100) errors.push(`row ${index} score must be 0-100`);
  if (!row.url) errors.push(`row ${index} missing url`);
  if (!row.updated) errors.push(`row ${index} missing updated`);
  if (!row.reviewedBy) errors.push(`row ${index} missing reviewedBy`);
  if (errors.length) return { errors };

  const metrics = {};
  const rating = toNumber(row.rating);
  const reviewCount = toNumber(row.reviewCount);
  const rank = toNumber(row.rank);
  if (rating != null) metrics.rating = rating;
  if (reviewCount != null) metrics.reviewCount = reviewCount;
  if (rank != null) metrics.rank = rank;

  return {
    signal: {
      type: row.type,
      sourceId: row.sourceId,
      label: row.label || "平台口碑",
      score,
      confidence: row.confidence,
      ...(Object.keys(metrics).length ? { metrics } : {}),
      evidence: splitList(row.evidence),
      url: row.url,
      updated: row.updated,
      reviewedBy: row.reviewedBy,
    },
  };
}

function restaurantKey(row) {
  return `${row.city}|${row.name}`;
}

function buildManual(rows) {
  const byRestaurant = new Map();
  const errors = [];
  rows.forEach((row, index) => {
    const result = rowToSignal(row, index + 2);
    if (result.errors) {
      errors.push(...result.errors);
      return;
    }
    const key = restaurantKey(row);
    if (!byRestaurant.has(key)) {
      byRestaurant.set(key, {
        name: row.name,
        city: row.city,
        area: row.area || "",
        aliases: splitList(row.aliases),
        signals: [],
      });
    }
    byRestaurant.get(key).signals.push(result.signal);
  });
  if (errors.length) {
    const err = new Error("CSV validation failed");
    err.errors = errors;
    throw err;
  }
  return {
    version: "manual-platform-2026-07-01",
    updated: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    description: "人工或 AI 整理後的平台訊號入口。由 assets/platform-signals.import.csv 批次轉換；只接受可追溯來源，不在使用者搜尋時即時查外部網站。",
    policy: {
      runtimeExternalLookup: false,
      batchOnly: true,
      allowedSources: [...ALLOWED_SOURCE_IDS],
      notes: [
        "每筆資料必須有 sourceId、url、updated、confidence、reviewedBy。",
        "平台資料只做輔助訊號，不取代 Google 評分與評論數。",
        "沒有授權 API 或可追溯公開來源時，先保留空資料，不要寫假資料。",
      ],
    },
    restaurants: [...byRestaurant.values()].sort((a, b) => `${a.city}${a.name}`.localeCompare(`${b.city}${b.name}`, "zh-Hant")),
    schema: {
      "restaurants[]": {
        name: "餐廳名稱，需與 Google 店名或 awards-taiwan aliases 可比對。",
        city: "縣市，例如 台北市。",
        area: "行政區，可空白。",
        aliases: ["可選，其他常見名稱；CSV 用 | 或 ; 分隔。"],
        signals: [
          {
            type: "platformRating",
            sourceId: "ifoodie | openrice-tw | tripadvisor-tw",
            label: "平台口碑",
            score: "0-100，只作輔助加分。",
            confidence: "high | medium | low",
            metrics: {
              rating: "平台評分，可選。",
              reviewCount: "平台評論數，可選。",
              rank: "平台榜單名次，可選。",
            },
            evidence: ["一到三句可追溯摘要，不要貼整篇文章。"],
            url: "來源頁 URL，必填。",
            updated: "YYYY-MM-DD",
            reviewedBy: "人工審核者或資料整理流程名稱",
          },
        ],
      },
    },
  };
}

function main() {
  const csv = readCsv(csvPath);
  const headers = csv[0] || [];
  validateHeaders(headers);
  const rows = csv.slice(1).map((values) => {
    return Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()]));
  }).filter((row) => row.name || row.url || row.sourceId);
  const manual = buildManual(rows);
  fs.writeFileSync(manualSignalsPath, `${JSON.stringify(manual, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    source: "assets/platform-signals.import.csv",
    restaurants: manual.restaurants.length,
    signals: manual.restaurants.reduce((sum, row) => sum + row.signals.length, 0),
    output: "assets/platform-signals.manual.json",
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, errors: error.errors || [] }, null, 2));
  process.exitCode = 1;
}
