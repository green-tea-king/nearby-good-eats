const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const greenPath = path.join(repoRoot, "assets", "green-veggie-guide-2025-candidates.json");
const gdgPath = path.join(repoRoot, "assets", "gdg-awards-2025-candidates.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[()\-_/&+,'"`.，。．]/g, "")
    .toLowerCase();
}

function uniqueMatchesByName(rows) {
  const byName = new Map();
  for (const row of rows) {
    for (const name of [row.name, ...(row.aliases || [])]) {
      const key = normalizeName(name);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(row);
    }
  }
  for (const [key, matches] of byName.entries()) {
    byName.set(key, matches.filter((row, index, arr) =>
      arr.findIndex((x) => x.name === row.name && x.city === row.city) === index
    ));
  }
  return byName;
}

const GREEN_MANUAL = {
  "靜點咖啡": {
    city: "桃園市",
    district: "中壢區",
    address: "桃園市中壢區南園二路296巷50號",
    cuisine: "蔬食咖啡廳",
    sourceUrl: "https://ipuregreen.org/veg/?p=2971",
    notes: "城市依綠・蔬食評鑑指南桃園標籤頁確認，地址以蔬福生活公開頁交叉補齊。",
  },
  "沐素musu料理": {
    city: "彰化縣",
    district: "彰化市",
    address: "彰化縣彰化市雲長路192號",
    cuisine: "蔬食料理",
    sourceUrl: "https://ipuregreen.org/veg/?p=2944",
    notes: "地址與城市取自綠・蔬食評鑑指南店家頁。",
  },
  "禪廚蔬食餐廳": {
    city: "苗栗縣",
    district: "頭屋鄉",
    address: "苗栗縣頭屋鄉象山路188號",
    cuisine: "蔬食餐廳",
    sourceUrl: "https://ipuregreen.org/veg/?p=707",
    notes: "地址與城市取自綠・蔬食評鑑指南店家頁。",
  },
  "Chao・炒炒蔬食熱炒": {
    city: "台北市",
    district: "大安區",
    address: "台北市大安區大安路一段52巷21號",
    cuisine: "蔬食熱炒",
    sourceUrl: "https://ipuregreen.org/veg/?p=600",
    notes: "地址與城市取自綠・蔬食評鑑指南店家頁。",
  },
  "無口小廚": {
    city: "台北市",
    district: "大同區",
    address: "台北市大同區環河北路一段431號一樓",
    cuisine: "蔬食拉麵",
    sourceUrl: "https://ipuregreen.org/veg/?p=567",
    notes: "城市依綠・蔬食評鑑指南店家頁確認，地址以公開食記頁交叉補齊。",
  },
  "曙光居蔬食料理": {
    city: "台中市",
    district: "西屯區",
    address: "台中市西屯區大墩十八街104號",
    cuisine: "蔬食餐廳",
    sourceUrl: "https://ipuregreen.org/veg/?p=456",
    notes: "城市依綠・蔬食評鑑指南台中標籤頁確認，地址以公開食記頁交叉補齊。",
  },
  "恆。好 餐廳畫廊": {
    city: "屏東縣",
    district: "恆春鎮",
    address: "屏東縣恆春鎮東門路2巷11弄2號",
    cuisine: "蔬食餐廳",
    sourceUrl: "https://ipuregreen.org/veg/?p=428",
    notes: "城市依綠・蔬食評鑑指南店家頁確認，地址以蔬福生活公開頁交叉補齊。",
  },
};

function reconcileGreen() {
  const data = readJson(greenPath);
  const remaining = [];
  const moved = [];
  for (const row of data.needsCityReview || []) {
    const fix = GREEN_MANUAL[row.name];
    if (!fix) {
      remaining.push(row);
      continue;
    }
    const award = Object.assign({}, (row.awards || [])[0] || {}, {
      url: fix.sourceUrl || ((row.awards || [])[0] || {}).url || "",
      notes: fix.notes,
      extractedAt: new Date().toISOString(),
    });
    moved.push({
      name: row.name,
      city: fix.city,
      district: fix.district,
      address: fix.address,
      cuisine: fix.cuisine,
      aliases: row.aliases || [],
      awards: [award],
      importConfidence: "high",
      matchedBy: "manual_public_source_confirmation",
    });
  }
  data.restaurants = [...(data.restaurants || []), ...moved];
  data.needsCityReview = remaining;
  writeJson(greenPath, data);
  return { moved: moved.length, remaining: remaining.length };
}

function reconcileGdg() {
  const awards = readJson(awardsPath);
  const byName = uniqueMatchesByName(awards.restaurants || []);
  const data = readJson(gdgPath);
  const remaining = [];
  const moved = [];
  for (const row of data.needsCityReview || []) {
    const matches = byName.get(normalizeName(row.name)) || [];
    if (matches.length !== 1) {
      remaining.push(row);
      continue;
    }
    const match = matches[0];
    moved.push({
      name: match.name,
      city: match.city,
      aliases: [row.name, ...(match.aliases || [])]
        .filter((value, index, arr) => value && arr.indexOf(value) === index)
        .filter((value) => normalizeName(value) !== normalizeName(match.name)),
      awards: [{
        guide: "gdgawards",
        year: 2025,
        level: row.category,
        category: row.category,
        dimension: row.dimension,
        region: row.region,
        url: "https://greenmedia.today/article_detail.php?cid=7&mid=1407",
        extractedAt: new Date().toISOString(),
        notes: "以現有內建餐廳資料唯一名稱命中補齊城市。",
      }],
      importConfidence: "high",
      matchedBy: "unique_existing_awards_name_after_awards_refresh",
    });
  }
  data.restaurants = [...(data.restaurants || []), ...moved];
  data.needsCityReview = remaining;
  writeJson(gdgPath, data);
  return { moved: moved.length, remaining: remaining.length };
}

function main() {
  const green = reconcileGreen();
  const gdg = reconcileGdg();
  console.log(JSON.stringify({ ok: true, green, gdg }, null, 2));
}

main();
