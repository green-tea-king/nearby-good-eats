const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "oad-asia-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "oad-asia-2025-import-report.json");
const sourceUrl = "https://www.oadguides.com/lists/asia/top-restaurants/2025";
const endpoint = "https://www.oadguides.com/lists/getrestaurantsbylistIdAndYear";
const listId = 117;

const CITY_MAP = {
  "Taipei": "臺北市",
  "Taipei City": "臺北市",
  "Taichung": "臺中市",
  "Kaohsiung": "高雄市",
  "Pingtung": "屏東縣",
};

const NAME_FIXES = {
  "TaÃ¯rroir": { name: "Tairroir", aliases: ["態芮", "Taïrroir"] },
  "FumÃ©e Yakitori": { name: "fumee Yakitori", aliases: ["fumée Yakitori"] },
  "EphernitÃ©": { name: "Ephernite", aliases: ["Ephernité"] },
  "L'Atelier de JoÃ«l Robuchon (Taipei)": { name: "L'Atelier de Joël Robuchon Taipei", aliases: ["侯布雄", "L'ATELIER de Joël Robuchon"] },
  "Mountain & Sea House Restaurant": { name: "Mountain and Sea House", aliases: ["山海樓"] },
  "YUENJI": { name: "Yuenji", aliases: ["元紀"] },
  "JL STUDIO": { name: "JL Studio", aliases: [] },
  "Mume": { name: "MUME", aliases: [] },
  "Kitcho Sushi": { name: "吉兆割烹壽司", aliases: ["Kitcho Sushi"] },
  "The Guest House": { name: "請客樓", aliases: ["The Guest House"] },
  "Golden Formosa": { name: "金蓬萊遵古台菜", aliases: ["Golden Formosa"] },
  "Ya Ge": { name: "雅閣", aliases: ["Ya Ge"] },
  "Mudan Tempura": { name: "牡丹", aliases: ["Mudan Tempura"] },
  "Sushi Ryu": { name: "鮨隆", aliases: ["Sushi Ryu"] },
};

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
          return;
        }
        resolve(JSON.parse(text));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function normalizeRow(row) {
  const fixed = NAME_FIXES[row.name] || { name: row.name, aliases: [] };
  const city = CITY_MAP[row.location1] || "";
  return {
    name: fixed.name,
    city,
    aliases: fixed.aliases || [],
    cuisine: row.cuisine || "",
    chef: row.chef || "",
    sourceUrl,
    sourceEndpoint: endpoint,
    sourceListId: listId,
    importConfidence: city ? "high" : "needs_city_review",
    awards: [{
      guide: "oad",
      year: 2025,
      level: row.rank <= 200 ? `Asia No.${row.rank}` : "Asia Recommended",
      rank: Number(row.rank),
      url: sourceUrl,
    }],
    source: {
      title: "OAD Top Restaurants in Asia 2025",
      url: sourceUrl,
      endpoint,
      raw: {
        name: row.name,
        location1: row.location1,
        location2: row.location2,
        rank: row.rank,
        chef: row.chef,
        cuisine: row.cuisine,
        friendlyUrl: row.friendlyUrl,
      },
    },
  };
}

async function main() {
  const data = await postJson(endpoint, {
    ListId: listId,
    Year: 2025,
    SortByDirection: "ASC",
    SortBy: 1,
    PreviewGuid: null,
  });
  const rows = (data.data0 || [])
    .filter((row) => row.location2 === "Taiwan")
    .map(normalizeRow);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    endpoint,
    candidates: rows.length,
    highConfidence: rows.filter((row) => row.importConfidence === "high").length,
    needsCityReview: rows.filter((row) => row.importConfidence !== "high").length,
    top200: rows.filter((row) => row.awards[0].rank <= 200).length,
    recommended: rows.filter((row) => row.awards[0].rank > 200).length,
  };
  fs.writeFileSync(outPath, `${JSON.stringify({
    version: "oad-asia-2025-candidates",
    generatedAt: report.generatedAt,
    sourceUrl,
    endpoint,
    restaurants: rows,
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
