const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const reportPath = path.join(repoRoot, "assets", "platform-source-probe-report.json");

const SOURCES = [
  {
    id: "ifoodie",
    label: "愛食記",
    url: "https://ifoodie.tw/",
    robotsUrl: "https://ifoodie.tw/robots.txt",
    tokens: ["愛食記", "餐廳", "美食", "評分"],
  },
  {
    id: "openrice-tw",
    label: "OpenRice 台灣",
    url: "https://tw.openrice.com/",
    robotsUrl: "https://tw.openrice.com/robots.txt",
    tokens: ["OpenRice", "餐廳", "食評", "優惠"],
  },
  {
    id: "tripadvisor-tw",
    label: "Tripadvisor 台灣",
    url: "https://www.tripadvisor.com.tw/Restaurants-g293910-Taiwan.html",
    robotsUrl: "https://www.tripadvisor.com.tw/robots.txt",
    tokens: ["Tripadvisor", "餐廳", "Taiwan", "Restaurants"],
  },
];

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

function requestText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "nearby-good-eats-source-probe/1.0 (+https://green-tea-king.github.io/nearby-good-eats/)",
        "Accept": "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.6",
      },
    }, (res) => {
      const location = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && location && redirects < 5) {
        res.resume();
        requestText(new URL(location, url).toString(), redirects + 1).then(resolve, reject);
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({
        finalUrl: url,
        statusCode: res.statusCode,
        contentType: res.headers["content-type"] || "",
        body,
      }));
    });
    req.setTimeout(20000, () => {
      req.destroy(new Error(`timeout fetching ${url}`));
    });
    req.on("error", reject);
  });
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function robotHint(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const disallowAll = lines.some((line) => /^disallow:\s*\/\s*$/i.test(line));
  const hasRules = lines.some((line) => /^(user-agent|allow|disallow):/i.test(line));
  return {
    available: hasRules,
    disallowAll,
    note: disallowAll
      ? "robots.txt has a broad Disallow: / rule; use manual/API only."
      : (hasRules ? "robots.txt available; still require source-specific review before importing." : "robots.txt not parseable or empty."),
  };
}

async function probeSource(source) {
  const result = {
    id: source.id,
    label: source.label,
    url: source.url,
    robotsUrl: source.robotsUrl,
    runtimeLookup: false,
    recommendedImportMode: "manual_or_authorized_api",
    status: "unknown",
    evidence: {},
    decision: "do_not_auto_import",
  };
  try {
    const [page, robots] = await Promise.allSettled([
      requestText(source.url),
      requestText(source.robotsUrl),
    ]);
    if (page.status === "fulfilled") {
      const text = stripTags(page.value.body);
      const body = page.value.body || "";
      const matchedTokens = source.tokens.filter((token) => text.includes(token) || body.includes(token));
      result.evidence.page = {
        statusCode: page.value.statusCode,
        contentType: page.value.contentType,
        htmlBytes: Buffer.byteLength(body, "utf8"),
        textBytes: Buffer.byteLength(text, "utf8"),
        matchedTokens,
      };
    } else {
      result.evidence.pageError = page.reason.message;
    }
    if (robots.status === "fulfilled") {
      const robotsInfo = robotHint(robots.value.body);
      result.evidence.robots = {
        statusCode: robots.value.statusCode,
        bytes: Buffer.byteLength(robots.value.body || "", "utf8"),
        ...robotsInfo,
      };
    } else {
      result.evidence.robotsError = robots.reason.message;
    }
    const pageOk = result.evidence.page?.statusCode >= 200 && result.evidence.page?.statusCode < 400;
    const hasText = Number(result.evidence.page?.textBytes || 0) > 2000;
    const hasTokens = (result.evidence.page?.matchedTokens || []).length >= 2;
    const blockedByRobots = result.evidence.robots?.disallowAll === true;
    result.status = pageOk ? "reachable" : "not_reachable";
    if (pageOk && hasText && hasTokens && !blockedByRobots) {
      result.recommendedImportMode = "manual_review_batch";
      result.decision = "manual_review_required";
      result.note = "來源可讀但不得直接自動匯入；需人工/AI 摘錄、保留 URL、再寫入 platform-signals.manual.json。";
    } else {
      result.note = "不符合安全自動解析條件；維持手動整理或授權 API 流程。";
    }
  } catch (error) {
    result.status = "error";
    result.error = error.message;
    result.note = "探測失敗；不得自動匯入。";
  }
  return result;
}

async function main() {
  const sources = [];
  for (const source of SOURCES) {
    sources.push(await probeSource(source));
  }
  const report = {
    version: `platform-probe-${taipeiDate()}`,
    generatedAt: new Date().toISOString(),
    policy: {
      runtimeExternalLookup: false,
      batchOnly: true,
      importRequiresManualReview: true,
      notes: [
        "本報告只判斷來源可用性，不匯入餐廳資料。",
        "任何平台資料都必須先整理進 assets/platform-signals.manual.json，通過驗證後才可合併。",
        "若來源要求授權 API、登入或 robots 限制，維持 manual/API-only，不做自動抓取。"
      ],
    },
    sources,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
