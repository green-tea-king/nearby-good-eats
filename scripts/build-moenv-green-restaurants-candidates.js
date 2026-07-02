const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "moenv-green-restaurants-2026-candidates.json");
const reportPath = path.join(repoRoot, "assets", "moenv-green-restaurants-2026-import-report.json");

const sourcePageUrl = "https://data.moenv.gov.tw/dataset/detail/GIS_P_11";
const sourceApiUrl = "https://data.moenv.gov.tw/api/frontstage/datastore.search";
const resourceId = "d51ff618-8ec0-4d3a-8bcd-6ca5c85a205e";
const sourceLabel = "環境部環境資料開放平臺 環保餐廳環境即時通地圖資料";
const certifier = "環境部綜合規劃司";
const pageSize = 1000;

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDistrict(address) {
  const match = normalizeText(address).match(/^[臺台A-Za-z0-9\u4e00-\u9fa5]{2,3}[市縣](.{1,6}?(?:區|市|鎮|鄉))/);
  return match ? match[1] : "";
}

async function fetchBatch(offset) {
  const response = await fetch(sourceApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "nearby-good-eats batch source checker (non-runtime)",
    },
    body: JSON.stringify({
      resource_id: resourceId,
      limit: pageSize,
      offset,
    }),
  });
  if (!response.ok) throw new Error(`datastore.search failed ${response.status}`);
  const payload = await response.json();
  if (!payload?.success || !payload?.payload?.records) {
    throw new Error(`unexpected datastore.search payload at offset ${offset}`);
  }
  return payload.payload;
}

function mapRow(row, extractedAt) {
  const name = normalizeText(row.name);
  const city = normalizeText(row.city);
  const address = normalizeText(row.address);
  const district = extractDistrict(address);
  const datasetUpdatedAt = normalizeText(row.ImportDate?.date || "");
  return {
    name,
    city,
    district,
    address,
    cuisine: "",
    aliases: [],
    awards: [
      {
        guide: "moenvgreen",
        year: "年份待確認",
        level: "官方名錄",
        awardName: "環保餐廳",
        certType: "environmental_restaurant",
        sourceName: sourceLabel,
        certifier,
        datasetUpdatedAt,
        extractedAt,
        notes: "官方資料提供餐廳名錄與更新時間，但未提供逐店認證年份；依規則標記為年份待確認。",
        url: sourcePageUrl,
      },
    ],
    importConfidence: name && city && address ? "high" : "needs_manual_review",
    sourceMeta: {
      restid: normalizeText(row.restid),
      phone: normalizeText(row.phone),
      mobile: normalizeText(row.mobile || row.mobilephone),
      latitude: normalizeText(row.latitude || row.lat),
      longitude: normalizeText(row.longitude || row.lng),
      datasetUpdatedAt,
    },
  };
}

async function main() {
  const extractedAt = taipeiDate();
  const generatedAt = new Date().toISOString();
  const first = await fetchBatch(0);
  const total = Number(first.total || 0);
  const batches = [first];
  for (let offset = pageSize; offset < total; offset += pageSize) {
    batches.push(await fetchBatch(offset));
  }

  const seen = new Set();
  const restaurants = [];
  const needsManualReview = [];

  for (const batch of batches) {
    for (const raw of batch.records || []) {
      const row = mapRow(raw, extractedAt);
      const key = `${row.city}|${row.name}|${row.address}`;
      if (!row.name || !row.city || !row.address) {
        needsManualReview.push(row);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      restaurants.push(row);
    }
  }

  const payload = {
    version: "moenv-green-restaurants-2026-candidates",
    generatedAt,
    sourcePageUrl,
    sourceApiUrl,
    resourceId,
    policy: {
      runtimeExternalLookup: false,
      importMode: "official_open_data_batch",
      nationalCertificationList: true,
      notes: [
        "來源為環境部環境資料開放平臺官方資料集頁與其前台資料預覽端點。",
        "逐店資料有地址與更新時間，但沒有逐店認證年份，因此 year 一律標記為年份待確認。",
        "此來源為全台官方名錄，可作為環保認證加分與篩選，不做即時前端查詢。",
      ],
    },
    restaurants,
    needsManualReview,
  };

  const report = {
    generatedAt,
    sourcePageUrl,
    sourceApiUrl,
    resourceId,
    totalFromSource: total,
    fetchedBatches: batches.length,
    candidates: restaurants.length,
    needsManualReview: needsManualReview.length,
    errors: [],
  };

  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const report = {
    generatedAt: new Date().toISOString(),
    sourcePageUrl,
    sourceApiUrl,
    resourceId,
    totalFromSource: 0,
    fetchedBatches: 0,
    candidates: 0,
    needsManualReview: 0,
    errors: [error.message],
  };
  writeJson(reportPath, report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
