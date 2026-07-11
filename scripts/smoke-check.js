const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const expectedVersion = fs.readFileSync(path.join(repoRoot, "VERSION"), "utf8").trim();
const baseUrl = "https://green-tea-king.github.io/nearby-good-eats/";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

(async () => {
  const liveVersion = (await fetchText(`${baseUrl}VERSION`)).trim();
  const html = await fetchText(`${baseUrl}?v=${encodeURIComponent(expectedVersion)}`);

  const checks = [
    {
      name: "version-match",
      ok: liveVersion === expectedVersion,
      detail: `live=${liveVersion} expected=${expectedVersion}`,
    },
    {
      name: "idle-copy",
      ok: html.includes("先選條件，再按右下角「套用」開始查詢 Google 真資料。"),
      detail: "idle state copy",
    },
    {
      name: "idle-guide",
      ok: html.includes("目前尚未送出搜尋。系統只會在你按下套用後才調用 API。"),
      detail: "guide copy",
    },
    {
      name: "result-actions",
      ok: html.includes("不滿意這組結果？快速再找一組"),
      detail: "result relax actions",
    },
  ];

  const payload = {
    expectedVersion,
    liveVersion,
    checks,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (checks.some((x) => !x.ok)) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
