const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const reportPath = path.join(repoRoot, "assets", "500sweet-2025-source-report.json");
const sourceUrl = "https://udn.com/500sweetaward/";

function requestText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body });
      });
    }).on("error", reject);
  });
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function main() {
  const { statusCode, body } = await requestText(sourceUrl);
  const text = stripTags(body);
  const likelyListSignals = [
    "500甜",
    "得獎",
    "甜點",
    "名單",
    "award",
  ].filter((token) => text.includes(token) || body.toLowerCase().includes(token.toLowerCase()));
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    statusCode,
    htmlBytes: Buffer.byteLength(body || "", "utf8"),
    textBytes: Buffer.byteLength(text || "", "utf8"),
    likelyListSignals,
    parseReady: statusCode >= 200 && statusCode < 300 && textBytesEnough(text),
    decision: "pending",
    note: "",
  };
  if (!report.parseReady) {
    report.decision = "do_not_import";
    report.note = "500甜官網目前無法由靜態 HTML 穩定取得完整文字名單；保留 guide/schema/frontend 支援，待取得可追溯文字名單、官方 API、或人工整理檔後再匯入。";
  } else {
    report.decision = "needs_parser_review";
    report.note = "頁面有足夠文字內容，但仍需建立專用 parser 與人工覆核後才可匯入。";
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

function textBytesEnough(text) {
  return Buffer.byteLength(String(text || ""), "utf8") > 5000 && /[縣市｜、]/.test(text);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
